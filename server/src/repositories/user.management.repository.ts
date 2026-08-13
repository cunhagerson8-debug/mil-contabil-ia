import { PoolClient } from "pg";
import { UserRowWithFirm, UserCompanyAccessRow } from "../types/db.js";

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
}

export const userManagementRepository = {
  async findAll(client: PoolClient, filters: UserFilters = {}): Promise<UserRowWithFirm[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.role) {
      params.push(filters.role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`u.status = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT u.*, f.name AS firm_name
      FROM users u
      LEFT JOIN firms f ON f.id = u.firm_id
      ${where}
      ORDER BY u.full_name ASC
    `;
    const result = await client.query<UserRowWithFirm>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<UserRowWithFirm | null> {
    const result = await client.query<UserRowWithFirm>(
      `SELECT u.*, f.name AS firm_name FROM users u LEFT JOIN firms f ON f.id = u.firm_id WHERE u.id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async findCompanyAccess(client: PoolClient, userId: string): Promise<UserCompanyAccessRow[]> {
    const result = await client.query<UserCompanyAccessRow>(
      `SELECT * FROM user_company_access WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  },

  async updateStatus(client: PoolClient, id: string, status: string): Promise<UserRowWithFirm | null> {
    await client.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, id]);
    return this.findById(client, id);
  },

  async updateRole(client: PoolClient, id: string, role: string): Promise<UserRowWithFirm | null> {
    await client.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
    return this.findById(client, id);
  },

  async invite(client: PoolClient, data: { firmId: string; email: string; fullName: string; role: string }): Promise<UserRowWithFirm> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO users (firm_id, email, full_name, role, status, auth_provider)
       VALUES ($1,$2,$3,$4,'invited','email') RETURNING id`,
      [data.firmId, data.email, data.fullName, data.role]
    );
    const user = await this.findById(client, result.rows[0].id);
    if (!user) throw new Error("Falha ao recarregar usuário recém-criado.");
    return user;
  },

  async createWithPassword(client: PoolClient, data: {
    firmId: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
    authProvider: string;
    passwordHash: string;
    phone?: string | null;
  }): Promise<UserRowWithFirm> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO users (firm_id, email, full_name, role, status, password_hash, auth_provider, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        data.firmId,
        data.email,
        data.fullName,
        data.role,
        data.status,
        data.passwordHash,
        data.authProvider,
        data.phone ?? null,
      ]
    );
    const user = await this.findById(client, result.rows[0].id);
    if (!user) throw new Error("Falha ao recarregar usuário recém-criado.");
    return user;
  },
};
