// =============================================================================
// Módulo: Usuários (Gestão de Acessos)
// Espelha database/migrations/002_firms_and_users.sql (users, user_company_access)
// =============================================================================

import { UserRole, UserStatus } from "../auth/types";

export interface ManagedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  invitedAt?: string;
  invitedBy?: string;        // nome de quem convidou
  companyAccess?: string[];  // ids de empresas (company_manager / company_user, ou carteira restrita de accountant)
  canManageCompanies?: boolean;
  createdAt: string;
}
