import React, { useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Search, X, ShieldCheck, Mail, Phone,
  ChevronRight, Clock, Ban, CheckCircle2, MoreVertical, Building2, Loader2,
} from "lucide-react";
import { ManagedUser } from "./types";
import { usersApi } from "../../services/usersApi";
import { companiesApi } from "../../services/companiesApi";
import { Company } from "../empresas/types";
import { ROLE_LABELS, USER_STATUS_LABELS, UserRole, UserStatus } from "../auth/types";
import { useAuth } from "../auth/AuthContext";

const STATUS_BADGE: Record<UserStatus, string> = {
  active:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  invited:     "bg-blue-50 text-blue-700 border-blue-200",
  suspended:   "bg-amber-50 text-amber-700 border-amber-200",
  deactivated: "bg-slate-100 text-slate-500 border-slate-200",
};

const ROLE_BADGE: Record<UserRole, string> = {
  platform_admin:  "bg-violet-50 text-violet-700",
  firm_owner:      "bg-blue-50 text-blue-700",
  accountant:      "bg-teal-50 text-teal-700",
  company_manager: "bg-amber-50 text-amber-700",
  company_user:    "bg-slate-100 text-slate-600",
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

// Adapter: backend DTO -> frontend ManagedUser shape
function adaptUser(dto: any): ManagedUser {
  return {
    id: dto.id,
    fullName: dto.fullName ?? dto.full_name ?? `${dto.firstName ?? ""} ${dto.lastName ?? ""}`.trim(),
    email: dto.email,
    phone: dto.phone,
    role: dto.role as UserRole,
    status: dto.status as UserStatus,
    mfaEnabled: dto.mfaEnabled ?? false,
    lastLoginAt: dto.lastLoginAt,
    createdAt: dto.createdAt,
    invitedAt: dto.invitedAt,
    invitedBy: dto.invitedBy,
    companyAccess: dto.companyAccess ?? [],
    canManageCompanies: dto.canManageCompanies,
  };
}

// -----------------------------------------------------------------------------
// Drawer de detalhe / edição
// -----------------------------------------------------------------------------
const UserDrawer = ({
  managedUser,
  companies,
  onClose,
  canManage,
}: {
  managedUser: ManagedUser;
  companies: Company[];
  onClose: () => void;
  canManage: boolean;
}) => {
  const userCompanies = (managedUser.companyAccess ?? [])
    .map((id) => companies.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg">
              {managedUser.fullName.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{managedUser.fullName}</h3>
              <p className="text-sm text-slate-500">{managedUser.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${ROLE_BADGE[managedUser.role]}`}>
              {ROLE_LABELS[managedUser.role]}
            </span>
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${STATUS_BADGE[managedUser.status]}`}>
              {USER_STATUS_LABELS[managedUser.status]}
            </span>
            {managedUser.mfaEnabled && (
              <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 flex items-center gap-1">
                <ShieldCheck size={11} /> MFA ativo
              </span>
            )}
          </div>

          <div className="space-y-2">
            {managedUser.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600"><Phone size={14} className="text-slate-400" /> {managedUser.phone}</div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600"><Mail size={14} className="text-slate-400" /> {managedUser.email}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Último acesso</p>
              <p className="text-sm font-semibold text-slate-800">{fmtDate(managedUser.lastLoginAt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {managedUser.status === "invited" ? "Convidado em" : "Na plataforma desde"}
              </p>
              <p className="text-sm font-semibold text-slate-800">{fmtDate(managedUser.invitedAt ?? managedUser.createdAt)}</p>
            </div>
            {managedUser.invitedBy && (
              <div className="col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Convidado por</p>
                <p className="text-sm font-semibold text-slate-800">{managedUser.invitedBy}</p>
              </div>
            )}
          </div>

          {(managedUser.role === "company_manager" || managedUser.role === "company_user" || userCompanies.length > 0) && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Building2 size={12} /> Acesso a empresas
              </p>
              {userCompanies.length > 0 ? (
                <div className="space-y-2">
                  {userCompanies.map((c) => (
                    <div key={c!.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-800">{c!.nomeFantasia}</p>
                      {managedUser.canManageCompanies !== undefined && (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${managedUser.canManageCompanies ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {managedUser.canManageCompanies ? "Gestão" : "Leitura"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Sem restrição — acesso a todas as empresas do escritório.</p>
              )}
            </div>
          )}

          {canManage && (
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
              {managedUser.status === "active" && (
                <button className="w-full py-3 border border-amber-200 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
                  <Ban size={15} /> Suspender acesso
                </button>
              )}
              {managedUser.status === "suspended" && (
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <CheckCircle2 size={15} /> Reativar acesso
                </button>
              )}
              {managedUser.status === "invited" && (
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <Mail size={15} /> Reenviar convite
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Modal de convite
// -----------------------------------------------------------------------------
const InviteUserModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Convidar usuário</h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome completo</label>
          <input placeholder="Nome do convidado" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">E-mail</label>
          <input type="email" placeholder="email@empresa.com.br" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Função</label>
          <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
            <option value="accountant">{ROLE_LABELS.accountant}</option>
            <option value="company_manager">{ROLE_LABELS.company_manager}</option>
            <option value="company_user">{ROLE_LABELS.company_user}</option>
          </select>
        </div>
        <p className="text-xs text-slate-400">
          Um e-mail de convite será enviado com instruções para criar a senha de acesso.
        </p>
      </div>
      <div className="p-6 border-t border-slate-100 flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
          Cancelar
        </button>
        <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
          Enviar convite
        </button>
      </div>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------------
export default function Usuarios() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "Todos">("Todos");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = user?.role === "firm_owner" || user?.role === "platform_admin";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [userData, compData] = await Promise.all([
          usersApi.list(),
          companiesApi.list(),
        ]);
        if (!cancelled) {
          setUsers(userData.map(adaptUser));
          setCompanies(compData);
        }
      } catch {
        // keep empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((u) => {
      const matchQ = u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === "Todos" || u.role === roleFilter;
      return matchQ && matchRole;
    });
  }, [query, roleFilter, users]);

  const roleOptions: (UserRole | "Todos")[] = ["Todos", "firm_owner", "accountant", "company_manager", "company_user"];

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Carregando usuários...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Usuários</h1>
          <p className="text-sm text-slate-500">Gestão de acessos do escritório e do portal do cliente</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            <Plus size={18} /> Convidar Usuário
          </button>
        )}
      </div>

      {!canManage && (
        <div className="mb-6 flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <ShieldCheck size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            Você tem acesso de visualização. Apenas o dono do escritório pode convidar, suspender ou reativar usuários.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {roleOptions.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                roleFilter === r ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500"
              }`}
            >
              {r === "Todos" ? "Todos" : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {filtered.map((u, idx) => (
          <button
            key={u.id}
            onClick={() => setSelected(u)}
            className={`w-full text-left flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${idx !== filtered.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0">
                {u.fullName.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{u.fullName}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg hidden sm:inline-block ${ROLE_BADGE[u.role]}`}>
                {ROLE_LABELS[u.role]}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${STATUS_BADGE[u.status]}`}>
                {USER_STATUS_LABELS[u.status]}
              </span>
              <ChevronRight size={16} className="text-slate-300" />
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Users size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {selected && <UserDrawer managedUser={selected} companies={companies} onClose={() => setSelected(null)} canManage={canManage} />}
      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
