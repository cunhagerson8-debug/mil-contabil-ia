import { createHash, createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { passwordResetRepository } from "../repositories/passwordReset.repository.js";
import { EmailDeliveryError, emailService } from "./email.service.js";
import { ServiceUnavailableError, ValidationError } from "../utils/errors.js";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const INVALID_TOKEN_MESSAGE = "Este link é inválido ou expirou. Solicite uma nova recuperação de senha.";

export interface PasswordResetRequest {
  id: string;
  email: string;
  attempts: number;
}

export interface PasswordResetUser {
  id: string;
  email: string;
  full_name: string;
}

export interface PasswordResetRepository {
  enqueueRequest(email: string, emailHash: string): Promise<boolean>;
  claimNextRequest(): Promise<PasswordResetRequest | null>;
  findResettableUserByEmail(email: string): Promise<PasswordResetUser | null>;
  replaceActiveToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  revokeToken(tokenHash: string): Promise<void>;
  completeRequest(requestId: string): Promise<void>;
  retryRequest(requestId: string, attempts: number, availableAt: Date | null, errorCode: string): Promise<void>;
  cleanup(): Promise<void>;
  hasUsableToken(tokenHash: string): Promise<boolean>;
  consumeTokenAndUpdatePassword(tokenHash: string, passwordHash: string): Promise<boolean>;
}

interface PasswordResetEmail {
  to: string;
  fullName: string;
  token: string;
  expiresAt: Date;
}

export interface PasswordResetServiceDependencies {
  repository: PasswordResetRepository;
  sendPasswordResetEmail(data: PasswordResetEmail): Promise<void>;
  hashEmail(email: string): string;
  createToken(): string;
  hashToken(token: string): string;
  hashPassword(password: string): Promise<string>;
  now(): number;
  workerEnabled: boolean;
  log(message: string, metadata: Record<string, string | number>): void;
}

export function createPasswordResetService(dependencies: PasswordResetServiceDependencies) {
  return {
    async requestPasswordReset(email: string): Promise<{ accepted: true }> {
      if (!dependencies.workerEnabled) {
        throw new ServiceUnavailableError("A recuperação de senha está temporariamente indisponível.");
      }
      const normalizedEmail = email.trim().toLowerCase();
      try {
        await dependencies.repository.enqueueRequest(
          normalizedEmail,
          dependencies.hashEmail(normalizedEmail),
        );
      } catch {
        dependencies.log("[password-reset] Falha ao registrar solicitação.", {
          errorType: "queue_enqueue",
        });
        throw new ServiceUnavailableError("Não foi possível registrar a solicitação. Tente novamente mais tarde.");
      }
      return { accepted: true };
    },

    async processNextRequest(): Promise<boolean> {
      let request: PasswordResetRequest | null;
      try {
        request = await dependencies.repository.claimNextRequest();
      } catch {
        dependencies.log("[password-reset] Falha ao consultar a fila.", { errorType: "queue_claim" });
        return false;
      }
      if (!request) return false;

      let tokenHash: string | null = null;
      let providerAcceptedEmail = false;
      try {
        const user = await dependencies.repository.findResettableUserByEmail(request.email);
        if (!user) {
          await dependencies.repository.completeRequest(request.id);
          return true;
        }

        const token = dependencies.createToken();
        tokenHash = dependencies.hashToken(token);
        const expiresAt = new Date(dependencies.now() + TOKEN_TTL_MS);
        await dependencies.repository.replaceActiveToken(user.id, tokenHash, expiresAt);
        await dependencies.sendPasswordResetEmail({
          to: user.email,
          fullName: user.full_name,
          token,
          expiresAt,
        });
        providerAcceptedEmail = true;
        await dependencies.repository.completeRequest(request.id);
      } catch (error) {
        if (tokenHash && !providerAcceptedEmail) {
          try {
            await dependencies.repository.revokeToken(tokenHash);
          } catch {
            dependencies.log("[password-reset] Falha ao revogar token de envio pendente.", {
              requestId: request.id,
              errorType: "token_revoke",
            });
          }
        }

        const attempts = Math.max(1, Math.min(request.attempts, MAX_ATTEMPTS));
        const availableAt = attempts >= MAX_ATTEMPTS
          ? null
          : new Date(dependencies.now() + RETRY_DELAYS_MS[attempts - 1]);
        const errorCode = error instanceof EmailDeliveryError ? "email_delivery" : "processing";
        try {
          await dependencies.repository.retryRequest(request.id, attempts, availableAt, errorCode);
        } catch {
          dependencies.log("[password-reset] Falha ao reagendar solicitação.", {
            requestId: request.id,
            errorType: "queue_retry",
          });
        }
        dependencies.log("[password-reset] Solicitação não processada.", {
          requestId: request.id,
          attempt: attempts,
          errorType: errorCode,
        });
      }
      return true;
    },

    async resetPassword(token: string, password: string): Promise<void> {
      const tokenHash = dependencies.hashToken(token);
      let usable: boolean;
      try {
        usable = await dependencies.repository.hasUsableToken(tokenHash);
      } catch {
        dependencies.log("[password-reset] Falha ao validar token.", { errorType: "token_check" });
        throw new ServiceUnavailableError("Não foi possível redefinir a senha agora. Tente novamente mais tarde.");
      }
      if (!usable) throw new ValidationError(INVALID_TOKEN_MESSAGE);

      let passwordHash: string;
      try {
        passwordHash = await dependencies.hashPassword(password);
      } catch {
        dependencies.log("[password-reset] Falha ao calcular hash de senha.", { errorType: "password_hash" });
        throw new ServiceUnavailableError("Não foi possível redefinir a senha agora. Tente novamente mais tarde.");
      }
      let reset: boolean;
      try {
        reset = await dependencies.repository.consumeTokenAndUpdatePassword(tokenHash, passwordHash);
      } catch {
        dependencies.log("[password-reset] Falha ao concluir redefinição.", { errorType: "token_consume" });
        throw new ServiceUnavailableError("Não foi possível redefinir a senha agora. Tente novamente mais tarde.");
      }
      if (!reset) throw new ValidationError(INVALID_TOKEN_MESSAGE);
    },

    async cleanup(): Promise<void> {
      try {
        await dependencies.repository.cleanup();
      } catch {
        dependencies.log("[password-reset] Falha na limpeza da fila.", { errorType: "cleanup" });
      }
    },
  };
}

export const passwordResetService = createPasswordResetService({
  repository: passwordResetRepository,
  sendPasswordResetEmail: (data) => emailService.sendPasswordResetEmail(data),
  hashEmail: (email) => createHmac("sha256", env.rlsContextSecret)
    .update(`password-reset-email\0${email}`)
    .digest("hex"),
  createToken: () => randomBytes(32).toString("base64url"),
  hashToken: (token) => createHash("sha256").update(token).digest("hex"),
  hashPassword: (password) => bcrypt.hash(password, 10),
  now: () => Date.now(),
  workerEnabled: !env.disableBackgroundJobs,
  log: (message, metadata) => console.error(message, metadata),
});
