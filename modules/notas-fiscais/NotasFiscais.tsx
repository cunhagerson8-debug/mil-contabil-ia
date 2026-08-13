import React, { useEffect, useMemo, useState } from "react";
import {
  FileText, Plus, Search, X, CheckCircle2, XCircle,
  Clock, AlertTriangle, ChevronRight, Download, RotateCcw,
  Building2, Loader2,
} from "lucide-react";
import { Invoice, InvoiceStatus, InvoiceType } from "./types";
import { invoicesApi } from "../../services/invoicesApi";
import { companiesApi } from "../../services/companiesApi";
import { Company } from "../empresas/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<InvoiceStatus, { icon: React.ElementType; badge: string }> = {
  "Emitida":    { icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Cancelada":  { icon: XCircle,      badge: "bg-red-50 text-red-700 border-red-200" },
  "Rejeitada":  { icon: XCircle,      badge: "bg-rose-50 text-rose-700 border-rose-200" },
  "Pendente":   { icon: Clock,        badge: "bg-slate-100 text-slate-500 border-slate-200" },
  "Em Processo":{ icon: AlertTriangle,badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

const TIPO_COLOR: Record<InvoiceType, string> = {
  "NFS-e": "bg-blue-50 text-blue-700",
  "NF-e":  "bg-violet-50 text-violet-700",
  "NFC-e": "bg-teal-50 text-teal-700",
};

function fmt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");
}
function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Adapter: backend DTO -> frontend Invoice shape
function adaptInvoice(dto: any): Invoice {
  return {
    id: dto.id,
    companyId: dto.companyId,
    numero: dto.numero,
    tipo: dto.tipo as InvoiceType,
    status: dto.status as InvoiceStatus,
    dataEmissao: dto.dataEmissao,
    tomador: dto.tomador,
    tomadorDoc: dto.tomadorDoc,
    itens: dto.items ?? dto.itens ?? [],
    valorTotal: dto.valorTotal,
    impostos: dto.impostos ?? {},
    chaveAcesso: dto.chaveAcesso,
    xmlUrl: dto.xmlUrl,
    pdfUrl: dto.pdfUrl,
    motivoCancelamento: dto.motivoCancelamento,
  };
}

// ── Invoice Drawer ───────────────────────────────────────────────────────────

const InvoiceDrawer = ({ inv, companies, onClose }: { inv: Invoice; companies: Company[]; onClose: () => void }) => {
  const sc = STATUS_CFG[inv.status];
  const StatusIcon = sc.icon;
  const company = companies.find((c) => c.id === inv.companyId);
  const totalImpostos = Object.values(inv.impostos).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${TIPO_COLOR[inv.tipo]}`}>{inv.tipo}</span>
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${sc.badge}`}>{inv.status}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">NF {inv.numero}</h3>
            <p className="text-sm text-slate-500">{company?.nomeFantasia} · {fmt(inv.dataEmissao)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Tomador */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Building2 size={11} /> Tomador / Destinatário
            </p>
            <p className="font-bold text-slate-800">{inv.tomador}</p>
            <p className="text-sm text-slate-500">{inv.tomadorDoc}</p>
          </div>

          {/* Itens */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Itens da nota</p>
            <div className="space-y-2">
              {inv.itens.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{item.descricao}</p>
                    <p className="text-xs text-slate-500">{item.quantidade} × {brl(item.valorUnitario)}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{brl(item.valorTotal)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totais */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            {Object.entries(inv.impostos).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-slate-500 uppercase">{k}</span>
                <span className="font-semibold text-slate-700">{brl(v!)}</span>
              </div>
            ))}
            {totalImpostos > 0 && (
              <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                <span className="font-bold text-slate-600">Total Impostos</span>
                <span className="font-bold text-red-600">{brl(totalImpostos)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-3">
              <span className="font-black text-slate-800">TOTAL DA NOTA</span>
              <span className="font-black text-slate-900 text-lg">{brl(inv.valorTotal)}</span>
            </div>
          </div>

          {inv.chaveAcesso && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Chave de Acesso</p>
              <p className="text-xs font-mono text-slate-600 break-all bg-slate-50 p-3 rounded-xl border border-slate-200">
                {inv.chaveAcesso}
              </p>
            </div>
          )}

          {inv.motivoCancelamento && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Motivo do Cancelamento</p>
              <p className="text-sm text-red-700">{inv.motivoCancelamento}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {inv.status === "Emitida" && (
              <>
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                  <Download size={15} /> Baixar DANFE / PDF
                </button>
                <button className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                  <Download size={15} /> Baixar XML
                </button>
                <button className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                  <RotateCcw size={15} /> Solicitar Cancelamento
                </button>
              </>
            )}
            {inv.status === "Cancelada" && (
              <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <Plus size={15} /> Emitir nota corretora
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Emitir Nota Form ─────────────────────────────────────────────────────────

const EmitirNotaForm = ({ companies, onClose }: { companies: Company[]; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Emitir Nova Nota Fiscal</h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo</label>
            <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option>NFS-e</option><option>NF-e</option><option>NFC-e</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Empresa emissora</label>
            <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {companies.map((c) => <option key={c.id}>{c.nomeFantasia}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tomador (CNPJ/CPF)</label>
          <input placeholder="00.000.000/0001-00" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Descrição do serviço / produto</label>
          <textarea rows={3} placeholder="Descreva o serviço ou produto..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor (R$)</label>
            <input type="number" placeholder="0,00" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Data de emissão</label>
            <input type="date" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700 font-semibold">
            A emissão via integração com SEFAZ/Prefeitura requer Certificado Digital A1 configurado. <span className="font-black">Em breve disponível.</span>
          </p>
        </div>
      </div>
      <div className="p-6 border-t border-slate-100 flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
          Cancelar
        </button>
        <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
          Emitir Nota
        </button>
      </div>
    </div>
  </div>
);

// ── Main page ────────────────────────────────────────────────────────────────

type Tab = "Todas" | "Emitida" | "Cancelada" | "Em Processo";

export default function NotasFiscais({ autoOpenForm = false }: { autoOpenForm?: boolean } = {}) {
  const [tab, setTab] = useState<Tab>("Todas");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [showForm, setShowForm] = useState(autoOpenForm);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [invData, compData] = await Promise.all([
          invoicesApi.list(),
          companiesApi.list(),
        ]);
        if (!cancelled) {
          setInvoices(invData.map(adaptInvoice));
          setCompanies(compData);
        }
      } catch {
        // Fallback: if API not available, keep empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return invoices.filter((inv) => {
      const matchTab = tab === "Todas" || inv.status === tab;
      const matchQ = inv.numero.includes(q) || inv.tomador.toLowerCase().includes(q);
      return matchTab && matchQ;
    });
  }, [tab, query, invoices]);

  const totalEmitidas = invoices.filter((i) => i.status === "Emitida").reduce((a, b) => a + b.valorTotal, 0);

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Carregando notas fiscais...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Emissão de Notas</h1>
          <p className="text-sm text-slate-500">Emitir, consultar e cancelar notas fiscais</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <Plus size={18} /> Emitir Nota
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total emitidas",    value: invoices.filter(i => i.status === "Emitida").length,     color: "text-slate-800" },
          { label: "Volume faturado",   value: brl(totalEmitidas),                                      color: "text-blue-700" },
          { label: "Canceladas",        value: invoices.filter(i => i.status === "Cancelada").length,   color: "text-red-600" },
          { label: "Em processo",       value: invoices.filter(i => i.status === "Em Processo").length, color: "text-amber-600" },
        ].map((k) => (
          <div key={k.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número ou tomador..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(["Todas", "Emitida", "Em Processo", "Cancelada"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${tab === t ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <FileText size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhuma nota encontrada</p>
          </div>
        )}
        {filtered.map((inv, idx) => {
          const sc = STATUS_CFG[inv.status];
          const StatusIcon = sc.icon;
          const company = companies.find((c) => c.id === inv.companyId);
          return (
            <button key={inv.id} onClick={() => setSelected(inv)}
              className={`w-full text-left flex items-center justify-between p-5 hover:bg-slate-50 transition-colors ${idx !== filtered.length - 1 ? "border-b border-slate-100" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-700 shrink-0">
                  <FileText size={18} />
                  <span className="text-[8px] font-black mt-0.5">{inv.tipo}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-slate-800 text-sm">NF {inv.numero}</p>
                    <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${sc.badge}`}>{inv.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">{inv.tomador}</p>
                  <p className="text-xs text-slate-400">{company?.nomeFantasia} · {fmt(inv.dataEmissao)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-black text-slate-800 text-sm hidden sm:block">{brl(inv.valorTotal)}</p>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>

      {selected && <InvoiceDrawer inv={selected} companies={companies} onClose={() => setSelected(null)} />}
      {showForm && <EmitirNotaForm companies={companies} onClose={() => setShowForm(false)} />}
    </div>
  );
}
