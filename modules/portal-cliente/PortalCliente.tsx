import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid, FileText, MessageSquare, Download,
  CheckCircle2, Clock, Calendar, Send, X, User, Loader2,
} from "lucide-react";
import { portalApi } from "../../services/portalApi";
import { clientsApi } from "../../services/clientsApi";
import { PortalDocument, PortalGuide, PortalMessage } from "./types";
import { Client } from "../clientes/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso + (iso.includes("T") ? "" : "T12:00:00")).toLocaleDateString("pt-BR");
}
function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// Adapters
function adaptDoc(dto: any): PortalDocument {
  return {
    id: dto.id,
    clientId: dto.clientId,
    nome: dto.nome,
    categoria: dto.categoria,
    dataDisponibilizacao: dto.dataDisponibilizacao,
    tamanho: dto.tamanhoBytes ? `${(dto.tamanhoBytes / 1048576).toFixed(1)} MB` : dto.tamanho ?? "—",
    validade: dto.validade,
    downloadUrl: dto.downloadUrl,
  };
}
function adaptGuide(dto: any): PortalGuide {
  return {
    id: dto.id,
    clientId: dto.clientId,
    titulo: dto.titulo,
    descricao: dto.descricao ?? "",
    tipo: dto.tipo,
    valor: dto.valor,
    vencimento: dto.vencimento,
    codigoBarras: dto.codigoBarras,
    pago: dto.pago,
    dataDisponibilizacao: dto.dataDisponibilizacao,
  };
}
function adaptMessage(dto: any): PortalMessage {
  return {
    id: dto.id,
    clientId: dto.clientId,
    assunto: dto.assunto,
    corpo: dto.corpo,
    remetente: dto.remetente,
    status: dto.status,
    data: dto.data,
    respostaId: dto.respostaId,
  };
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

const DocCatBadge: Record<string, string> = {
  Guia:       "bg-violet-50 text-violet-700",
  "Relatório":"bg-blue-50 text-blue-700",
  "Certidão": "bg-teal-50 text-teal-700",
  Documento:  "bg-slate-100 text-slate-600",
  Contrato:   "bg-amber-50 text-amber-700",
};

const DocumentsTab = ({ clientId }: { clientId: string }) => {
  const [docs, setDocs] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    portalApi.listDocuments(clientId).then((data) => {
      if (!cancelled) setDocs(data.map(adaptDoc));
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>;

  return (
    <div className="space-y-3">
      {docs.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum documento disponível</p>
        </div>
      )}
      {docs.map((doc) => {
        const days = doc.validade ? daysUntil(doc.validade) : null;
        return (
          <div key={doc.id} className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <FileText size={18} />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">{doc.nome}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${DocCatBadge[doc.categoria] ?? "bg-slate-100 text-slate-600"}`}>
                    {doc.categoria}
                  </span>
                  <span className="text-xs text-slate-400">{doc.tamanho}</span>
                  {doc.validade && (
                    <span className={`text-xs font-semibold flex items-center gap-1 ${days !== null && days < 0 ? "text-red-500" : days !== null && days <= 30 ? "text-amber-500" : "text-slate-400"}`}>
                      <Calendar size={11} />
                      {days !== null && days < 0 ? "Vencida" : `válida até ${fmt(doc.validade)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
              <Download size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

const GuiasTab = ({ clientId }: { clientId: string }) => {
  const [guides, setGuides] = useState<PortalGuide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    portalApi.listGuides(clientId).then((data) => {
      if (!cancelled) setGuides(data.map(adaptGuide));
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>;

  return (
    <div className="space-y-3">
      {guides.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <FileText size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma guia disponível</p>
        </div>
      )}
      {guides.map((guia) => {
        const days = daysUntil(guia.vencimento);
        return (
          <div key={guia.id} className={`bg-white rounded-2xl border-2 p-5 ${guia.pago ? "border-emerald-200 opacity-70" : days < 0 ? "border-red-200" : days <= 5 ? "border-amber-200" : "border-slate-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-slate-800">{guia.titulo}</p>
                <p className="text-sm text-slate-500">{guia.descricao}</p>
              </div>
              {guia.pago ? (
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-200 text-xs font-black px-2 py-1 rounded-xl">
                  <CheckCircle2 size={13} /> Pago
                </span>
              ) : (
                <span className={`flex items-center gap-1 text-xs font-black px-2 py-1 rounded-xl border ${days < 0 ? "text-red-600 bg-red-50 border-red-200" : days <= 5 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                  <Clock size={13} /> {days < 0 ? `${Math.abs(days)}d vencida` : `vence em ${days}d`}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Valor</p>
                <p className="text-xl font-black text-slate-900">{brl(guia.valor)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Vencimento: {fmt(guia.vencimento)}</p>
              </div>
              {!guia.pago && (
                <button className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                  <Download size={15} className="inline mr-1.5" />Baixar guia
                </button>
              )}
            </div>
            {guia.codigoBarras && !guia.pago && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Código de barras</p>
                <p className="text-xs font-mono text-slate-600 break-all">{guia.codigoBarras}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const MensagensTab = ({ clientId }: { clientId: string }) => {
  const [newMsg, setNewMsg] = useState("");
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    portalApi.listMessages(clientId).then((data) => {
      if (!cancelled) setMessages(data.map(adaptMessage).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()));
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  async function handleSend() {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      const msg = await portalApi.createMessage({
        clientId,
        assunto: "Mensagem",
        corpo: newMsg.trim(),
        remetente: "cliente",
      });
      setMessages((prev) => [...prev, adaptMessage(msg)]);
      setNewMsg("");
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />Carregando...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Sem mensagens ainda</p>
          </div>
        )}
        {messages.map((msg) => {
          const isEscritorio = msg.remetente === "Escritório";
          return (
            <div key={msg.id} className={`flex gap-3 ${isEscritorio ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${isEscritorio ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                {isEscritorio ? "M" : <User size={14} />}
              </div>
              <div className={`max-w-[80%] ${isEscritorio ? "items-end" : ""} flex flex-col`}>
                <div className={`rounded-2xl p-4 ${isEscritorio ? "bg-blue-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 rounded-tl-sm"}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${isEscritorio ? "text-blue-200" : "text-slate-400"}`}>
                    {msg.assunto}
                  </p>
                  <p className={`text-sm leading-relaxed ${isEscritorio ? "text-white" : "text-slate-700"}`}>{msg.corpo}</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{msg.remetente}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mt-2">
        <textarea
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Escreva uma mensagem para o escritório..."
          rows={3}
          className="w-full text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSend}
            disabled={!newMsg.trim() || sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "Documentos" | "Guias" | "Mensagens";

export default function PortalCliente() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<string>("");
  const [tab, setTab] = useState<Tab>("Guias");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    clientsApi.list().then((data) => {
      if (!cancelled) {
        const active = data.filter((c) => c.status === "Ativo");
        setClients(active);
        if (active.length > 0) setActiveClient(active[0].id);
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const client = clients.find((c) => c.id === activeClient);

  const tabs: { id: Tab; label: string }[] = [
    { id: "Guias",       label: "Guias" },
    { id: "Documentos",  label: "Documentos" },
    { id: "Mensagens",   label: "Mensagens" },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Carregando portal...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Portal do Cliente</h1>
        <p className="text-sm text-slate-500">Guias, documentos, certidões e comunicação direta com o escritório</p>
      </div>

      {/* Client selector */}
      <div className="mb-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Visualizando como</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveClient(c.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors ${
                activeClient === c.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-200"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${activeClient === c.id ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                {c.nome.charAt(0)}
              </div>
              {c.nome.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeClient && (
        <>
          {tab === "Documentos" && <DocumentsTab clientId={activeClient} />}
          {tab === "Guias"      && <GuiasTab clientId={activeClient} />}
          {tab === "Mensagens"  && <MensagensTab clientId={activeClient} />}
        </>
      )}
    </div>
  );
}
