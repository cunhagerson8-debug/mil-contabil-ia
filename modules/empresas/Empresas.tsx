import React, { useEffect, useMemo, useState } from "react";
import {
  Building2, Plus, Search, ShieldCheck, ShieldAlert, ChevronRight, X,
  Mail, Phone, MapPin, Users, Loader2, AlertCircle, Pencil, Trash2, RotateCcw,
} from "lucide-react";
import { Company, StatusEmpresa, RegimeTributario } from "./types";
import { companiesApi, CompanyCreateInput } from "../../services/companiesApi";
import { ApiError } from "../../services/apiClient";
import CompanyDrawer from "./components/CompanyDrawer.tsx";

const statusStyles: Record<StatusEmpresa, string> = {
  Ativa: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inativa: "bg-slate-100 text-slate-500 border-slate-200",
  "Em Abertura": "bg-blue-50 text-blue-700 border-blue-200",
  "Em Encerramento": "bg-amber-50 text-amber-700 border-amber-200",
};

const regimeStyles: Record<string, string> = {
  "Simples Nacional": "bg-violet-50 text-violet-700",
  "Lucro Presumido": "bg-blue-50 text-blue-700",
  "Lucro Real": "bg-slate-100 text-slate-700",
  MEI: "bg-teal-50 text-teal-700",
};

const REGIME_OPTIONS: RegimeTributario[] = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"];

function certificadoStatus(dateStr?: string) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Certificado vencido", tone: "text-red-600", icon: ShieldAlert };
  if (days <= 30) return { label: `Certificado vence em ${days}d`, tone: "text-amber-600", icon: ShieldAlert };
  return { label: "Certificado A1 válido", tone: "text-emerald-600", icon: ShieldCheck };
}

// -----------------------------------------------------------------------------
// Formulário de Criar/Editar
// -----------------------------------------------------------------------------
interface CompanyFormState {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  cnaeDescricao: string;
  regime: RegimeTributario;
  responsavel: string;
  dataAbertura: string;
  email: string;
  telefone: string;
  endereco: string;
}

const emptyForm: CompanyFormState = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", cnae: "", cnaeDescricao: "",
  regime: "Simples Nacional", responsavel: "", dataAbertura: "",
  email: "", telefone: "", endereco: "",
};

function CompanyFormModal({
  initial, onClose, onSaved,
}: { initial?: Company; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!initial;
  const [form, setForm] = useState<CompanyFormState>(
    initial ? {
      razaoSocial: initial.razaoSocial, nomeFantasia: initial.nomeFantasia, cnpj: initial.cnpj,
      cnae: initial.cnae, cnaeDescricao: initial.cnaeDescricao, regime: initial.regime,
      responsavel: initial.responsavel, dataAbertura: initial.dataAbertura,
      email: initial.email, telefone: initial.telefone, endereco: initial.endereco,
    } : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CompanyFormState>(key: K, value: CompanyFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: CompanyCreateInput = {
        razaoSocial: form.razaoSocial,
        nomeFantasia: form.nomeFantasia,
        cnpj: form.cnpj,
        cnae: form.cnae,
        cnaeDescricao: form.cnaeDescricao || undefined,
        regime: form.regime,
        responsavel: form.responsavel,
        dataAbertura: form.dataAbertura,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        endereco: form.endereco || undefined,
      };
      if (isEdit) {
        await companiesApi.update(initial!.id, input);
      } else {
        await companiesApi.create(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a empresa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-slate-900">{isEdit ? "Editar Empresa" : "Nova Empresa"}</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Razão Social</label>
              <input required value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome Fantasia</label>
              <input required value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">CNPJ</label>
              <input required value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Regime Tributário</label>
              <select value={form.regime} onChange={(e) => update("regime", e.target.value as RegimeTributario)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                {REGIME_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">CNAE</label>
              <input required value={form.cnae} onChange={(e) => update("cnae", e.target.value)} placeholder="0000-0/00"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data de Abertura</label>
              <input required type="date" value={form.dataAbertura} onChange={(e) => update("dataAbertura", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descrição do CNAE</label>
              <input value={form.cnaeDescricao} onChange={(e) => update("cnaeDescricao", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Responsável</label>
              <input required value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Telefone</label>
              <input value={form.telefone} onChange={(e) => update("telefone", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Endereço</label>
              <input value={form.endereco} onChange={(e) => update("endereco", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? "Salvar Alterações" : "Cadastrar Empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Confirmação de exclusão
// -----------------------------------------------------------------------------
function DeleteConfirmModal({ company, onClose, onDeleted }: { company: Company; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await companiesApi.remove(company.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir a empresa.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Excluir empresa?</h3>
        <p className="text-sm text-slate-500 mb-1">
          Tem certeza que deseja excluir <span className="font-bold text-slate-700">{company.nomeFantasia}</span>?
        </p>
        <p className="text-xs text-slate-400 mb-5">
          O registro será desativado e removido das listagens, mas o histórico fiscal é preservado para fins de auditoria.
        </p>
        {error && <p className="text-sm text-red-600 font-medium mb-4">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting && <Loader2 size={14} className="animate-spin" />} Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------------
export default function Empresas() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  async function loadCompanies() {
    setLoading(true);
    setError(null);
    try {
      const data = await companiesApi.list();
      setCompanies(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as empresas. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCompanies(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return companies.filter(
      (c) => c.nomeFantasia.toLowerCase().includes(q) || c.cnpj.includes(q) || c.razaoSocial.toLowerCase().includes(q)
    );
  }, [companies, query]);

  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    setSelected(null);
    loadCompanies();
  }

  function handleDeleted() {
    setDeleting(null);
    setSelected(null);
    loadCompanies();
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Empresas</h1>
          <p className="text-sm text-slate-500">Empresas clientes gerenciadas pelo escritório</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <Plus size={18} /> Nova Empresa
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome fantasia, razão social ou CNPJ..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Carregando empresas...
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-4">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
          <div>
            <button onClick={loadCompanies} className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200">
              <RotateCcw size={14} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company) => {
            const cert = certificadoStatus(company.certificadoDigitalValidade);
            return (
              <button
                key={company.id}
                onClick={() => setSelected(company)}
                className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Building2 size={20} />
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="font-bold text-slate-800 mb-0.5">{company.nomeFantasia}</h3>
                <p className="text-xs text-slate-500 mb-3 truncate">{company.cnpj}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${regimeStyles[company.regime]}`}>
                    {company.regime}
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${statusStyles[company.status]}`}>
                    {company.status}
                  </span>
                </div>
                {cert && (
                  <div className={`flex items-center gap-1.5 mt-3 text-xs font-semibold ${cert.tone}`}>
                    <cert.icon size={13} /> {cert.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {companies.length === 0 ? "Nenhuma empresa cadastrada ainda." : `Nenhuma empresa encontrada para "${query}"`}
          </p>
        </div>
      )}

      {selected && (
        <CompanyDrawer
          company={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setShowForm(true); }}
          onDelete={() => setDeleting(selected)}
        />
      )}
      {showForm && (
        <CompanyFormModal
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <DeleteConfirmModal company={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
