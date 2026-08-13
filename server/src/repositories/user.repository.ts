// =============================================================================
// Repository: Users (autenticação e consulta)
// =============================================================================
import { PoolClient } from "pg";
import { UserRowWithFirm, UserCompanyAccessRow } from "../types/db.js";

const SELECT_WITH_FIRM = `
  SELECT u.*, f.name AS firm_name
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
`;

export const userRepository = {
  /**
   * Busca por e-mail para login. Esta é a ÚNICA query do sistema que
   * legitimamente precisa rodar SEM contexto de tenant (o usuário ainda não
   * está autenticado, então não há firm_id de sessão) — por isso o
   * authService usa withPlatformContext para chamar isto, nunca
   * withTenantContext. RLS para SELECT em `users` exige firm_id de sessão
   * (ver users_select_same_firm em 011_row_level_security.sql); o login
   * precisa contornar isso deliberadamente, e só para esta query pontual.
   */
  async findByEmailAnyFirm(client: PoolClient, email: string): Promise<UserRowWithFirm | null> {
    const result = await client.query<UserRowWithFirm>(
      `${SELECT_WITH_FIRM} WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email.trim().toLowerCase()]
    );
    return result.rows[0] ?? null;
  },

  async findById(client: PoolClient, id: string): Promise<UserRowWithFirm | null> {
    const result = await client.query<UserRowWithFirm>(
      `${SELECT_WITH_FIRM} WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async findCompanyAccess(client: PoolClient, userId: string): Promise<UserCompanyAccessRow[]> {
    const result = await client.query<UserCompanyAccessRow>(
      `SELECT user_id, company_id, can_manage FROM user_company_access WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  },

  async updateLastLogin(client: PoolClient, userId: string): Promise<void> {
    await client.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
  },
};
