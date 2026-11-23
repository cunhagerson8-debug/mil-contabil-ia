import { PoolClient } from "pg";
import {
  ManagedUserRow,
  UserCompanyAccessRow,
  UserCompanyHrPermissionRow,
} from "../types/db.js";
import type { HrPermission } from "../types/hr-permissions.js";

const MANAGED_USER_SELECT = `
  SELECT u.id, u.firm_id, u.role, u.status, u.full_name, u.email, u.phone,
         u.avatar_url, u.mfa_enabled, u.last_login_at, u.created_at,
         u.invited_at, f.name AS firm_name, inviter.full_name AS invited_by
  FROM users u
  LEFT JOIN firms f ON f.id = u.firm_id
  LEFT JOIN users inviter ON inviter.id = u.invited_by
`;

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
}

interface InvitationData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdBy: string;
}

export const userManagementRepository = {
  async findAll(client: PoolClient, filters: UserFilters = {}): Promise<ManagedUserRow[]> {
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
      ${MANAGED_USER_SELECT}
      ${where}
      ORDER BY u.full_name ASC
    `;
    const result = await client.query<ManagedUserRow>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<ManagedUserRow | null> {
    const result = await client.query<ManagedUserRow>(
      `${MANAGED_USER_SELECT} WHERE u.id = $1`,
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

  async findHrPermissions(client: PoolClient, userId: string): Promise<UserCompanyHrPermissionRow[]> {
    const result = await client.query<UserCompanyHrPermissionRow>(
      `SELECT user_id, company_id, can_read_employees, can_read_sensitive_data,
              can_read_documents, can_manage_employees, can_manage_documents,
              granted_by, granted_at, updated_at
       FROM user_company_hr_permissions
       WHERE user_id = $1
       ORDER BY company_id`,
      [userId]
    );
    return result.rows;
  },

  async replaceHrPermissions(
    client: PoolClient,
    data: {
      userId: string;
      companyId: string;
      grantedBy: string;
      permissions: HrPermission[];
    },
  ): Promise<void> {
    const granted = new Set(data.permissions);
    const values = [
      data.userId,
      data.companyId,
      grantedByPermission(granted, "employee.read"),
      grantedByPermission(granted, "employee.sensitive.read"),
      grantedByPermission(granted, "employee.documents.read"),
      grantedByPermission(granted, "employee.manage"),
      grantedByPermission(granted, "employee.documents.manage"),
      data.grantedBy,
    ];

    if (data.permissions.length === 0) {
      await client.query(
        `DELETE FROM user_company_hr_permissions WHERE user_id = $1 AND company_id = $2`,
        values.slice(0, 2),
      );
      return;
    }

    await client.query(
      `INSERT INTO user_company_hr_permissions (
         user_id, company_id, can_read_employees, can_read_sensitive_data,
         can_read_documents, can_manage_employees, can_manage_documents, granted_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, company_id) DO UPDATE SET
         can_read_employees = EXCLUDED.can_read_employees,
         can_read_sensitive_data = EXCLUDED.can_read_sensitive_data,
         can_read_documents = EXCLUDED.can_read_documents,
         can_manage_employees = EXCLUDED.can_manage_employees,
         can_manage_documents = EXCLUDED.can_manage_documents,
         granted_by = EXCLUDED.granted_by,
         updated_at = now()`,
      values,
    );
  },

  async revokePendingInvitations(client: PoolClient, userId: string): Promise<void> {
    await client.query(
      `UPDATE user_invitations
       SET revoked_at = now()
       WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
      [userId]
    );
  },

  async createInvitation(client: PoolClient, data: InvitationData): Promise<void> {
    await this.revokePendingInvitations(client, data.userId);
    await client.query(
      `INSERT INTO user_invitations (user_id, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4)`,
      [data.userId, data.tokenHash, data.expiresAt, data.createdBy]
    );
  },

  async updateStatus(client: PoolClient, id: string, status: string): Promise<ManagedUserRow | null> {
    await client.query(`UPDATE users SET status = $1 WHERE id = $2`, [status, id]);
    return this.findById(client, id);
  },

  async updateRole(client: PoolClient, id: string, role: string): Promise<ManagedUserRow | null> {
    await client.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, id]);
    return this.findById(client, id);
  },

  async invite(client: PoolClient, data: {
    firmId: string;
    email: string;
    fullName: string;
    role: string;
    invitedBy: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ManagedUserRow> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO users (firm_id, email, full_name, role, status, auth_provider, invited_by, invited_at)
       VALUES ($1,$2,$3,$4,'invited','email',$5,now()) RETURNING id`,
      [data.firmId, data.email, data.fullName, data.role, data.invitedBy]
    );
    await this.createInvitation(client, {
      userId: result.rows[0].id,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      createdBy: data.invitedBy,
    });
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
  }): Promise<ManagedUserRow> {
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

function grantedByPermission(
  permissions: Set<HrPermission>,
  permission: HrPermission,
): boolean {
  return permissions.has(permission);
}
