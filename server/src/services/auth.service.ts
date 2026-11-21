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
import type { PoolClient } from "pg";
import type { UserRoleDb } from "../types/db.js";

interface JwtPayload {
  sub: string;       // user id
  firmId: string | null;
  role: UserRoleDb;
  sessionVersion: number;
}

const USER_ROLES = new Set<UserRoleDb>([
  "platform_admin",
  "firm_owner",
  "accountant",
  "company_manager",
  "company_user",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const authService = {
  async login(input: LoginInput): Promise<AuthSessionDto> {
    // Login precisa localizar a identidade antes de conhecer seu escritório;
    // a consulta é restrita por e-mail e usa a conexão administrativa isolada.
    const user = await withPlatformContext((client) => userRepository.findByEmailAnyFirm(client, input.email));

    if (!user || !user.password_hash) {
      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }
    if (user.status === "suspended") {
      throw new UnauthorizedError("Esta conta está suspensa. Contate o administrador do escritório.");
    }
    if (user.status !== "active") {
      throw new UnauthorizedError("Esta conta não está ativa.");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }

    const { companyAccess, hrPermissions } = await withPlatformContext(async (client) => ({
      companyAccess: await userRepository.findCompanyAccess(client, user.id),
      hrPermissions: await userRepository.findHrPermissions(client, user.id),
    }));
    await withPlatformContext((client) => userRepository.updateLastLogin(client, user.id));

    const token = signToken({
      sub: user.id,
      firmId: user.firm_id,
      role: user.role,
      sessionVersion: user.session_version,
    });
    const expiresAt = new Date(Date.now() + parseExpiryMs(env.jwtExpiresIn)).toISOString();

    return {
      user: toAuthUserDto({ ...user, last_login_at: new Date().toISOString() }, companyAccess, hrPermissions),
      token,
      expiresAt,
    };
  },

  /**
   * Usado pelo middleware de auth para reconstruir o usuário a partir do
   * token em cada requisição. Usuários de escritório são consultados no
   * contexto RLS do token; platform_admin é revalidado pela conexão
   * administrativa. Status, escritório e role atuais precisam coincidir
   * com as claims assinadas.
   */
  async getUserById(
    userId: string,
    firmId: string | null,
    role: string,
    sessionVersion?: number,
  ): Promise<AuthSessionDto["user"] | null> {
    const lookup = async (client: PoolClient) => {
      const user = await userRepository.findById(client, userId);
      if (
        !user
        || user.status !== "active"
        || user.firm_id !== firmId
        || user.role !== role
        || (sessionVersion !== undefined && user.session_version !== sessionVersion)
      ) return null;
      const companyAccess = await userRepository.findCompanyAccess(client, userId);
      const hrPermissions = await userRepository.findHrPermissions(client, userId);
      return toAuthUserDto(user, companyAccess, hrPermissions);
    };

    if (role === "platform_admin") {
      if (firmId !== null) return null;
      return withPlatformContext(lookup);
    }
    if (!firmId) return null;
    return withTenantContext({ userId, firmId, role }, lookup);
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
      const token = signToken({
        sub: user.id,
        firmId: user.firm_id,
        role: user.role,
        sessionVersion: 0,
      });
      const expiresAt = new Date(Date.now() + parseExpiryMs(env.jwtExpiresIn)).toISOString();

      return {
        user: authUser,
        token,
        expiresAt,
      };
    });
  },

  verifyToken(token: string): JwtPayload {
    const payload = jwt.verify(token, env.jwtSecret);
    if (
      typeof payload === "string"
      || typeof payload.sub !== "string"
      || !UUID_PATTERN.test(payload.sub)
      || typeof payload.role !== "string"
      || !USER_ROLES.has(payload.role as UserRoleDb)
      || (payload.firmId !== null && (typeof payload.firmId !== "string" || !UUID_PATTERN.test(payload.firmId)))
      || (payload.role === "platform_admin" ? payload.firmId !== null : !payload.firmId)
      || (
        payload.sessionVersion !== undefined
        && (typeof payload.sessionVersion !== "number" || !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 0)
      )
    ) {
      throw new UnauthorizedError("Token inválido ou expirado.");
    }

    return {
      sub: payload.sub,
      firmId: payload.firmId as string | null,
      role: payload.role as UserRoleDb,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0,
    };
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
