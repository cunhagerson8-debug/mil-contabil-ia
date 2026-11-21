// =============================================================================
// Mapeamento User/Auth: linha do banco <-> DTO de API.
// =============================================================================
import { ManagedUserRow, UserCompanyHrPermissionRow, UserRowWithFirm, UserCompanyAccessRow } from "../types/db.js";
import { AuthUserDto, ManagedUserDto } from "../types/dto.js";
import type { HrCompanyPermissionGrant, HrPermission } from "../types/hr-permissions.js";

type AuthUserRow = Pick<
  UserRowWithFirm,
  "id" | "firm_id" | "role" | "status" | "full_name" | "email" | "firm_name" | "avatar_url" | "mfa_enabled" | "last_login_at"
>;

export function toAuthUserDto(
  row: AuthUserRow,
  companyAccess: UserCompanyAccessRow[],
  hrPermissions: UserCompanyHrPermissionRow[] = [],
): AuthUserDto {
  return {
    id: row.id,
    firmId: row.firm_id,
    firmName: row.firm_name ?? undefined,
    role: row.role,
    status: row.status,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url ?? undefined,
    mfaEnabled: row.mfa_enabled,
    lastLoginAt: row.last_login_at ?? undefined,
    companyAccess: companyAccess.length > 0 ? companyAccess.map((a) => a.company_id) : undefined,
    canManageCompanies: companyAccess.length > 0 ? companyAccess.some((a) => a.can_manage) : undefined,
    hrPermissions: toHrCompanyPermissionGrants(hrPermissions),
  };
}

export function toManagedUserDto(
  row: ManagedUserRow,
  hrPermissions: UserCompanyHrPermissionRow[] = [],
): ManagedUserDto {
  return {
    id: row.id,
    firmId: row.firm_id,
    firmName: row.firm_name ?? undefined,
    role: row.role,
    status: row.status,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    mfaEnabled: row.mfa_enabled,
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at,
    invitedAt: row.invited_at ?? undefined,
    invitedBy: row.invited_by ?? undefined,
    hrPermissions: toHrCompanyPermissionGrants(hrPermissions),
  };
}

function toHrCompanyPermissionGrants(rows: UserCompanyHrPermissionRow[]): HrCompanyPermissionGrant[] {
  return rows.map((row) => ({
    companyId: row.company_id,
    permissions: [
      row.can_read_employees ? "employee.read" : null,
      row.can_read_sensitive_data ? "employee.sensitive.read" : null,
      row.can_read_documents ? "employee.documents.read" : null,
      row.can_manage_employees ? "employee.manage" : null,
      row.can_manage_documents ? "employee.documents.manage" : null,
    ].filter((permission): permission is HrPermission => permission !== null),
  }));
}
