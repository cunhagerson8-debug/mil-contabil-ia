import { AuthUser } from "./types";

// -----------------------------------------------------------------------------
// Usuários mock — um por role, para exercitar todos os caminhos de permissão.
// Senha mock para TODOS os usuários abaixo: "demo1234" (ver mockAuth.ts).
// IDs de empresa (companyAccess) referenciam modules/empresas/mockData.ts.
// -----------------------------------------------------------------------------

export const mockUsers: AuthUser[] = [
  {
    id: "user-platform-admin",
    firmId: null,
    role: "platform_admin",
    status: "active",
    fullName: "Gerson da Cunha",
    email: "gersondacunha@milaplicativo.com",
    mfaEnabled: true,
    lastLoginAt: "2026-06-22T09:14:00",
  },
  {
    id: "user-firm-owner",
    firmId: "firm-001",
    firmName: "Ferreira & Souza Contabilidade",
    role: "firm_owner",
    status: "active",
    fullName: "Ana Paula Ferreira",
    email: "ana.ferreira@ferreirasouza.com.br",
    mfaEnabled: true,
    lastLoginAt: "2026-06-23T08:02:00",
  },
  {
    id: "user-accountant",
    firmId: "firm-001",
    firmName: "Ferreira & Souza Contabilidade",
    role: "accountant",
    status: "active",
    fullName: "Carlos Eduardo Souza",
    email: "carlos.souza@ferreirasouza.com.br",
    mfaEnabled: false,
    lastLoginAt: "2026-06-23T07:40:00",
    // carteira restrita — só vê emp-002 e emp-004 (ver companies_select_firm_scoped no banco)
    companyAccess: ["emp-002", "emp-004"],
  },
  {
    id: "user-company-manager",
    firmId: "firm-001",
    firmName: "Ferreira & Souza Contabilidade",
    role: "company_manager",
    status: "active",
    fullName: "Fernanda Lima",
    email: "fernanda@techsolutions.com.br",
    mfaEnabled: false,
    lastLoginAt: "2026-06-20T15:21:00",
    companyAccess: ["emp-002"],
    canManageCompanies: true,
  },
  {
    id: "user-company-user",
    firmId: "firm-001",
    firmName: "Ferreira & Souza Contabilidade",
    role: "company_user",
    status: "active",
    fullName: "Rodrigo Almeida",
    email: "rodrigo@techsolutions.com.br",
    mfaEnabled: false,
    lastLoginAt: "2026-06-19T11:05:00",
    companyAccess: ["emp-002"],
    canManageCompanies: false,
  },
];

export const MOCK_PASSWORD = "demo1234";
