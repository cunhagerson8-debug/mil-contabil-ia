// =============================================================================
// MIL CONTÁBIL IA — Architecture: Access Control
// =============================================================================
// Matriz de permissões (role -> seções acessíveis) e componentes de guarda de
// rota/permissão. Espelha as RLS policies do banco (database/migrations/
// 011_row_level_security.sql) na camada de UI: a policy do Postgres é a
// fonte de verdade real (defesa em profundidade), este arquivo é a
// conveniência de UX que evita renderizar links/seções que o backend
// rejeitaria de qualquer forma.
//
// IMPORTANTE: isto NÃO substitui RLS. Mesmo que um bug aqui libere um botão
// indevido, a policy do banco continua bloqueando a query. Ver
// database/README.md §6.
// =============================================================================

import React from "react";
import { AppSection } from "../types";
import { UserRole } from "../modules/auth/types";
import { useAuth } from "../modules/auth/AuthContext";

// -----------------------------------------------------------------------------
// Matriz de acesso: AppSection -> roles autorizados
// -----------------------------------------------------------------------------
// Espelha o raciocínio das policies *_select / *_write_staff_only:
//   firm_owner, accountant  → equivalentes a "staff" no banco (acesso amplo
//                              ao firm, accountant sem billing/auditoria)
//   company_manager/user    → equivalentes ao acesso via user_company_access
//                              (Portal do Cliente apenas)
//   platform_admin          → BYPASSRLS no banco = acesso a tudo aqui também
export const SECTION_ACCESS: Record<AppSection, UserRole[]> = {
  [AppSection.DASHBOARD]:           ["platform_admin", "firm_owner", "accountant", "company_manager", "company_user"],
  [AppSection.EMPRESAS]:            ["platform_admin", "firm_owner", "accountant"],
  [AppSection.CLIENTES]:            ["platform_admin", "firm_owner", "accountant"],
  [AppSection.OBRIGACOES_FISCAIS]:  ["platform_admin", "firm_owner", "accountant"],
  [AppSection.NOTAS_FISCAIS]:       ["platform_admin", "firm_owner", "accountant"],
  [AppSection.ALERTAS]:             ["platform_admin", "firm_owner", "accountant"],
  [AppSection.PORTAL_CLIENTE]:      ["platform_admin", "firm_owner", "accountant", "company_manager", "company_user"],
  [AppSection.USUARIOS]:            ["platform_admin", "firm_owner"],
  [AppSection.GESTAO_PAPEIS]:       ["platform_admin", "firm_owner"],
  [AppSection.PERFIL]:              ["platform_admin", "firm_owner", "accountant", "company_manager", "company_user"],
  [AppSection.FISCAL]:              ["platform_admin", "firm_owner", "accountant"],
  [AppSection.CALCULATORS]:         ["platform_admin", "firm_owner", "accountant"],
  [AppSection.FOLHA_PAGAMENTO]:     ["platform_admin", "firm_owner", "accountant"],
  [AppSection.NEWS]:                ["platform_admin", "firm_owner", "accountant", "company_manager", "company_user"],
  [AppSection.AI_CHAT]:             ["platform_admin", "firm_owner", "accountant", "company_manager", "company_user"],
  [AppSection.ABERTURA_EMPRESA]:    ["platform_admin","firm_owner","accountant",],
  [AppSection.MIL_AUDITOR]: ["platform_admin"],
  [AppSection.ESCRITORIOS]: ["platform_admin"],
};

export function canAccessSection(role: UserRole, section: AppSection): boolean {
  return SECTION_ACCESS[section]?.includes(role) ?? false;
}

