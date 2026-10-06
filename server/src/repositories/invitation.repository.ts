import { PoolClient } from "pg";

export interface InvitationLookupRow {
  invitation_id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  user_status: string;
  user_deleted_at: Date | null;
  has_password: boolean;
  full_name: string;
  email: string;
  firm_name: string | null;
}

export const invitationRepository = {
  // Busca somente por token_hash; o token puro nunca chega ao banco.
  async findByTokenHash(client: PoolClient, tokenHash: string): Promise<InvitationLookupRow | null> {
    const result = await client.query<InvitationLookupRow>(
      `SELECT i.id AS invitation_id, i.user_id, i.expires_at, i.used_at, i.revoked_at,
              u.status::text AS user_status, u.deleted_at AS user_deleted_at,
              (u.password_hash IS NOT NULL) AS has_password,
              u.full_name, u.email, f.name AS firm_name
       FROM user_invitations i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN firms f ON f.id = u.firm_id
       WHERE i.token_hash = $1`,
      [tokenHash]
    );
    return result.rows[0] ?? null;
  },

  // Consumo atômico: o UPDATE condicional trava a linha, então uma segunda
  // requisição concorrente reavalia used_at após o commit da primeira e não casa.
  async consume(client: PoolClient, tokenHash: string): Promise<string | null> {
    const result = await client.query<{ user_id: string }>(
      `UPDATE user_invitations
       SET used_at = now()
       WHERE token_hash = $1
         AND used_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > now()
       RETURNING user_id`,
      [tokenHash]
    );
    return result.rows[0]?.user_id ?? null;
  },

  async activateUser(client: PoolClient, userId: string, passwordHash: string): Promise<boolean> {
    const result = await client.query(
      `UPDATE users
       SET password_hash = $2, auth_provider = 'password', status = 'active'
       WHERE id = $1
         AND status = 'invited'
         AND deleted_at IS NULL
         AND password_hash IS NULL`,
      [userId, passwordHash]
    );
    return result.rowCount === 1;
  },
};
