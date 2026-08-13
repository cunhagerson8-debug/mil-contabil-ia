// =============================================================================
// Mapeamento User/Auth: linha do banco <-> DTO de API.
// =============================================================================
import { UserRowWithFirm, UserCompanyAccessRow } from "../types/db.js";
import { AuthUserDto } from "../types/dto.js";

export function toAuthUserDto(row: UserRowWithFirm, companyAccess: UserCompanyAccessRow[]): AuthUserDto {
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
  };
}
