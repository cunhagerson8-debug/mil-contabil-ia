import React, { useState } from "react";
import {
  ShieldCheck, Check, X as XIcon, Info, Lock,
} from "lucide-react";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, UserRole } from "../auth/types";
import { SECTION_ACCESS, SECTION_LABELS, canAccessSection } from "../../architecture/access-control";
import { AppSection } from "../../types";
import { useAuth } from "../auth/AuthContext";

// =============================================================================
// Gestão de Papéis (Role Management)
// -----------------------------------------------------------------------------
// Esta tela é informativa/de referência: mostra a matriz de permissões já
// aplicada pela plataforma (SECTION_ACCESS, em architecture/access-control.tsx)
// e, para cada papel, se o acesso de escrita às áreas operacionais segue o
// padrão "staff" (firm_owner/accountant) ou "somente leitura" (portal do
// cliente) — espelhando exatamente os pares de policy
// "<tabela>_select" / "<tabela>_write_staff_only" do banco
// (database/migrations/011_row_level_security.sql).
//
// Os papéis em si são um enum fixo no banco (user_role) — não uma tabela
// editável — então esta tela NÃO permite criar/excluir papéis. O que um
// firm_owner pode fazer é atribuir um papel existente a um usuário (isso
// acontece em Usuarios.tsx, no convite/edição); aqui ele só consulta o que
// cada papel concede.
// =============================================================================

const ALL_ROLES: UserRole[] = ["platform_admin", "firm_owner", "accountant", "company_manager", "company_user"];

const ROLE_BADGE: Record<UserRole, string> = {
  platform_admin:  "bg-violet-50 text-violet-700 border-violet-200",
  firm_owner:      "bg-blue-50 text-blue-700 border-blue-200",
  accountant:      "bg-teal-50 text-teal-700 border-teal-200",
  company_manager: "bg-amber-50 text-amber-700 border-amber-200",
  company_user:    "bg-slate-100 text-slate-600 border-slate-200",
};

// Áreas operacionais com distinção real leitura/escrita no banco (ver
// *_write_staff_only nas policies). Demais seções (Dashboard, Perfil, IA,
// Notícias) são as mesmas para todo mundo que tem acesso — não exibidas
// nesta segunda matriz para não diluir o que importa.
const WRITE_SCOPED_SECTIONS: AppSection[] = [
  AppSection.EMPRESAS,
  AppSection.CLIENTES,
  AppSection.OBRIGACOES_FISCAIS,
  AppSection.NOTAS_FISCAIS,
  AppSection.PORTAL_CLIENTE,
  AppSection.USUARIOS,
];

// firm_owner e accountant têm escrita plena (staff). company_manager tem uma
// excessão pontual (pode marcar guia como paga — portal_guides_update_by_client),
// mas no agregado por área ainda é "somente leitura" com uma ação operacional
// específica, não escrita geral — refletido como "Leitura + ação limitada".
type WriteLevel = "Escrita completa" | "Leitura + ação limitada" | "Somente leitura" | "Sem acesso";

function writeLevelFor(role: UserRole, section: AppSection): WriteLevel {
  if (!canAccessSection(role, section)) return "Sem acesso";
  if (role === "platform_admin") return "Escrita completa";
  if (role === "firm_owner") return "Escrita completa";
  if (role === "accountant") {
    // accountant não convida/exclui usuários (USUARIOS é visível só a
    // firm_owner/platform_admin pela própria SECTION_ACCESS, então este
    // branch só é avaliado quando a seção já permitiu o role).
    return "Escrita completa";
  }
  if (role === "company_manager") {
    if (section === AppSection.PORTAL_CLIENTE) return "Leitura + ação limitada"; // marcar guia como paga
    return "Somente leitura";
  }
  // company_user
  return "Somente leitura";
}

const WRITE_LEVEL_STYLE: Record<WriteLevel, string> = {
  "Escrita completa":          "bg-emerald-50 text-emerald-700",
  "Leitura + ação limitada":   "bg-amber-50 text-amber-700",
  "Somente leitura":           "bg-slate-100 text-slate-500",
  "Sem acesso":                "bg-slate-50 text-slate-300",
};

export default function RoleManagement() {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(ALL_ROLES[1]);

  const allSections = Object.keys(SECTION_LABELS) as AppSection[];

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Papéis</h1>
        <p className="text-sm text-slate-500">
          Referência de permissões por papel. A atribuição de papel a um usuário é feita em{" "}
          <span className="font-semibold text-slate-600">Usuários</span>.
        </p>
      </div>

      <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <Lock size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Os papéis são fixos na plataforma (não é possível criar papéis personalizados). Cada permissão exibida
          aqui também é aplicada como regra de segurança no banco de dados — esta tela é apenas a consulta dessas regras.
        </p>
      </div>

      {/* Role selector chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        {ALL_ROLES.map((role) => (
          <button
            key={role}
            onClick={() => setSelectedRole(role)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
              selectedRole === role
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200"
                : "bg-white border-slate-200 text-slate-500 hover:border-blue-200"
            }`}
          >
            {ROLE_LABELS[role]}
            {user?.role === role && <span className="ml-1.5 opacity-70">(você)</span>}
          </button>
        ))}
      </div>

      {/* Selected role detail card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2.5 rounded-xl border ${ROLE_BADGE[selectedRole]}`}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{ROLE_LABELS[selectedRole]}</h2>
            <p className="text-sm text-slate-500">{ROLE_DESCRIPTIONS[selectedRole]}</p>
          </div>
        </div>

        {/* Section access grid */}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mt-5">
          Seções acessíveis
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allSections.map((section) => {
            const has = canAccessSection(selectedRole, section);
            return (
              <div
                key={section}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                  has ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"
                }`}
              >
                {has ? <Check size={13} className="shrink-0" /> : <XIcon size={13} className="shrink-0" />}
                <span className="truncate">{SECTION_LABELS[section]}</span>
              </div>
            );
          })}
        </div>

        {/* Write-level detail for operational areas */}
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 mt-6">
          Nível de permissão nas áreas operacionais
        </p>
        <div className="space-y-2">
          {WRITE_SCOPED_SECTIONS.map((section) => {
            const level = writeLevelFor(selectedRole, section);
            return (
              <div key={section} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-semibold text-slate-700">{SECTION_LABELS[section]}</span>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${WRITE_LEVEL_STYLE[level]}`}>
                  {level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparative matrix across all roles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-5 border-b border-slate-100">
          <Info size={16} className="text-slate-400" />
          <h3 className="font-bold text-slate-800">Comparativo entre papéis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left font-black text-[10px] text-slate-400 uppercase tracking-widest px-5 py-3">Seção</th>
                {ALL_ROLES.map((role) => (
                  <th key={role} className="text-center font-black text-[10px] text-slate-400 uppercase tracking-widest px-3 py-3 whitespace-nowrap">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSections.map((section, idx) => (
                <tr key={section} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                  <td className="px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">{SECTION_LABELS[section]}</td>
                  {ALL_ROLES.map((role) => (
                    <td key={role} className="text-center px-3 py-3">
                      {canAccessSection(role, section) ? (
                        <Check size={15} className="text-emerald-500 inline" />
                      ) : (
                        <XIcon size={15} className="text-slate-200 inline" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
