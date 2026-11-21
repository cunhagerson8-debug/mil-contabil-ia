import type { PoolClient } from "pg";
import { withPlatformContext } from "../db/withTenantContext.js";

export interface PasswordResetRequestRow {
  id: string;
  email: string;
  attempts: number;
}

export interface PasswordResetUserRow {
  id: string;
  email: string;
  full_name: string;
}

class ResetUserUnavailableError extends Error {}

export const passwordResetRepository = {
  async enqueueRequest(email: string, emailHash: string): Promise<boolean> {
    return withPlatformContext(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [emailHash]);
      const recentRequest = await client.query(
        `SELECT 1
         FROM password_reset_requests
         WHERE email_hash = $1 AND created_at > now() - interval '15 minutes'
         LIMIT 1`,
        [emailHash],
      );
      if (recentRequest.rowCount) return false;

      await client.query(
        `INSERT INTO password_reset_requests (email, email_hash)
         VALUES ($1, $2)`,
        [email, emailHash],
      );
      return true;
    });
  },

  async claimNextRequest(): Promise<PasswordResetRequestRow | null> {
    return withPlatformContext(async (client) => {
      await client.query(
        `UPDATE password_reset_requests
         SET status = 'failed', email = NULL, locked_at = NULL,
             completed_at = now(), last_error_code = 'worker_timeout'
         WHERE status = 'processing'
           AND attempts >= 5
           AND locked_at < now() - interval '5 minutes'`,
      );

      const result = await client.query<PasswordResetRequestRow>(
        `WITH candidate AS (
           SELECT id
           FROM password_reset_requests
           WHERE (status = 'pending' AND available_at <= now())
              OR (status = 'processing' AND locked_at < now() - interval '5 minutes' AND attempts < 5)
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE password_reset_requests AS request
         SET status = 'processing',
             attempts = request.attempts + 1,
             locked_at = now()
         FROM candidate
         WHERE request.id = candidate.id
         RETURNING request.id, request.email, request.attempts`,
      );
      return result.rows[0] ?? null;
    });
  },

  async findResettableUserByEmail(email: string): Promise<PasswordResetUserRow | null> {
    return withPlatformContext(async (client) => {
      const result = await client.query<PasswordResetUserRow>(
        `SELECT id, email, full_name
         FROM users
         WHERE email = $1
           AND status = 'active'
           AND deleted_at IS NULL
           AND auth_provider = 'password'
           AND password_hash IS NOT NULL
         LIMIT 1`,
        [email],
      );
      return result.rows[0] ?? null;
    });
  },

  async replaceActiveToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await withPlatformContext(async (client) => {
      await client.query(
        `UPDATE password_reset_tokens
         SET revoked_at = now()
         WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
        [userId],
      );
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt],
      );
    });
  },

  async revokeToken(tokenHash: string): Promise<void> {
    await withPlatformContext(async (client) => {
      await client.query(
        `UPDATE password_reset_tokens
         SET revoked_at = now()
         WHERE token_hash = $1 AND used_at IS NULL AND revoked_at IS NULL`,
        [tokenHash],
      );
    });
  },

  async completeRequest(requestId: string): Promise<void> {
    await withPlatformContext(async (client) => {
      await client.query(
        `UPDATE password_reset_requests
         SET status = 'completed', email = NULL, locked_at = NULL,
             completed_at = now(), last_error_code = NULL
         WHERE id = $1 AND status = 'processing'`,
        [requestId],
      );
    });
  },

  async retryRequest(
    requestId: string,
    attempts: number,
    availableAt: Date | null,
    errorCode: string,
  ): Promise<void> {
    const failed = attempts >= 5;
    await withPlatformContext(async (client) => {
      await client.query(
        `UPDATE password_reset_requests
         SET status = $2,
             email = CASE WHEN $2 = 'failed' THEN NULL ELSE email END,
             available_at = COALESCE($3, available_at),
             locked_at = NULL,
             completed_at = CASE WHEN $2 = 'failed' THEN now() ELSE NULL END,
             last_error_code = $4
         WHERE id = $1 AND status = 'processing'`,
        [requestId, failed ? "failed" : "pending", availableAt, errorCode],
      );
    });
  },

  async cleanup(): Promise<void> {
    await withPlatformContext(async (client) => {
      await client.query(
        `DELETE FROM password_reset_requests
         WHERE status IN ('completed', 'failed')
           AND created_at < now() - interval '7 days'`,
      );
      await client.query(
        `DELETE FROM password_reset_tokens
         WHERE (used_at IS NOT NULL OR revoked_at IS NOT NULL OR expires_at <= now())
           AND created_at < now() - interval '7 days'`,
      );
    });
  },

  async hasUsableToken(tokenHash: string): Promise<boolean> {
    return withPlatformContext(async (client) => {
      const result = await client.query(
        `SELECT 1
         FROM password_reset_tokens token
         JOIN users user_record ON user_record.id = token.user_id
         WHERE token.token_hash = $1
           AND token.used_at IS NULL
           AND token.revoked_at IS NULL
           AND token.expires_at > now()
           AND user_record.status = 'active'
           AND user_record.deleted_at IS NULL
           AND user_record.auth_provider = 'password'
           AND user_record.password_hash IS NOT NULL
         LIMIT 1`,
        [tokenHash],
      );
      return result.rowCount === 1;
    });
  },

  async consumeTokenAndUpdatePassword(tokenHash: string, passwordHash: string): Promise<boolean> {
    try {
      return await withPlatformContext(async (client) => {
        const tokenResult = await client.query<{ id: string; user_id: string }>(
          `SELECT id, user_id
           FROM password_reset_tokens
           WHERE token_hash = $1
             AND used_at IS NULL
             AND revoked_at IS NULL
             AND expires_at > now()
           FOR UPDATE`,
          [tokenHash],
        );
        const token = tokenResult.rows[0];
        if (!token) return false;

        const userResult = await client.query(
          `UPDATE users
           SET password_hash = $2, session_version = session_version + 1
           WHERE id = $1
             AND status = 'active'
             AND deleted_at IS NULL
             AND auth_provider = 'password'
             AND password_hash IS NOT NULL`,
          [token.user_id, passwordHash],
        );
        if (userResult.rowCount !== 1) throw new ResetUserUnavailableError();

        await client.query(
          `UPDATE refresh_tokens
           SET revoked_at = now()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [token.user_id],
        );

        const consumed = await client.query(
          `UPDATE password_reset_tokens
           SET used_at = now()
           WHERE id = $1
             AND used_at IS NULL
             AND revoked_at IS NULL
             AND expires_at > now()`,
          [token.id],
        );
        if (consumed.rowCount !== 1) throw new ResetUserUnavailableError();

        await client.query(
          `UPDATE password_reset_tokens
           SET revoked_at = now()
           WHERE user_id = $1
             AND id <> $2
             AND used_at IS NULL
             AND revoked_at IS NULL`,
          [token.user_id, token.id],
        );
        return true;
      });
    } catch (error) {
      if (error instanceof ResetUserUnavailableError) return false;
      throw error;
    }
  },
};
