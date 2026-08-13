import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, AlertTriangle, XCircle, Plus,
  ChevronRight, X, Wifi, WifiOff, RefreshCw,
  ClipboardList, Loader2, AlertCircle, RotateCcw, Trash2,
} from "lucide-react";
import { TaxObligation, ObligationStatus, ObligationType, ObligationPeriodicity } from "./types";
import { taxObligationsApi, TaxObligationCreateInput } from "../../services/taxObligationsApi";
import { companiesApi } from "../../services/companiesApi";
import { Company } from "../empresas/types";
import { ApiError } from "../../services/apiClient";

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ObligationStatus, { label: string; icon: React.ElementType; ring: string; badge: string }> = {
  "Em Dia":                 { label: "Em Dia",                 icon: CheckCircle2,   ring: "border-emerald-200", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Próxima do Vencimento":  { label: "Próxima do Vencimento",  icon: AlertTriangle,  ring: "border-amber-200",   badge: "bg-amber-50 text-amber-700 border-amber-200" },
  "Vencida":                { label: "Vencida",                icon: XCircle,        ring: "border-red-200",     badge: "bg-red-50 text-red-700 border-red-200" },
  "Não Aplicável":          { label: "Não Aplicável",          icon: CheckCircle2,   ring: "border-slate-200",   badge: "bg-slate-100 text-slate-500 border-slate-200" },
};

const TYPE_COLOR: Record<ObligationType, string> = {
  DAS:           "bg-violet-50 text-violet-700",
  PGDAS:         "bg-violet-50 text-violet-600",
  DCTFWeb:       "bg-blue-50 text-blue-700",
  "EFD-Reinf":   "bg-indigo-50 text-indigo-700",
  eSocial:       "bg-teal-50 text-teal-700",
  "FGTS Digital":"bg-emerald-50 text-emerald-700",
  ECD:           "bg-slate-100 text-slate-700",
  ECF:           "bg-slate-100 text-slate-600",
  Certidão:      "bg-amber-50 text-amber-700",
  DARF:          "bg-orange-50 text-orange-700",
  GRF:           "bg-pink-50 text-pink-700",
  GFIP:          "bg-rose-50 text-rose-700",
};

const TYPE_OPTIONS: ObligationType[] = ["DAS", "PGDAS", "DCTFWeb", "EFD-Reinf", "eSocial", "FGTS Digital", "ECD", "ECF", "Certidão", "DARF", "GRF", "GFIP"];
const PERIODICITY_OPTIONS: ObligationPeriodicity[] = ["Mensal", "Trimestral", "Anual", "Eventual"];

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// ── Formulário de Criar/Editar ───────────────────────────────────────────────

interface ObligationFormState {
  companyId: string;
  nome: string;
  type: ObligationType;
  competencia: string;
  vencimento: string;
  valor: string;
  observacoes: string;
  periodicidade: ObligationPeriodicity;
}

function emptyForm(defaultCompanyId: string): ObligationFormState {
  return { companyId: defaultCompanyId, nome: "", type: "DAS", competencia: "", vencimento: "", valor: "", observacoes: "", periodicidade: "Mensal" };
}

function ObligationFormModal({
  initial, companies, defaultCompanyId, onClose, onSaved,
}: { initial?: TaxObligation; companies: Company[]; defaultCompanyId: string; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!initial;
  const [form, setForm] = useState<ObligationFormState>(
    initial ? {
      companyId: initial.companyId, nome: initial.nome, type: initial.type, competencia: initial.competencia,
      vencimento: initial.vencimento, valor: initial.valor !== undefined ? String(initial.valor) : "",
      observacoes: initial.observacoes ?? "", periodicidade: initial.periodicidade,
    } : emptyForm(defaultCompanyId)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ObligationFormState>(key: K, value: ObligationFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: TaxObligationCreateInput = {
        companyId: form.companyId,
        nome: form.nome,
        type: form.type,
        competencia: form.competencia,
        vencimento: form.vencimento,
        valor: form.valor ? Number(form.valor) : undefined,
        observacoes: form.observacoes || undefined,
        periodicidade: form.periodicidade,
      };
      if (isEdit) {
        await taxObligationsApi.update(initial!.id, input);
      } else {
        await taxObligationsApi.create(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a obrigação. Tente novamente.");
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
          <h3 className="text-lg font-bold text-slate-900">{isEdit ? "Editar Obrigação" : "Nova Obrigação"}</h3>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Empresa</label>
            <select required value={form.companyId} onChange={(e) => update("companyId", e.target.value)} disabled={isEdit}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60">
              <option value="" disabled>Selecione...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da obrigação</label>
            <input required value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Ex: DAS – Simples Nacional"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo</label>
              <select value={form.type} onChange={(e) => update("type", e.target.value as ObligationType)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Periodicidade</label>
              <select value={form.periodicidade} onChange={(e) => update("periodicidade", e.target.value as ObligationPeriodicity)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                {PERIODICITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Competência</label>
              <input required value={form.competencia} onChange={(e) => update("competencia", e.target.value)} placeholder="MM/AAAA"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vencimento</label>
              <input required type="date" value={form.vencimento} onChange={(e) => update("vencimento", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => update("valor", e.target.value)} placeholder="0,00"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Observações</label>
              <textarea rows={2} value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !form.companyId} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? "Salvar Alterações" : "Cadastrar Obrigação"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Confirmação de exclusão ──────────────────────────────────────────────────

function DeleteConfirmModal({ ob, onClose, onDeleted }: { ob: TaxObligation; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await taxObligationsApi.remove(ob.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir a obrigação.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Excluir obrigação?</h3>
        <p className="text-sm text-slate-500 mb-1">
          Tem certeza que deseja excluir <span className="font-bold text-slate-700">{ob.nome}</span> ({ob.competencia})?
        </p>
        <p className="text-xs text-slate-400 mb-5">
          Obrigações já pagas não podem ser excluídas — apenas lançamentos incorretos antes do pagamento.
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

// ── Drawer ───────────────────────────────────────────────────────────────────

const ObrigacaoDrawer = ({
  ob, companies, onClose, onEdit, onDelete, onMarkPaid, markingPaid,
}: {
  ob: TaxObligation; companies: Company[]; onClose: () => void; onEdit: () => void;
  onDelete: () => void; onMarkPaid: () => void; markingPaid: boolean;
}) => {
  const sc = STATUS_CONFIG[ob.status];
  const StatusIcon = sc.icon;
  const company = companies.find((c) => c.id === ob.companyId);
  const days = daysUntil(ob.vencimento);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white">
          <div>
            <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">{ob.type}</p>
            <h3 className="text-xl font-bold text-slate-900">{ob.nome}</h3>
            <p className="text-sm text-slate-500">{company?.nomeFantasia ?? ob.companyId} · {ob.competencia}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-2">
            <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">
              Editar
            </button>
            <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
              <Trash2 size={14} /> Excluir
            </button>
          </div>

          <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 ${sc.ring} bg-white`}>
            <StatusIcon size={22} className={ob.status === "Em Dia" ? "text-emerald-500" : ob.status === "Vencida" ? "text-red-500" : "text-amber-500"} />
            <div>
              <p className="font-bold text-slate-800">{sc.label}</p>
              <p className="text-sm text-slate-500">
                Vencimento: {fmt(ob.vencimento)}
                {days < 0 ? ` (${Math.abs(days)}d em atraso)` : days <= 30 ? ` (em ${days}d)` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {ob.valor !== undefined && (
              <div className="col-span-2 p-4 bg-slate-50 rounded-xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor</p>
                <p className="text-2xl font-black text-slate-900">
                  {ob.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Competência</p>
              <p className="text-sm font-semibold text-slate-800">{ob.competencia}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Periodicidade</p>
              <p className="text-sm font-semibold text-slate-800">{ob.periodicidade}</p>
            </div>
          </div>

          {ob.integrationSource && (
            <div className="flex items-center gap-2.5 p-3 bg-teal-50 rounded-xl border border-teal-200">
              <Wifi size={15} className="text-teal-600 shrink-0" />
              <div>
                <p className="text-xs font-black text-teal-700">Integrado via {ob.integrationSource}</p>
                {ob.integrationRef && <p className="text-[10px] text-teal-600 font-mono">{ob.integrationRef}</p>}
              </div>
            </div>
          )}

          {!ob.integrationSource && (
            <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <WifiOff size={15} className="text-slate-400 shrink-0" />
              <p className="text-xs font-semibold text-slate-500">Lançamento manual — sem integração ativa</p>
            </div>
          )}

          {ob.observacoes && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Observações</p>
              <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3">{ob.observacoes}</p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {ob.status !== "Em Dia" && ob.status !== "Não Aplicável" && (
              <button
                onClick={onMarkPaid}
                disabled={markingPaid}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {markingPaid && <Loader2 size={14} className="animate-spin" />}
                Marcar como Paga
              </button>
            )}
            <button className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
              <RefreshCw size={15} /> Sincronizar com {ob.integrationSource ?? "Fonte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = ObligationStatus | "Todas";

export default function ObrigacoesFiscais() {
  const [obligations, setObligations] = useState<TaxObligation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Todas");
  const [selected, setSelected] = useState<TaxObligation | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TaxObligation | null>(null);
  const [deleting, setDeleting] = useState<TaxObligation | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [obligationsData, companiesData] = await Promise.all([
        taxObligationsApi.list(),
        companiesApi.list(),
      ]);
      setObligations(obligationsData);
      setCompanies(companiesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar as obrigações. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => ({
    total:     obligations.length,
    emDia:     obligations.filter((o) => o.status === "Em Dia").length,
    proximas:  obligations.filter((o) => o.status === "Próxima do Vencimento").length,
    vencidas:  obligations.filter((o) => o.status === "Vencida").length,
  }), [obligations]);

  const filtered = useMemo(() => {
    return obligations.filter((o) => {
      const compMatch = companyFilter === "Todas" || o.companyId === companyFilter;
      const stMatch   = statusFilter  === "Todas" || o.status === statusFilter;
      return compMatch && stMatch;
    }).sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  }, [obligations, companyFilter, statusFilter]);

  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    setSelected(null);
    loadData();
  }

  function handleDeleted() {
    setDeleting(null);
    setSelected(null);
    loadData();
  }

  async function handleMarkPaid(ob: TaxObligation) {
    setMarkingPaidId(ob.id);
    try {
      await taxObligationsApi.markPaid(ob.id);
      setSelected(null);
      await loadData();
    } catch {
      // erro de marcar como pago: mantém o drawer aberto, o usuário pode tentar de novo
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Obrigações Fiscais</h1>
          <p className="text-sm text-slate-500">Acompanhamento de todas as obrigações acessórias e principais</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={companies.length === 0}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-60"
        >
          <Plus size={16} /> Nova Obrigação
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-slate-800", bg: "bg-slate-50 border-slate-200" },
          { label: "Em Dia", value: stats.emDia, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Próximas", value: stats.proximas, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
          { label: "Vencidas", value: stats.vencidas, color: "text-red-700", bg: "bg-red-50 border-red-200" },
        ].map((k) => (
          <div key={k.label} className={`p-4 rounded-2xl border ${k.bg}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="Todas">Todas as empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
        </select>
        <div className="flex gap-2 overflow-x-auto">
          {(["Todas", "Em Dia", "Próxima do Vencimento", "Vencida"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Carregando obrigações...
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-4">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
          <div>
            <button onClick={loadData} className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200">
              <RotateCcw size={14} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_auto] px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest gap-4">
            <span>Obrigação</span><span>Empresa</span><span>Competência</span><span>Vencimento</span><span>Valor</span><span>Status</span>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <ClipboardList size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {obligations.length === 0 ? "Nenhuma obrigação cadastrada ainda." : "Nenhuma obrigação encontrada"}
              </p>
            </div>
          )}

          {filtered.map((ob, idx) => {
            const sc = STATUS_CONFIG[ob.status];
            const StatusIcon = sc.icon;
            const company = companies.find((c) => c.id === ob.companyId);
            const days = daysUntil(ob.vencimento);

            return (
              <button
                key={ob.id}
                onClick={() => setSelected(ob)}
                className={`w-full text-left grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1.5fr_1fr_auto] items-center gap-2 md:gap-4 p-5 hover:bg-slate-50 transition-colors ${
                  idx !== filtered.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${TYPE_COLOR[ob.type]}`}>
                    {ob.type}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800 text-sm leading-tight">{ob.nome}</p>
                    {ob.integrationSource && (
                      <p className="text-[10px] text-teal-600 font-semibold flex items-center gap-1 mt-0.5">
                        <Wifi size={10} /> {ob.integrationSource}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600 font-medium hidden md:block">
                  {company?.nomeFantasia ?? "—"}
                </p>
                <p className="text-sm text-slate-600 hidden md:block">{ob.competencia}</p>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-slate-800">{fmt(ob.vencimento)}</p>
                  {days < 0
                    ? <p className="text-[10px] text-red-500 font-bold">{Math.abs(days)}d em atraso</p>
                    : days <= 30
                    ? <p className="text-[10px] text-amber-500 font-bold">em {days}d</p>
                    : null
                  }
                </div>
                <p className="text-sm font-bold text-slate-800 hidden md:block">
                  {ob.valor !== undefined
                    ? ob.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </p>
                <div className="flex items-center justify-between md:justify-end gap-3">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${sc.badge}`}>
                    <span className="hidden sm:inline">{sc.label}</span>
                    <StatusIcon size={12} className="sm:hidden" />
                  </span>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ObrigacaoDrawer
          ob={selected}
          companies={companies}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setShowForm(true); }}
          onDelete={() => setDeleting(selected)}
          onMarkPaid={() => handleMarkPaid(selected)}
          markingPaid={markingPaidId === selected.id}
        />
      )}
      {showForm && (
        <ObligationFormModal
          initial={editing ?? undefined}
          companies={companies}
          defaultCompanyId={companyFilter !== "Todas" ? companyFilter : (companies[0]?.id ?? "")}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <DeleteConfirmModal ob={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
