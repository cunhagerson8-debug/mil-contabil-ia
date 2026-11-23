import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Inbox, Loader2, Search } from "lucide-react";
import {
  commercialLeadsApi,
  type CommercialLead,
  type CommercialLeadStatus,
} from "../../services/commercialLeadsApi";

const PAGE_SIZE = 25;

const statusLabels: Record<CommercialLeadStatus, string> = {
  new: "Novo",
  contacting: "Em atendimento",
  qualified: "Qualificado",
  converted: "Convertido",
  closed: "Concluído",
};

const interestLabels: Record<CommercialLead["serviceInterest"], string> = {
  software_subscription: "Assinatura da plataforma",
  accounting_services: "Serviços contábeis",
  both: "Plataforma e serviços contábeis",
  undecided: "Ainda não definido",
};

const statuses = Object.keys(statusLabels) as CommercialLeadStatus[];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CommercialLeadsPanel() {
  const [leads, setLeads] = useState<CommercialLead[]>([]);
  const [statusFilter, setStatusFilter] = useState<CommercialLeadStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void commercialLeadsApi.list({
      status: statusFilter || undefined,
      search: search || undefined,
      page,
      limit: PAGE_SIZE,
    }).then((result) => {
      if (!active) return;
      setLeads(result.leads);
      setTotal(result.total);
    }).catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as solicitações.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [statusFilter, search, page, refreshKey]);

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function changeStatus(lead: CommercialLead, status: CommercialLeadStatus) {
    if (lead.status === status) return;
    setUpdatingId(lead.id);
    setError(null);
    try {
      await commercialLeadsApi.updateStatus(lead.id, status);
      setRefreshKey((key) => key + 1);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar o status.");
    } finally {
      setUpdatingId(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">Atendimento da Mila</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Solicitações comerciais</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Leads enviados com consentimento explícito. Acesso restrito a administradores da plataforma.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">{total} solicitações</span>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={applySearch} className="flex min-w-0 flex-1 gap-2 sm:max-w-lg">
          <label className="sr-only" htmlFor="commercial-lead-search">Buscar por nome, WhatsApp ou e-mail</label>
          <input
            id="commercial-lead-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
            placeholder="Buscar nome, WhatsApp ou e-mail"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button type="submit" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0b2340] text-white" aria-label="Buscar solicitações">
            <Search size={17} />
          </button>
        </form>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          Status
          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              const nextStatus = statuses.find((status) => status === event.target.value);
              setStatusFilter(nextStatus ?? "");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Todos</option>
            {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-extrabold">Interessado</th>
                <th scope="col" className="px-4 py-3 font-extrabold">WhatsApp / e-mail</th>
                <th scope="col" className="px-4 py-3 font-extrabold">Interesse</th>
                <th scope="col" className="px-4 py-3 font-extrabold">Informações voluntárias</th>
                <th scope="col" className="px-4 py-3 font-extrabold">Recebido</th>
                <th scope="col" className="px-4 py-3 font-extrabold">Acompanhamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="mx-auto animate-spin text-blue-700" /></td></tr>
              ) : leads.length ? leads.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4 font-bold text-slate-800">{lead.name}</td>
                  <td className="space-y-1 px-4 py-4 text-slate-600">
                    <span className="block font-semibold text-slate-700">{lead.whatsapp}</span>
                    {lead.email && <span className="block break-all">{lead.email}</span>}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{interestLabels[lead.serviceInterest]}</td>
                  <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-4 text-slate-600">{lead.voluntaryDetails || "—"}</td>
                  <td className="px-4 py-4 text-slate-600">
                    <span className="block">{formatDate(lead.createdAt)}</span>
                    <span className="mt-1 block text-[10px] text-slate-400">Consentido em {formatDate(lead.consentedAt)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <label className="sr-only" htmlFor={`lead-status-${lead.id}`}>Status de {lead.name}</label>
                    <select
                      id={`lead-status-${lead.id}`}
                      value={lead.status}
                      disabled={updatingId === lead.id}
                      onChange={(event) => {
                        const nextStatus = statuses.find((status) => status === event.target.value);
                        if (nextStatus) void changeStatus(lead, nextStatus);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                    </select>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <Inbox size={24} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-700">Nenhuma solicitação encontrada</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">As solicitações aparecerão aqui após o envio consentido pelo chat da Mila.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Página {page} de {pageCount}</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
