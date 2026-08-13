// =============================================================================
// Service: Auth
// -----------------------------------------------------------------------------
// Substitui completamente modules/auth/mockAuth.ts do frontend. O contrato
// de retorno (AuthSessionDto) é IDÊNTICO ao que o mock devolvia, então a
// troca no frontend é só apontar para a API em vez do mock — ver
// services/apiAuthClient.ts no frontend.
// =============================================================================
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { withPlatformContext, withTenantContext } from "../db/withTenantContext.js";
import { userRepository } from "../repositories/user.repository.js";
import { userManagementRepository } from "../repositories/user.management.repository.js";
import { toAuthUserDto } from "../mappers/user.mapper.js";
import { LoginInput, RegisterInput, AuthSessionDto } from "../types/dto.js";
import { UnauthorizedError, ConflictError } from "../utils/errors.js";
import { env } from "../config/env.js";

interface JwtPayload {
  sub: string;       // user id
  firmId: string | null;
  role: string;
}

export const authService = {
  async login(input: LoginInput): Promise<AuthSessionDto> {
    // Login roda com withPlatformContext (BYPASSRLS) porque o usuário ainda
    // não está autenticado — não há app.current_firm_id de sessão ainda.
    // Esta é a ÚNICA operação de autenticação que legitimamente ignora RLS;
    // tudo que vem depois do login usa withTenantContext normalmente.
    const user = await withPlatformContext((client) => userRepository.findByEmailAnyFirm(client, input.email));

    if (!user || !user.password_hash) {
      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }
    if (user.status === "suspended") {
      throw new UnauthorizedError("Esta conta está suspensa. Contate o administrador do escritório.");
    }
    if (user.status === "deactivated") {
      throw new UnauthorizedError("Esta conta foi desativada.");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }

    const companyAccess = await withPlatformContext((client) => userRepository.findCompanyAccess(client, user.id));
    await withPlatformContext((client) => userRepository.updateLastLogin(client, user.id));

    const token = signToken({ sub: user.id, firmId: user.firm_id, role: user.role });
    const expiresAt = new Date(Date.now() + parseExpiryMs(env.jwtExpiresIn)).toISOString();

    return {
      user: toAuthUserDto({ ...user, last_login_at: new Date().toISOString() }, companyAccess),
      token,
      expiresAt,
    };
  },

  /**
   * Usado pelo middleware de auth para reconstruir o usuário a partir do
   * token em cada requisição. Roda com o próprio contexto de tenant do
   * usuário (não withPlatformContext) — é uma leitura de dados já
   * autenticados, então passa pelo RLS normalmente como qualquer outra
   * query autenticada.
   */
  async getUserById(userId: string, firmId: string | null, role: string): Promise<AuthSessionDto["user"] | null> {
    return withTenantContext({ userId, firmId, role }, async (client) => {
      const user = await userRepository.findById(client, userId);
      if (!user) return null;
      const companyAccess = await userRepository.findCompanyAccess(client, userId);
      return toAuthUserDto(user, companyAccess);
    });
  },

  async register(input: RegisterInput): Promise<AuthSessionDto> {
    return withPlatformContext(async (client) => {
      const existingUser = await userRepository.findByEmailAnyFirm(client, input.admin.email);
      if (existingUser) {
        throw new ConflictError("Já existe um usuário com este e-mail.");
      }

      const existingFirmResult = await client.query<{ id: string }>(
        `SELECT id FROM firms WHERE cnpj = $1 AND deleted_at IS NULL`,
        [input.firm.cnpj]
      );

      if (existingFirmResult.rows.length > 0) {
        throw new ConflictError("Já existe um escritório com este CNPJ.");
      }

      const firmResult = await client.query<{ id: string }>(
        `INSERT INTO firms (name, trade_name, cnpj, email, phone, timezone)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [
          input.firm.name.trim(),
          input.firm.tradeName?.trim() ?? null,
          input.firm.cnpj.trim(),
          input.firm.email.trim().toLowerCase(),
          input.firm.phone?.trim() ?? null,
          input.firm.timezone?.trim() ?? "America/Sao_Paulo",
        ]
      );

      const firmId = firmResult.rows[0].id;
      const passwordHash = await bcrypt.hash(input.admin.password, 10);

      const user = await userManagementRepository.createWithPassword(client, {
        firmId,
        email: input.admin.email.trim().toLowerCase(),
        fullName: input.admin.fullName.trim(),
        role: "firm_owner",
        status: "active",
        authProvider: "password",
        passwordHash,
        phone: input.admin.phone?.trim() ?? null,
      });

      const companyAccess = await userRepository.findCompanyAccess(client, user.id);
      const authUser = toAuthUserDto(user, companyAccess);
      const token = signToken({ sub: user.id, firmId: user.firm_id, role: user.role });
      const expiresAt = new Date(Date.now() + parseExpiryMs(env.jwtExpiresIn)).toISOString();

      return {
        user: authUser,
        token,
        expiresAt,
      };
    });
  },

  /**
   * Por segurança, não revela se o e-mail existe ou não — mesma resposta
   * em ambos os casos (mitiga enumeração de contas). A implementação real
   * de envio de e-mail (token de reset, expiração, link assinado) fica fora
   * do escopo desta service; aqui só validamos e simulamos o agendamento.
   * TODO produção: gerar token de reset com expiração curta, persistir hash
   * do token (nunca o token em claro) em uma tabela password_reset_tokens,
   * e disparar e-mail via provedor transacional (SES, Postmark, etc.).
   */
  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const user = await withPlatformContext((client) => userRepository.findByEmailAnyFirm(client, email));
    if (user) {
      // eslint-disable-next-line no-console
      console.log(`[auth] Solicitação de redefinição de senha para ${email} (user ${user.id}) — envio de e-mail não implementado nesta versão.`);
    }
    return { sent: true };
  },

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  },
};

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
}

function parseExpiryMs(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) return 8 * 60 * 60 * 1000; // fallback: 8h
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
}
