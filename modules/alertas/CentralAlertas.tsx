import React, { useEffect, useMemo, useState } from "react";
import {
  Bell, AlertTriangle, Info, AlertOctagon,
  CheckCheck, Filter, ChevronRight, X, Calendar, Loader2,
} from "lucide-react";
import { Alert, AlertSeverity, AlertCategory } from "./types";
import { alertsApi } from "../../services/alertsApi";
import { companiesApi } from "../../services/companiesApi";
import { Company } from "../empresas/types";

// ── Config ───────────────────────────────────────────────────────────────────

const SEV_CFG: Record<AlertSeverity, { icon: React.ElementType; badge: string; row: string; dot: string }> = {
  "Crítico":     { icon: AlertOctagon,  badge: "bg-red-50 text-red-700 border-red-200",      row: "border-l-red-500",    dot: "bg-red-500" },
  "Atenção":     { icon: AlertTriangle, badge: "bg-amber-50 text-amber-700 border-amber-200", row: "border-l-amber-400",  dot: "bg-amber-400" },
  "Informativo": { icon: Info,          badge: "bg-blue-50 text-blue-700 border-blue-200",    row: "border-l-blue-400",   dot: "bg-blue-400" },
};

const CAT_COLOR: Record<AlertCategory, string> = {
  "Obrigação Fiscal":   "bg-violet-50 text-violet-700",
  "Certificado Digital":"bg-rose-50 text-rose-700",
  "Pendência Fiscal":   "bg-red-50 text-red-700",
  "Nota Fiscal":        "bg-blue-50 text-blue-700",
  "Cliente":            "bg-teal-50 text-teal-700",
  "Sistema":            "bg-slate-100 text-slate-600",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRelative(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `${diff}d atrás`;
}

// Adapter: backend DTO -> frontend Alert shape
function adaptAlert(dto: any): Alert {
  return {
    id: dto.id,
    companyId: dto.companyId,
    title: dto.title,
    description: dto.description,
    severity: dto.severity as AlertSeverity,
    category: dto.category as AlertCategory,
    createdAt: dto.createdAt,
    dueDate: dto.dueDate,
    read: dto.read,
    actionLabel: dto.actionLabel,
    actionTarget: dto.actionTarget,
    sourceModule: dto.sourceModule,
  };
}

// ── Alert Drawer ─────────────────────────────────────────────────────────────

const AlertDrawer = ({ alert, companies, onClose, onMarkRead }: { alert: Alert; companies: Company[]; onClose: () => void; onMarkRead: (id: string) => void }) => {
  const sc = SEV_CFG[alert.severity];
  const SevIcon = sc.icon;
  const company = alert.companyId ? companies.find((c) => c.id === alert.companyId) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 flex items-start justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${sc.badge}`}>
              <SevIcon size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{alert.category}</p>
              <p className="text-sm font-black text-slate-800">{alert.severity}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{alert.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{alert.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gerado em</p>
              <p className="text-sm font-semibold text-slate-700">{fmtDate(alert.createdAt)}</p>
            </div>
            {alert.dueDate && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencimento</p>
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
                  <Calendar size={13} /> {fmtDate(alert.dueDate)}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Módulo origem</p>
              <p className="text-sm font-semibold text-slate-700">{alert.sourceModule}</p>
            </div>
            {company && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa</p>
                <p className="text-sm font-semibold text-slate-700">{company.nomeFantasia}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {alert.actionLabel && (
              <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                {alert.actionLabel}
              </button>
            )}
            {!alert.read && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCheck size={15} /> Marcar como lido
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

type SevFilter = AlertSeverity | "Todos";
type CatFilter = AlertCategory | "Todas";

export default function CentralAlertas() {
  const [sevFilter, setSevFilter] = useState<SevFilter>("Todos");
  const [catFilter, setCatFilter] = useState<CatFilter>("Todas");
  const [showUnread, setShowUnread] = useState(false);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [alertData, compData] = await Promise.all([
          alertsApi.list(),
          companiesApi.list(),
        ]);
        if (!cancelled) {
          setAlerts(alertData.map(adaptAlert));
          setCompanies(compData);
        }
      } catch {
        // keep empty on failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => ({
    total:     alerts.length,
    unread:    alerts.filter((a) => !a.read).length,
    criticos:  alerts.filter((a) => a.severity === "Crítico").length,
    atencao:   alerts.filter((a) => a.severity === "Atenção").length,
  }), [alerts]);

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => {
        const matchSev = sevFilter === "Todos" || a.severity === sevFilter;
        const matchCat = catFilter === "Todas" || a.category === catFilter;
        const matchRead = !showUnread || !a.read;
        return matchSev && matchCat && matchRead;
      })
      .sort((a, b) => {
        const sevOrder: Record<AlertSeverity, number> = { "Crítico": 0, "Atenção": 1, "Informativo": 2 };
        return sevOrder[a.severity] - sevOrder[b.severity] ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [alerts, sevFilter, catFilter, showUnread]);

  async function markAllRead() {
    try {
      await alertsApi.markAllRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    } catch {
      // fallback: local only
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    }
  }

  async function markOneRead(id: string) {
    try {
      await alertsApi.markRead(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
    } catch {
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
    }
    setSelected(null);
  }

  const categories: AlertCategory[] = ["Obrigação Fiscal", "Certificado Digital", "Pendência Fiscal", "Nota Fiscal", "Sistema"];

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Carregando alertas...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell size={28} className="text-slate-700" />
            {stats.unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {stats.unread}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Central de Alertas</h1>
            <p className="text-sm text-slate-500">Impostos, certificados e pendências em um só lugar</p>
          </div>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
        >
          <CheckCheck size={16} /> Marcar tudo como lido
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",     value: stats.total,    color: "text-slate-800", bg: "bg-white" },
          { label: "Não lidos", value: stats.unread,   color: "text-blue-700",  bg: "bg-blue-50" },
          { label: "Críticos",  value: stats.criticos, color: "text-red-700",   bg: "bg-red-50" },
          { label: "Atenção",   value: stats.atencao,  color: "text-amber-700", bg: "bg-amber-50" },
        ].map((k) => (
          <div key={k.label} className={`p-4 rounded-2xl border border-slate-200 shadow-sm ${k.bg}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
            <p className={`text-3xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <div className="flex gap-2 overflow-x-auto">
          {(["Todos", "Crítico", "Atenção", "Informativo"] as SevFilter[]).map((s) => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${sevFilter === s ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(["Todas", ...categories] as (CatFilter)[]).map((c) => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${catFilter === c ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowUnread(!showUnread)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${showUnread ? "bg-violet-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}
        >
          {showUnread ? "✓ " : ""}Não lidos
        </button>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Bell size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhum alerta encontrado</p>
          </div>
        )}
        {filtered.map((alert) => {
          const sc = SEV_CFG[alert.severity];
          const SevIcon = sc.icon;
          const company = alert.companyId ? companies.find((c) => c.id === alert.companyId) : null;

          return (
            <button
              key={alert.id}
              onClick={() => setSelected(alert)}
              className={`w-full text-left bg-white rounded-2xl border border-slate-200 border-l-4 ${sc.row} p-5 hover:shadow-md transition-all ${!alert.read ? "ring-1 ring-blue-100" : "opacity-80"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-xl border shrink-0 ${sc.badge}`}>
                    <SevIcon size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {!alert.read && <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />}
                      <p className="font-bold text-slate-800 text-sm leading-tight">{alert.title}</p>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${CAT_COLOR[alert.category]}`}>
                        {alert.category}
                      </span>
                      {company && (
                        <span className="text-[10px] font-semibold text-slate-400">{company.nomeFantasia}</span>
                      )}
                      {alert.dueDate && (
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                          <Calendar size={10} /> vence {fmtDate(alert.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{fmtRelative(alert.createdAt)}</span>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && <AlertDrawer alert={selected} companies={companies} onClose={() => setSelected(null)} onMarkRead={markOneRead} />}
    </div>
  );
}