// -----------------------------------------------------------------------------
// Rótulos legíveis por seção — fonte única usada pela navegação (App.tsx) e
// pela tela de Gestão de Papéis (modules/usuarios/RoleManagement.tsx), para
// que ambos sempre exibam o mesmo nome para a mesma seção.
// -----------------------------------------------------------------------------
export const SECTION_LABELS: Record<AppSection, string> = {
  [AppSection.DASHBOARD]:           "Dashboard",
  [AppSection.EMPRESAS]:            "Empresas",
  [AppSection.CLIENTES]:            "Clientes",
  [AppSection.OBRIGACOES_FISCAIS]:  "Obrigações Fiscais",
  [AppSection.NOTAS_FISCAIS]:       "Emissão de Notas",
  [AppSection.ALERTAS]:             "Central de Alertas",
  [AppSection.PORTAL_CLIENTE]:      "Portal do Cliente",
  [AppSection.USUARIOS]:            "Usuários",
  [AppSection.GESTAO_PAPEIS]:       "Gestão de Papéis",
  [AppSection.PERFIL]:              "Meu Perfil",
  [AppSection.FISCAL]:              "Fiscal e Contábil",
  [AppSection.CALCULATORS]:         "Calculadoras",
  [AppSection.FOLHA_PAGAMENTO]:     "Folha de Pagamento",
  [AppSection.NEWS]:                "Notícias Contábeis",
  [AppSection.AI_CHAT]:             "MIL IA Contábil",
  [AppSection.ABERTURA_EMPRESA]: "Abertura de Empresa",
  [AppSection.MIL_AUDITOR]:         "MIL Auditor",
  [AppSection.ESCRITORIOS]:         "Escritórios Contábeis",
};


/** Subconjunto de seções acessíveis a um role — usado para filtrar a navegação. */
export function sectionsForRole(role: UserRole): AppSection[] {
  return (Object.keys(SECTION_ACCESS) as AppSection[]).filter((s) => canAccessSection(role, s));
}

// -----------------------------------------------------------------------------
// ProtectedRoute — gate de autenticação (não de permissão por role)
// -----------------------------------------------------------------------------
// Usado uma única vez, envolvendo todo o shell autenticado em App.tsx.
// Se não houver sessão, renderiza o fallback (tela de login) em vez dos
// children.
interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// -----------------------------------------------------------------------------
// PermissionGuard — gate de autorização por seção/role
// -----------------------------------------------------------------------------
// Usado para esconder/bloquear o ACESSO A UMA SEÇÃO específica (ex: um
// company_user tentando navegar para AppSection.EMPRESAS via URL direta ou
// estado manipulado). Renderiza um aviso de acesso negado em vez de
// silenciosamente esconder — diferente da navegação (que já filtra os
// botões via sectionsForRole), isto cobre o caso de alguém chegar à seção
// por outro caminho.
interface PermissionGuardProps {
  section: AppSection;
  children: React.ReactNode;
}

export function PermissionGuard({ section, children }: PermissionGuardProps) {
  const { user } = useAuth();

  if (!user) return null;

  if (!canAccessSection(user.role, section)) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="p-4 bg-red-50 rounded-2xl mb-4">
          <ShieldXIcon />
        </div>
        <h2 className="text-lg font-bold text-slate-700 mb-2">Acesso não autorizado</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          Sua função (<span className="font-bold text-slate-500">{user.role}</span>) não tem permissão
          para acessar esta área da plataforma.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// Ícone local minúsculo para não criar dependência circular de import com lucide-react
// dentro de architecture/ (mantém este arquivo autocontido como integrations.ts).
function ShieldXIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M9.5 9.5 14.5 14.5M14.5 9.5 9.5 14.5" />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Helper de tenancy: filtra uma lista de entidades com companyId pelo acesso
// do usuário atual — espelha o uso de app_user_has_company_access() no banco.
// -----------------------------------------------------------------------------
export function filterByCompanyAccess<T extends { companyId?: string }>(
  items: T[],
  canAccessCompany: (companyId: string) => boolean,
  role: UserRole
): T[] {
  // firm_owner/accountant sem restrição explícita veem tudo — refletido em
  // canAccessCompany() do AuthContext (mesma regra dos dois lados).
  if (role === "platform_admin") return items;
  return items.filter((item) => !item.companyId || canAccessCompany(item.companyId));
}
