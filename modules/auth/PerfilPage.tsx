import React, { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, Mail, Phone, Building2,
  LogOut, Save, KeyRound, Smartphone,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "./types";
import { companiesApi } from "../../services/companiesApi";
import { Company } from "../empresas/types";

export default function PerfilPage() {
  const { user, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [saved, setSaved] = useState(false);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);

  useEffect(() => {
    companiesApi.list().then(setAllCompanies).catch(() => {});
  }, []);

  if (!user) return null;

  const accessibleCompanies = (user.companyAccess ?? [])
    .map((id) => allCompanies.find((c) => c.id === id))
    .filter(Boolean);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Meu Perfil</h1>
        <p className="text-sm text-slate-500">Gerencie suas informações pessoais e configurações de acesso</p>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl shrink-0">
          {user.fullName.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">{user.fullName}</h2>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
              {ROLE_LABELS[user.role]}
            </span>
            {user.firmName && (
              <span className="text-[10px] font-semibold text-slate-400">{user.firmName}</span>
            )}
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors shrink-0"
        >
          <LogOut size={14} /> Sair
        </button>
      </div>

      {/* Role description */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sua função na plataforma</p>
        <p className="text-sm text-slate-600">{ROLE_DESCRIPTIONS[user.role]}</p>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 space-y-4">
        <h3 className="font-bold text-slate-800 mb-2">Informações pessoais</h3>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome completo</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Mail size={11} /> E-mail
            </label>
            <input value={user.email} disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Phone size={11} /> Telefone
            </label>
            <input placeholder="(11) 90000-0000" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          {saved && <p className="text-xs font-bold text-emerald-600">Alterações salvas.</p>}
          <button type="submit" className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
            <Save size={14} /> Salvar alterações
          </button>
        </div>
      </form>

      {/* Security */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6 space-y-4">
        <h3 className="font-bold text-slate-800 mb-2">Segurança</h3>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-3">
            <KeyRound size={18} className="text-slate-400" />
            <div>
              <p className="text-sm font-bold text-slate-800">Senha</p>
              <p className="text-xs text-slate-500">Última alteração há mais de 90 dias</p>
            </div>
          </div>
          <button className="text-xs font-black text-blue-600 hover:text-blue-800">Alterar</button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div className="flex items-center gap-3">
            <Smartphone size={18} className="text-slate-400" />
            <div>
              <p className="text-sm font-bold text-slate-800">Autenticação em duas etapas (MFA)</p>
              <p className="text-xs text-slate-500">
                {user.mfaEnabled ? "Ativada via aplicativo autenticador" : "Recomendamos ativar para maior segurança"}
              </p>
            </div>
          </div>
          {user.mfaEnabled ? (
            <span className="flex items-center gap-1 text-xs font-black text-emerald-600">
              <ShieldCheck size={14} /> Ativo
            </span>
          ) : (
            <button className="flex items-center gap-1 text-xs font-black text-amber-600">
              <ShieldAlert size={14} /> Ativar
            </button>
          )}
        </div>
      </div>

      {/* Company access (only relevant for portal roles or restricted accountant) */}
      {(user.role === "company_manager" || user.role === "company_user" || accessibleCompanies.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" /> Empresas que você acessa
          </h3>
          {accessibleCompanies.length > 0 ? (
            <div className="space-y-2">
              {accessibleCompanies.map((c) => (
                <div key={c!.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <p className="text-sm font-semibold text-slate-800">{c!.nomeFantasia}</p>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">
                    {c!.regime}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Acesso a todas as empresas do escritório.</p>
          )}
        </div>
      )}
    </div>
  );
}
