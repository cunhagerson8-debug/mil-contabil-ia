import React, { useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Search, ChevronRight, X, Mail, Phone, FileText, Clock, Star,
  Loader2, AlertCircle, Pencil, Trash2, RotateCcw,
} from "lucide-react";
import { Client, StatusCliente, TipoCliente } from "./types";
import { clientsApi, ClientCreateInput } from "../../services/clientsApi";
import { ApiError } from "../../services/apiClient";

const statusStyles: Record<StatusCliente, string> = {
  Ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inativo: "bg-slate-100 text-slate-500 border-slate-200",
  Prospecto: "bg-amber-50 text-amber-700 border-amber-200",
};

const historyTypeStyles: Record<string, string> = {
  Atendimento: "bg-blue-50 text-blue-600",
  Documento: "bg-violet-50 text-violet-600",
  Cobrança: "bg-amber-50 text-amber-600",
  Observação: "bg-slate-100 text-slate-600",
};

const TIPO_OPTIONS: TipoCliente[] = ["Pessoa Física", "Pessoa Jurídica"];

// -----------------------------------------------------------------------------
// Formulário de Criar/Editar
// -----------------------------------------------------------------------------
interface ClientFormState {
  nome: string;
  tipo: TipoCliente;
  documento: string;
  servicosContratadosText: string; // textarea, um por linha — convertido em array no submit
}

const emptyForm: ClientFormState = { nome: "", tipo: "Pessoa Física", documento: "", servicosContratadosText: "" };

function ClientFormModal({
  initial, onClose, onSaved,
}: { initial?: Client; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!initial;
  const [form, setForm] = useState<ClientFormState>(
    initial ? {
      nome: initial.nome, tipo: initial.tipo, documento: initial.documento,
      servicosContratadosText: initial.servicosContratados.join("\n"),
    } : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const servicos = form.servicosContratadosText.split("\n").map((s) => s.trim()).filter(Boolean);
      const input: ClientCreateInput = {
        nome: form.nome,
        tipo: form.tipo,
        documento: form.documento,
        servicosContratados: servicos,
      };
      if (isEdit) {
        await clientsApi.update(initial!.id, input);
      } else {
        await clientsApi.create(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o cliente. Tente novamente.");
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
          <h3 className="text-lg font-bold text-slate-900">{isEdit ? "Editar Cliente" : "Novo Cliente"}</h3>
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
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome / Razão Social</label>
            <input required value={form.nome} onChange={(e) => update("nome", e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo</label>
              <select value={form.tipo} onChange={(e) => update("tipo", e.target.value as TipoCliente)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Documento (CPF/CNPJ)</label>
              <input required value={form.documento} onChange={(e) => update("documento", e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Serviços contratados <span className="text-slate-300 normal-case">(um por linha)</span>
            </label>
            <textarea rows={3} value={form.servicosContratadosText} onChange={(e) => update("servicosContratadosText", e.target.value)}
              placeholder={"Contabilidade Mensal\nFolha de Pagamento"}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none" />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Confirmação de exclusão
// -----------------------------------------------------------------------------
function DeleteConfirmModal({ client, onClose, onDeleted }: { client: Client; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await clientsApi.remove(client.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível excluir o cliente.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Excluir cliente?</h3>
        <p className="text-sm text-slate-500 mb-1">
          Tem certeza que deseja excluir <span className="font-bold text-slate-700">{client.nome}</span>?
        </p>
        <p className="text-xs text-slate-400 mb-5">
          O cadastro será desativado, mas contatos, documentos e histórico permanecem preservados.
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
// Drawer de detalhe
// -----------------------------------------------------------------------------
const ClientDrawer = ({
  client, onClose, onEdit, onDelete,
}: { client: Client; onClose: () => void; onEdit: () => void; onDelete: () => void }) => (
  <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
      <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white">
        <div>
          <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">{client.tipo}</p>
          <h3 className="text-xl font-bold text-slate-900">{client.nome}</h3>
          <p className="text-sm text-slate-500">{client.documento}</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
          <X size={18} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">
            <Pencil size={14} /> Editar
          </button>
          <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors">
            <Trash2 size={14} /> Excluir
          </button>
        </div>

        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Serviços contratados</p>
          {client.servicosContratados.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {client.servicosContratados.map((s) => (
                <span key={s} className="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhum serviço contratado ainda</p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contatos</p>
          {client.contatos.length > 0 ? (
            <div className="space-y-2">
              {client.contatos.map((c) => (
                <div key={c.id} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-slate-800">{c.nome}</p>
                    {c.principal && <Star size={13} className="text-amber-400 fill-amber-400" />}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{c.cargo}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600"><Mail size={12} /> {c.email}</div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1"><Phone size={12} /> {c.telefone}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhum contato cadastrado</p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <FileText size={12} /> Documentos
          </p>
          {client.documentos.length > 0 ? (
            <div className="space-y-2">
              {client.documentos.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{d.nome}</p>
                    <p className="text-xs text-slate-500">{d.tipo} · {new Date(d.dataUpload).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {d.validade && (
                    <span className="text-[10px] font-bold text-slate-400">
                      até {new Date(d.validade).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhum documento anexado</p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Clock size={12} /> Histórico
          </p>
          {client.historico.length > 0 ? (
            <div className="space-y-3">
              {client.historico.map((h) => (
                <div key={h.id} className="flex gap-3">
                  <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-lg h-fit ${historyTypeStyles[h.tipo]}`}>
                    {h.tipo}
                  </span>
                  <div>
                    <p className="text-sm text-slate-700">{h.descricao}</p>
                    <p className="text-xs text-slate-400">{new Date(h.data).toLocaleDateString("pt-BR")} · {h.responsavel}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhum histórico registrado</p>
          )}
        </div>
      </div>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Página principal
// -----------------------------------------------------------------------------
export default function Clientes() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusCliente | "Todos">("Todos");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  async function loadClients() {
    setLoading(true);
    setError(null);
    try {
      const data = await clientsApi.list();
      setClients(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os clientes. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return clients.filter((c) => {
      const matchesQuery = c.nome.toLowerCase().includes(q) || c.documento.includes(q);
      const matchesStatus = filterStatus === "Todos" || c.status === filterStatus;
      return matchesQuery && matchesStatus;
    });
  }, [clients, query, filterStatus]);

  function handleSaved() {
    setShowForm(false);
    setEditing(null);
    setSelected(null);
    loadClients();
  }

  function handleDeleted() {
    setDeleting(null);
    setSelected(null);
    loadClients();
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Clientes</h1>
          <p className="text-sm text-slate-500">Cadastro completo de clientes do escritório</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou documento..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(["Todos", "Ativo", "Prospecto", "Inativo"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filterStatus === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Carregando clientes...
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-4">
            <AlertCircle size={16} className="text-red-500" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
          <div>
            <button onClick={loadClients} className="flex items-center gap-2 mx-auto px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200">
              <RotateCcw size={14} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {filtered.map((client, idx) => (
            <button
              key={client.id}
              onClick={() => setSelected(client)}
              className={`w-full text-left flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${
                idx !== filtered.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  {client.nome.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{client.nome}</p>
                  <p className="text-xs text-slate-500">{client.tipo} · {client.documento}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${statusStyles[client.status]}`}>
                  {client.status}
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {clients.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado"}
              </p>
            </div>
          )}
        </div>
      )}

      {selected && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setShowForm(true); }}
          onDelete={() => setDeleting(selected)}
        />
      )}
      {showForm && (
        <ClientFormModal
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
      {deleting && (
        <DeleteConfirmModal client={deleting} onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
