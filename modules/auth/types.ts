// =============================================================================
// Módulo: Auth
// Espelha o enum user_role do banco (database/migrations/001_extensions_and_enums.sql)
// e o modelo de sessão descrito em database/README.md §4 (Modelo de autenticação).
// =============================================================================

export type UserRole =
  | "platform_admin"
  | "firm_owner"
  | "accountant"
  | "company_manager"
  | "company_user";

export interface RegisterFirmInput {
  name: string;
  tradeName?: string;
  cnpj: string;
  email: string;
  phone?: string;
  timezone?: string;
}

export interface RegisterAdminInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface RegisterInput {
  firm: RegisterFirmInput;
  admin: RegisterAdminInput;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin:   "Platform Admin",
  firm_owner:       "Dono do Escritório",
  accountant:       "Contador",
  company_manager:  "Gestor da Empresa",
  company_user:     "Usuário da Empresa",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  platform_admin:  "Acesso global à plataforma MIL Contábil IA — gerencia escritórios, planos e billing agregado.",
  firm_owner:      "Acesso total ao escritório: empresas, clientes, usuários, billing e auditoria.",
  accountant:      "Acesso operacional ao escritório: empresas, clientes, obrigações e notas fiscais.",
  company_manager: "Acesso de gestão à(s) empresa(s) vinculada(s) via Portal do Cliente.",
  company_user:    "Acesso de leitura/operação limitada à(s) empresa(s) vinculada(s) via Portal do Cliente.",
};

export type UserStatus = "active" | "invited" | "suspended" | "deactivated";

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Ativo",
  invited: "Convidado",
  suspended: "Suspenso",
  deactivated: "Desativado",
};

// -----------------------------------------------------------------------------
// AuthUser — formato de sessão autenticada (espelha users + user_company_access)
// -----------------------------------------------------------------------------
export interface AuthUser {
  id: string;
  firmId: string | null;        // null apenas para platform_admin
  firmName?: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  email: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  /** IDs das empresas que este usuário pode acessar (company_manager / company_user).
   *  Vazio/undefined para firm_owner e accountant sem restrição de carteira = acesso a todas as empresas do firm. */
  companyAccess?: string[];
  /** Se true, dentro das empresas de companyAccess o usuário pode realizar ações de gestão (espelha user_company_access.can_manage). */
  canManageCompanies?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;        // mock — em produção seria JWT de acesso de curta duração
  expiresAt: string;
}
