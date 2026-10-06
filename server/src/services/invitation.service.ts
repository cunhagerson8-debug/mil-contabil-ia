import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { withPlatformContext } from "../db/withTenantContext.js";
import { invitationRepository, InvitationLookupRow } from "../repositories/invitation.repository.js";
import { ValidationError } from "../utils/errors.js";

const INVALID_MESSAGE = "Este convite é inválido ou não existe mais.";
const MESSAGE_USED = "Este convite já foi utilizado. Faça login com sua senha.";
const MESSAGE_REVOKED = "Este convite foi cancelado. Solicite um novo convite ao administrador.";
const MESSAGE_EXPIRED = "Este convite expirou. Solicite um novo convite ao administrador.";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function assertUsable(row: InvitationLookupRow | null): asserts row is InvitationLookupRow {
  if (!row) throw new ValidationError(INVALID_MESSAGE);
  if (row.used_at) throw new ValidationError(MESSAGE_USED);
  if (row.revoked_at) throw new ValidationError(MESSAGE_REVOKED);
  if (row.expires_at.getTime() <= Date.now()) throw new ValidationError(MESSAGE_EXPIRED);
  if (row.user_status !== "invited" || row.user_deleted_at || row.has_password) {
    throw new ValidationError(INVALID_MESSAGE);
  }
}

// Fluxo público (usuário ainda sem sessão), como o login: usa withPlatformContext
// e nunca aceita role/firmId/companyId do cliente — tudo vem do usuário já criado.
export const invitationService = {
  async validate(token: string) {
    const row = await withPlatformContext((client) => invitationRepository.findByTokenHash(client, hashToken(token)));
    assertUsable(row);
    return {
      fullName: row.full_name,
      email: row.email,
      firmName: row.firm_name,
      expiresAt: row.expires_at.toISOString(),
    };
  },

  async accept(token: string, password: string): Promise<void> {
    const tokenHash = hashToken(token);
    // Mesmo custo de bcrypt usado em auth.service (register).
    const passwordHash = await bcrypt.hash(password, 10);

    await withPlatformContext(async (client) => {
      const userId = await invitationRepository.consume(client, tokenHash);
      if (!userId) {
        // Não consumiu: descobre o motivo para uma mensagem amigável.
        assertUsable(await invitationRepository.findByTokenHash(client, tokenHash));
        throw new ValidationError(INVALID_MESSAGE);
      }
      const activated = await invitationRepository.activateUser(client, userId, passwordHash);
      // Lançar aqui faz ROLLBACK e desfaz o used_at.
      if (!activated) throw new ValidationError(INVALID_MESSAGE);
    });
  },
};
