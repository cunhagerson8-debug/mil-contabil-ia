import React, { useEffect, useState } from "react";
import { Building2, Eye, Loader2, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { ApiError } from "../../services/apiClient";
import { firmsApi, Firm, FirmInput, FirmStatus } from "../../services/firmsApi";

const STATUS_LABELS: Record<FirmStatus, string> = {
  active: "Ativo", trial: "Em teste", suspended: "Suspenso", cancelled: "Cancelado",
};
const STATUS_STYLES: Record<FirmStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial: "bg-blue-50 text-blue-700 border-blue-200",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const emptyForm: FirmInput = {
  name: "", trade_name: "", cnpj: "", email: "", phone: "", timezone: "America/Sao_Paulo", status: "trial",
};

function formatDate(value: string) { return new Date(value).toLocaleDateString("pt-BR"); }

function FirmForm({ initial, onClose, onSaved }: { initial?: Firm; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FirmInput>(initial ? {
    name: initial.name, trade_name: initial.trade_name ?? "", cnpj: initial.cnpj, email: initial.email,
    phone: initial.phone ?? "", timezone: initial.timezone, status: initial.status,
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof FirmInput, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try { initial ? await firmsApi.update(initial.id, form) : await firmsApi.create(form); onSaved(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Não foi possível salvar o escritório."); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
    <form onSubmit={submit} onClick={(event) => event.stopPropagation()} className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 p-6"><div><p className="text-xs font-black uppercase tracking-widest text-blue-600">Administração</p><h2 className="text-xl font-black text-slate-900">{initial ? "Editar escritório" : "Novo escritório"}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
      <div className="space-y-4 p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
        <label className="block text-xs font-bold text-slate-500">Razão Social<input required minLength={2} value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        <label className="block text-xs font-bold text-slate-500">Nome Fantasia<input value={form.trade_name} onChange={(e) => update("trade_name", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-500">CNPJ<input required minLength={14} value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label><label className="block text-xs font-bold text-slate-500">E-mail<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-500">Telefone<input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label><label className="block text-xs font-bold text-slate-500">Timezone<input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label></div>
        <label className="block text-xs font-bold text-slate-500">Status<select value={form.status} onChange={(e) => update("status", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"><option value="active">Ativo</option><option value="trial">Em teste</option><option value="suspended">Suspenso</option><option value="cancelled">Cancelado</option></select></label>
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 p-6"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button><button disabled={saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}Salvar escritório</button></div>
    </form>
  </div>;
}

export default function Escritorios() {
  const [firms, setFirms] = useState<Firm[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [form, setForm] = useState<Firm | null | undefined>(undefined); const [selected, setSelected] = useState<Firm | null>(null);
  async function load() { setLoading(true); setError(null); try { setFirms(await firmsApi.list()); } catch (err) { setError(err instanceof ApiError ? err.message : "Não foi possível carregar os escritórios."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function changeStatus(firm: Firm) { const next: FirmStatus = firm.status === "active" ? "suspended" : "active"; try { await firmsApi.updateStatus(firm.id, next); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : "Não foi possível alterar o status."); } }
  return <section className="p-5 md:p-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-600">Gestão da plataforma</p><h1 className="text-3xl font-black text-slate-900">Escritórios Contábeis</h1><p className="mt-1 text-sm text-slate-500">Administre os escritórios clientes da MIL.</p></div><div className="flex gap-2"><button onClick={() => void load()} title="Atualizar lista" className="rounded-xl border border-slate-200 p-3 text-slate-500 hover:bg-white"><RefreshCw size={18} /></button><button onClick={() => setForm(null)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700"><Plus size={18} />Novo Escritório</button></div></div>
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400"><tr><th className="px-5 py-4">Razão Social</th><th className="px-5 py-4">Nome Fantasia</th><th className="px-5 py-4">CNPJ</th><th className="px-5 py-4">E-mail</th><th className="px-5 py-4">Telefone</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="p-12 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></td></tr> : firms.map((firm) => <tr key={firm.id} className="hover:bg-slate-50"><td className="px-5 py-4 text-sm font-bold text-slate-800">{firm.name}</td><td className="px-5 py-4 text-sm text-slate-600">{firm.trade_name || "-"}</td><td className="px-5 py-4 text-sm text-slate-600">{firm.cnpj}</td><td className="px-5 py-4 text-sm text-slate-600">{firm.email}</td><td className="px-5 py-4 text-sm text-slate-600">{firm.phone || "-"}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[firm.status]}`}>{STATUS_LABELS[firm.status]}</span></td><td className="px-5 py-4"><div className="flex gap-1"><button title="Visualizar" onClick={() => setSelected(firm)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye size={16} /></button><button title="Editar" onClick={() => setForm(firm)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Pencil size={16} /></button><button title={firm.status === "active" ? "Suspender" : "Ativar"} onClick={() => void changeStatus(firm)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Building2 size={16} /></button></div></td></tr>)}</tbody></table></div>{!loading && firms.length === 0 && <div className="p-12 text-center text-sm text-slate-500">Nenhum escritório cadastrado.</div>}</div>
    {form !== undefined && <FirmForm initial={form || undefined} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); void load(); }} />}{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setSelected(null)}><div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-blue-600">Escritório</p><h2 className="text-xl font-black text-slate-900">{selected.name}</h2></div><button onClick={() => setSelected(null)} className="p-2 text-slate-400"><X size={18} /></button></div><div className="space-y-3 text-sm"><p><b>Nome fantasia:</b> {selected.trade_name || "-"}</p><p><b>CNPJ:</b> {selected.cnpj}</p><p><b>E-mail:</b> {selected.email}</p><p><b>Telefone:</b> {selected.phone || "-"}</p><p><b>Timezone:</b> {selected.timezone}</p><p><b>Cadastrado em:</b> {formatDate(selected.created_at)}</p><p><b>Status:</b> {STATUS_LABELS[selected.status]}</p></div></div></div>}</section>;
}