import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, Building2, Users, ClipboardList, FileText,
  Bell, Globe, Receipt, Calculator, Newspaper, MessageSquare,
  Menu, X, TrendingUp, AlertTriangle, AlertOctagon, CheckCircle2,
  ChevronRight, ShieldAlert, Wifi, UserCog, UserCircle, LogOut,
  DollarSign, ShieldCheck, PieChart as PieChartIcon, BarChart3,
  Plus, Zap, Loader2, AlertCircle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────
import { AppSection } from "./types";

// ── Auth & access control ────────────────────────────────────────────────────
import { AuthProvider, useAuth, LoginPage, ForgotPasswordPage, RegisterPage, PerfilPage } from "./modules/auth";
import { ProtectedRoute, PermissionGuard, sectionsForRole, filterByCompanyAccess, SECTION_LABELS, canAccessSection } from "./architecture/access-control";
import { obligationsByStatus, alertsByCategory, monthlyRevenueTrend } from "./architecture/dashboard-data";

// ── New modules ──────────────────────────────────────────────────────────────
import Empresas        from "./modules/empresas/Empresas";
import Clientes        from "./modules/clientes/Clientes";
import ObrigacoesFiscais from "./modules/obrigacoes-fiscais/ObrigacoesFiscais";
import NotasFiscais    from "./modules/notas-fiscais/NotasFiscais";
import CentralAlertas  from "./modules/alertas/CentralAlertas";
import PortalCliente   from "./modules/portal-cliente/PortalCliente";
import Usuarios        from "./modules/usuarios/Usuarios";
import RoleManagement  from "./modules/usuarios/RoleManagement";
import AberturaEmpresa from "./modules/abertura-empresa";

// ── Placeholder modules (awaiting original source uploads) ──────────────────
import Fiscal          from "./modules/fiscal/Fiscal";
import FolhaPagamento  from "./modules/folha-pagamento/FolhaPagamento";
import CalculadoraView from "./modules/calculadoras/CalculadoraView";
import News            from "./modules/news/News";
import AIChatSection   from "./modules/ai-chat/AIChatSection";
import MilAuditor from "./modules/mil-auditor/MilAuditor";
import Escritorios from "./modules/escritorios/Escritorios";

// ── Dados reais via API ─────────────────────────────────────────────────────
// Todos os módulos (Empresas, Clientes, Obrigações, Notas Fiscais, Alertas,
// Portal, Usuários) agora consomem a REST API real via services/*Api.ts.
// Mock data files permanecem como fallback offline mas não são mais importados.
import { companiesApi } from "./services/companiesApi";
import { clientsApi } from "./services/clientsApi";
import { taxObligationsApi } from "./services/taxObligationsApi";
import { invoicesApi } from "./services/invoicesApi";
import { alertsApi } from "./services/alertsApi";
import { ApiError } from "./services/apiClient";
import { Company } from "./modules/empresas/types";
import { Client } from "./modules/clientes/types";
import { TaxObligation } from "./modules/obrigacoes-fiscais/types";
import { integrationStatusList } from "./architecture/integrations";

// =============================================================================
// Navigation structure
// =============================================================================

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  group: "core" | "tools" | "legacy" | "admin";
  isNew?: boolean;
}

function useNavItems(): NavItem[] {
  const { user } = useAuth();
  // Badge counts are now loaded dynamically in the shell; static 0 here
  const unreadAlerts = 0;
  const criticos = 0;

  const allItems: NavItem[] = [
    { id: AppSection.DASHBOARD,          label: SECTION_LABELS[AppSection.DASHBOARD],          icon: LayoutDashboard, group: "core" },
    { id: AppSection.EMPRESAS,           label: SECTION_LABELS[AppSection.EMPRESAS],           icon: Building2,       group: "core" },
    { id: AppSection.ABERTURA_EMPRESA,       label: SECTION_LABELS[AppSection.ABERTURA_EMPRESA],   icon: Building2,       group: "core",isNew: true,},
    { id: AppSection.CLIENTES,           label: SECTION_LABELS[AppSection.CLIENTES],           icon: Users,           group: "core" },
    { id: AppSection.OBRIGACOES_FISCAIS, label: SECTION_LABELS[AppSection.OBRIGACOES_FISCAIS], icon: ClipboardList,   group: "core" },
    { id: AppSection.NOTAS_FISCAIS,      label: SECTION_LABELS[AppSection.NOTAS_FISCAIS],      icon: FileText,        group: "core" },
    { id: AppSection.ALERTAS,            label: SECTION_LABELS[AppSection.ALERTAS],            icon: Bell,            group: "core", badge: criticos || unreadAlerts || undefined },
    { id: AppSection.PORTAL_CLIENTE,     label: SECTION_LABELS[AppSection.PORTAL_CLIENTE],     icon: Globe,           group: "core" },
    { id: AppSection.USUARIOS,           label: SECTION_LABELS[AppSection.USUARIOS],           icon: UserCog,         group: "admin" },
    { id: AppSection.GESTAO_PAPEIS,      label: SECTION_LABELS[AppSection.GESTAO_PAPEIS],      icon: ShieldCheck,     group: "admin" },
    { id: AppSection.FISCAL,             label: SECTION_LABELS[AppSection.FISCAL],             icon: Receipt,         group: "legacy" },
    { id: AppSection.FOLHA_PAGAMENTO,    label: SECTION_LABELS[AppSection.FOLHA_PAGAMENTO],    icon: FileText,        group: "legacy" },
    { id: AppSection.CALCULATORS,        label: SECTION_LABELS[AppSection.CALCULATORS],        icon: Calculator,      group: "legacy" },
    { id: AppSection.NEWS,               label: SECTION_LABELS[AppSection.NEWS],               icon: Newspaper,       group: "legacy" },
    { id: AppSection.MIL_AUDITOR, label: SECTION_LABELS[AppSection.MIL_AUDITOR], icon: ShieldCheck, group: "admin" },
    { id: AppSection.ESCRITORIOS, label: SECTION_LABELS[AppSection.ESCRITORIOS], icon: Building2, group: "admin" },
  ];

  if (!user) return [];
  const allowed = new Set(sectionsForRole(user.role));
  return allItems.filter((item) => allowed.has(item.id));
}

// =============================================================================
// Dashboard
// =============================================================================

const Dashboard = ({ onNavigate }: { onNavigate: (s: AppSection, opts?: { openCreateForm?: boolean }) => void }) => {
  const { user, canAccessCompany } = useAuth();
  const role = user!.role;

  const [rawCompanies, setRawCompanies] = useState<Company[]>([]);
  const [rawClients, setRawClients] = useState<Client[]>([]);
  const [rawObrigacoes, setRawObrigacoes] = useState<TaxObligation[]>([]);
  const [rawInvoices, setRawInvoices] = useState<any[]>([]);
  const [rawAlerts, setRawAlerts] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const [companiesData, clientsData, obligationsData, invoicesData, alertsData] = await Promise.all([
          companiesApi.list(),
          clientsApi.list(),
          taxObligationsApi.list(),
          invoicesApi.list().catch(() => []),
          alertsApi.list().catch(() => []),
        ]);
        if (!cancelled) {
          setRawCompanies(companiesData);
          setRawClients(clientsData);
          setRawObrigacoes(obligationsData);
          setRawInvoices(invoicesData);
          setRawAlerts(alertsData);
        }
      } catch (err) {
        if (!cancelled) {
          setDashboardError(err instanceof ApiError ? err.message : "Não foi possível carregar os dados do dashboard.");
        }
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Escopo multi-tenant: filtra cada dataset pelo acesso do usuário atual,
  // espelhando exatamente o que as RLS policies já fizeram no banco
  // (companies_select_firm_scoped, tax_obligations_select, invoices_select)
  // — esta camada extra no frontend é defesa em profundidade, não a
  // checagem primária (essa já aconteceu no servidor/banco).
  const visibleCompanies = useMemo(
    () => filterByCompanyAccess(rawCompanies.map(c => ({ ...c, companyId: c.id })), canAccessCompany, role),
    [rawCompanies, canAccessCompany, role]
  );
  const visibleCompanyIds = useMemo(() => new Set(visibleCompanies.map((c) => c.id)), [visibleCompanies]);

  const visibleClients = useMemo(
    () => rawClients.filter((c) => !c.companyId || visibleCompanyIds.has(c.companyId)),
    [rawClients, visibleCompanyIds]
  );
  const visibleObrigacoes = useMemo(
    () => rawObrigacoes.filter((o) => visibleCompanyIds.has(o.companyId)),
    [rawObrigacoes, visibleCompanyIds]
  );
  const visibleInvoices = useMemo(
    () => rawInvoices.filter((i: any) => visibleCompanyIds.has(i.companyId)),
    [rawInvoices, visibleCompanyIds]
  );
  const visibleAlerts = useMemo(
    () => rawAlerts.filter((a: any) => !a.companyId || visibleCompanyIds.has(a.companyId)),
    [rawAlerts, visibleCompanyIds]
  );

  // ── KPI 1-2: Empresas e Clientes ───────────────────────────────────────────
  const totalEmpresasAtivas = visibleCompanies.filter((c) => c.status === "Ativa").length;

  // ── KPI 3: Obrigações vencendo (vencidas + próximas) ──────────────────────
  const vencidas    = visibleObrigacoes.filter((o) => o.status === "Vencida").length;
  const proximas    = visibleObrigacoes.filter((o) => o.status === "Próxima do Vencimento").length;
  const obrigacoesDue = vencidas + proximas;

  // ── KPI 4: Alertas ativos (não lidos) ─────────────────────────────────────
  const unreadAlerts = visibleAlerts.filter((a) => !a.read).length;
  const critAlerts   = visibleAlerts.filter((a) => a.severity === "Crítico" && !a.read);

  // ── KPI 5: Certificados expirando (<=30 dias) ─────────────────────────────
  const certExpiring = visibleCompanies.filter((c) => {
    if (!c.certificadoDigitalValidade) return false;
    const days = Math.ceil((new Date(c.certificadoDigitalValidade).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  });

  // ── KPI 6: Faturamento do mês (notas emitidas, mês corrente) ──────────────
  const now = new Date();
  const monthlyRevenue = visibleInvoices
    .filter((i) => {
      if (i.status !== "Emitida") return false;
      const d = new Date(i.dataEmissao);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, i) => sum + i.valorTotal, 0);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthRevenue = visibleInvoices
    .filter((i) => {
      if (i.status !== "Emitida") return false;
      const d = new Date(i.dataEmissao);
      return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    })
    .reduce((sum, i) => sum + i.valorTotal, 0);
  const revenueDelta = lastMonthRevenue > 0
    ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;

  const isPortalUser = role === "company_manager" || role === "company_user";

  // ── Dados para os gráficos ─────────────────────────────────────────────────
  const obligationChartData = useMemo(() => obligationsByStatus(visibleObrigacoes), [visibleObrigacoes]);
  const alertChartData = useMemo(() => alertsByCategory(visibleAlerts), [visibleAlerts]);
  const revenueChartData = useMemo(() => monthlyRevenueTrend(visibleInvoices), [visibleInvoices]);

  // ── Quick Actions — apenas as que o papel atual pode executar ─────────────
  const quickActions = useMemo(() => {
    const all = [
      { label: "Nova Empresa",    icon: Building2,     section: AppSection.EMPRESAS,           openCreateForm: false },
      { label: "Novo Cliente",    icon: Users,          section: AppSection.CLIENTES,           openCreateForm: false },
      { label: "Nova Obrigação",  icon: ClipboardList,  section: AppSection.OBRIGACOES_FISCAIS, openCreateForm: false },
      { label: "Nova Nota",       icon: FileText,       section: AppSection.NOTAS_FISCAIS,      openCreateForm: true },
    ];
    return all.filter((a) => canAccessSection(role, a.section));
  }, [role]);

  if (dashboardLoading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px] text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Carregando dashboard...
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="inline-flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-4">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-700 font-medium">{dashboardError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Visão Geral</h1>
        <p className="text-sm text-slate-500">
          {isPortalUser
            ? `Bem-vindo(a), ${user!.fullName.split(" ")[0]} — dados da sua empresa`
            : "Bem-vindo à plataforma MIL Contábil IA"}
        </p>
      </div>

      {/* Quick Actions — apenas seções que o papel atual pode acessar */}
      {quickActions.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Zap size={12} /> Ações Rápidas
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onNavigate(action.section, { openCreateForm: action.openCreateForm })}
                className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                  <action.icon size={17} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{action.label}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Plus size={9} /> Criar agora
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Critical alerts banner */}
      {critAlerts.length > 0 && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon size={18} className="text-red-500" />
            <p className="font-black text-red-700 text-sm uppercase tracking-widest">
              {critAlerts.length} Alerta{critAlerts.length > 1 ? "s" : ""} Crítico{critAlerts.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {critAlerts.slice(0, 2).map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{a.title}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate(AppSection.ALERTAS)}
            className="mt-3 text-xs font-black text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            Ver todos os alertas <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* KPI grid — 6 indicadores solicitados */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Total de Empresas",
            value: totalEmpresasAtivas,
            sub: `${visibleCompanies.length} no total`,
            icon: Building2,
            iconBg: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
            target: AppSection.EMPRESAS,
          },
          {
            label: "Total de Clientes",
            value: visibleClients.filter((c) => c.status === "Ativo").length,
            sub: `${visibleClients.filter((c) => c.status === "Prospecto").length} prospectos`,
            icon: Users,
            iconBg: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
            target: AppSection.CLIENTES,
          },
          {
            label: "Obrigações a Vencer",
            value: obrigacoesDue,
            sub: `${vencidas} vencida${vencidas !== 1 ? "s" : ""} · ${proximas} próxima${proximas !== 1 ? "s" : ""}`,
            icon: obrigacoesDue > 0 ? AlertTriangle : CheckCircle2,
            iconBg: vencidas > 0
              ? "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white"
              : obrigacoesDue > 0
              ? "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
              : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
            target: AppSection.OBRIGACOES_FISCAIS,
          },
          {
            label: "Alertas Ativos",
            value: unreadAlerts,
            sub: `${critAlerts.length} crítico${critAlerts.length !== 1 ? "s" : ""}`,
            icon: Bell,
            iconBg: unreadAlerts > 0
              ? "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
              : "bg-slate-50 text-slate-400 group-hover:bg-slate-600 group-hover:text-white",
            target: AppSection.ALERTAS,
          },
          {
            label: "Certificados Expirando",
            value: certExpiring.length,
            sub: certExpiring.length > 0 ? "nos próximos 30 dias" : "todos em dia",
            icon: certExpiring.length > 0 ? ShieldAlert : CheckCircle2,
            iconBg: certExpiring.length > 0
              ? "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white"
              : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
            target: AppSection.EMPRESAS,
          },
          {
            label: "Faturamento do Mês",
            value: monthlyRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }),
            sub: revenueDelta === null ? "sem comparativo" : `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% vs mês anterior`,
            icon: DollarSign,
            iconBg: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
            target: AppSection.NOTAS_FISCAIS,
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => onNavigate(kpi.target)}
            className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-xl transition-colors ${kpi.iconBg}`}>
                <kpi.icon size={20} />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">{kpi.label}</p>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-slate-900 truncate">{kpi.value}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{kpi.sub}</p>
          </button>
        ))}
      </div>

      {/* Charts — apenas staff do escritório (portal user já vê tudo no nível de detalhe) */}
      {!isPortalUser && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Obrigações por status — donut */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <PieChartIcon size={16} className="text-slate-500" />
              <h3 className="font-bold text-slate-800 text-sm">Obrigações por Status</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">{visibleObrigacoes.length} obrigações no total</p>
            {obligationChartData.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={obligationChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {obligationChartData.map((slice) => (
                          <Cell key={slice.name} fill={slice.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} obrigações`, name]}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {obligationChartData.map((slice) => (
                    <div key={slice.name} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
                      {slice.name} ({slice.value})
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 text-center py-12">Sem obrigações para exibir.</p>
            )}
          </div>

          {/* Alertas por categoria — barras horizontais */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={16} className="text-slate-500" />
              <h3 className="font-bold text-slate-800 text-sm">Alertas por Categoria</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">{visibleAlerts.length} alertas no total</p>
            {alertChartData.length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={alertChartData} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={110}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} alertas`, ""]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-12">Sem alertas para exibir.</p>
            )}
          </div>

          {/* Faturamento — tendência mensal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-slate-500" />
              <h3 className="font-bold text-slate-800 text-sm">Faturamento Mensal</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">Notas emitidas, últimos 6 meses</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Faturamento"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={28}>
                    {revenueChartData.map((m) => (
                      <Cell key={m.month} fill={m.isCurrentMonth ? "#7c3aed" : "#c4b5fd"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout: obligations + integrations (apenas staff do escritório) */}
      {!isPortalUser && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-slate-500" />
                <h3 className="font-bold text-slate-800">Obrigações em Destaque</h3>
              </div>
              <button onClick={() => onNavigate(AppSection.OBRIGACOES_FISCAIS)}
                className="text-xs font-black text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                Ver todas <ChevronRight size={13} />
              </button>
            </div>
            <div>
              {visibleObrigacoes
                .filter((o) => o.status !== "Em Dia" && o.status !== "Não Aplicável")
                .slice(0, 5)
                .map((ob, idx, arr) => {
                  const days = Math.ceil((new Date(ob.vencimento).getTime() - Date.now()) / 86400000);
                  const isVencida = ob.status === "Vencida";
                  const company = visibleCompanies.find(c => c.id === ob.companyId);
                  return (
                    <div key={ob.id} className={`flex items-center justify-between px-5 py-3.5 ${idx !== arr.length - 1 ? "border-b border-slate-50" : ""}`}>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{ob.nome}</p>
                        <p className="text-xs text-slate-400">{company?.nomeFantasia} · {ob.competencia}</p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={`text-xs font-black ${isVencida ? "text-red-600" : "text-amber-600"}`}>
                          {isVencida ? `${Math.abs(days)}d vencida` : `em ${days}d`}
                        </p>
                        {ob.valor && (
                          <p className="text-xs text-slate-500">
                            {ob.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              {visibleObrigacoes.filter((o) => o.status !== "Em Dia" && o.status !== "Não Aplicável").length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhuma obrigação pendente.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100">
              <Wifi size={18} className="text-slate-500" />
              <h3 className="font-bold text-slate-800">Status das Integrações</h3>
            </div>
            <div>
              {integrationStatusList.map((intg, idx) => (
                <div key={intg.id}
                  className={`flex items-center justify-between px-5 py-3.5 ${idx !== integrationStatusList.length - 1 ? "border-b border-slate-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      intg.status === "connected"     ? "bg-emerald-500" :
                      intg.status === "pending"       ? "bg-amber-400 animate-pulse" :
                      intg.status === "error"         ? "bg-red-500 animate-pulse" :
                      "bg-slate-300"
                    }`} />
                    <div>
                      <p className="text-sm font-bold text-slate-800">{intg.name}</p>
                      <p className="text-xs text-slate-400">{intg.description.split(".")[0]}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ml-3 ${
                    intg.status === "connected"   ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    intg.status === "pending"     ? "bg-amber-50 text-amber-700 border-amber-200" :
                    intg.status === "error"       ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-slate-50 text-slate-500 border-slate-200"
                  }`}>
                    {intg.status === "connected"     ? "Ativo" :
                     intg.status === "pending"       ? "Pendente" :
                     intg.status === "error"         ? "Erro" : "Desconectado"}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-semibold text-center">
                Integrações disponíveis via configuração no painel administrativo
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expiring certificates warning */}
      {certExpiring.length > 0 && (
        <div className="mt-6 bg-rose-50 border border-rose-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={18} className="text-rose-500" />
            <p className="font-bold text-rose-700">Certificados A1 expirando em breve</p>
          </div>
          <div className="space-y-2">
            {certExpiring.map((c) => {
              const days = Math.ceil((new Date(c.certificadoDigitalValidade!).getTime() - Date.now()) / 86400000);
              return (
                <div key={c.id} className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-rose-700">{c.nomeFantasia}</p>
                  <p className="text-xs font-black text-rose-600">expira em {days}d</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Authenticated shell (sidebar + topbar + routed content)
// =============================================================================

function AuthenticatedShell() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [autoOpenInvoiceForm, setAutoOpenInvoiceForm] = useState(false);
  const [rawAlerts, setRawAlerts] = useState<any[]>([]);
  const navItems = useNavItems();

  // Load alert count for topbar bell badge
  useEffect(() => {
    alertsApi.list().then((data) => setRawAlerts(data)).catch(() => {});
  }, [activeSection]);

  // Navegação vinda do Dashboard (KPIs e Ações Rápidas) pode pedir para abrir
  // diretamente o formulário de criação ao chegar na seção de destino.
  const navigateTo = (section: AppSection, opts?: { openCreateForm?: boolean }) => {
    setAutoOpenInvoiceForm(!!opts?.openCreateForm && section === AppSection.NOTAS_FISCAIS);
    setActiveSection(section);
  };

  const coreItems  = navItems.filter((i) => i.group === "core");
  const adminItems = navItems.filter((i) => i.group === "admin");
  const toolItems  = navItems.filter((i) => i.group === "tools");
  const legacyItems = navItems.filter((i) => i.group === "legacy");

  const activeLabel = navItems.find((i) => i.id === activeSection)?.label
    ?? (activeSection === AppSection.PERFIL ? SECTION_LABELS[AppSection.PERFIL] : "");

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-300 lg:relative lg:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between">
  <div>
    <div className="flex items-center gap-3 mb-1">

      <img
        src="/images/logo-mil-contabil-ia.png"
        alt="MIL Contábil IA"
        className="w-14 h-14 object-contain"
      />

      <div>
        <h2 className="font-black text-slate-900 text-xl leading-none">
          MIL <span className="text-blue-600">Contábil</span>{" "}
          <span className="text-amber-500">IA</span>
        </h2>

        <p className="text-[10px] text-slate-400 font-semibold">
          Uma solução da MIL Gestão &amp; Tecnologia
        </p>
      </div>

    </div>
  </div>

  <button
    onClick={() => setSidebarOpen(false)}
  >
    <X size={16} />
  </button>
</div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-3 mb-1.5">Plataforma</p>
            <div className="space-y-0.5">
              {coreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { navigateTo(item.id); setSidebarOpen(false); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] text-sm
                    ${activeSection === item.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : "text-slate-600 hover:bg-slate-50"
                    }
                  `}
                >
                  <item.icon size={17} className="shrink-0" />
                  <span className="font-bold flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      activeSection === item.id ? "bg-white/25 text-white" : "bg-red-500 text-white"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {adminItems.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-3 mb-1.5">Administração</p>
              <div className="space-y-0.5">
                {adminItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { navigateTo(item.id); setSidebarOpen(false); }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm
                      ${activeSection === item.id ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}
                    `}
                  >
                    <item.icon size={17} className="shrink-0" />
                    <span className="font-bold">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-3 mb-1.5">Assistente</p>
            <div className="space-y-0.5">
              {toolItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { navigateTo(item.id); setSidebarOpen(false); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm
                    ${activeSection === item.id ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}
                  `}
                >
                  <item.icon size={17} className="shrink-0" />
                  <span className="font-bold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {legacyItems.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-3 mb-1.5">
                Módulos legados
              </p>
              <div className="space-y-0.5">
                {legacyItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { navigateTo(item.id); setSidebarOpen(false); }}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm
                      ${activeSection === item.id ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"}
                    `}
                  >
                    <item.icon size={17} className="shrink-0" />
                    <span className="font-bold">{item.label}</span>
                    {item.id === AppSection.FOLHA_PAGAMENTO && (
                      <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase ml-auto">RH</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar footer: profile + logout */}
        <div className="p-3 border-t border-slate-100 shrink-0 space-y-2">
          <button
            onClick={() => { navigateTo(AppSection.PERFIL); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
              activeSection === AppSection.PERFIL ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <UserCircle size={17} className="shrink-0" />
            <span className="font-bold flex-1 text-left">Meu Perfil</span>
          </button>
          <div className="p-4 bg-slate-900 rounded-2xl text-white">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Suporte Especializado</p>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">Dúvidas fiscais ou tributárias?</p>
            <button
              onClick={() => navigateTo(AppSection.AI_CHAT)}
              className="w-full py-2 bg-blue-600 rounded-xl text-[10px] font-black hover:bg-blue-500 transition-colors uppercase tracking-widest"
            >
              Consultar MIL IA
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center px-5 md:px-8 justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest hidden sm:block">
              {activeLabel}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateTo(AppSection.ALERTAS)}
              className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Bell size={18} className="text-slate-500" />
              {rawAlerts && rawAlerts.filter((a: any) => !a.read).length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {rawAlerts.filter((a: any) => !a.read).length}
                </span>
              )}
            </button>
            <button
              onClick={() => navigateTo(AppSection.PERFIL)}
              className="hidden sm:flex items-center gap-2.5 hover:bg-slate-50 rounded-xl pl-1 pr-2 py-1 -my-1 transition-colors"
            >
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{user.fullName.split(" ").slice(0, 2).join(" ")}</p>
                <p className="text-[10px] text-blue-600 font-black uppercase tracking-tighter">
                  {user.firmName ?? "MIL Gestão"}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                {user.fullName.charAt(0)}
              </div>
            </button>
            <button
              onClick={logout}
              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto pb-12">
            {activeSection === AppSection.DASHBOARD          && <Dashboard onNavigate={navigateTo} />}
            {activeSection === AppSection.EMPRESAS           && <PermissionGuard section={AppSection.EMPRESAS}><Empresas /></PermissionGuard>}
            {activeSection === AppSection.CLIENTES           && <PermissionGuard section={AppSection.CLIENTES}><Clientes /></PermissionGuard>}
            {activeSection === AppSection.OBRIGACOES_FISCAIS && <PermissionGuard section={AppSection.OBRIGACOES_FISCAIS}><ObrigacoesFiscais /></PermissionGuard>}
            {activeSection === AppSection.NOTAS_FISCAIS      && <PermissionGuard section={AppSection.NOTAS_FISCAIS}><NotasFiscais autoOpenForm={autoOpenInvoiceForm} /></PermissionGuard>}
            {activeSection === AppSection.ALERTAS            && <PermissionGuard section={AppSection.ALERTAS}><CentralAlertas /></PermissionGuard>}
            {activeSection === AppSection.PORTAL_CLIENTE     && <PermissionGuard section={AppSection.PORTAL_CLIENTE}><PortalCliente /></PermissionGuard>}
            {activeSection === AppSection.USUARIOS           && <PermissionGuard section={AppSection.USUARIOS}><Usuarios /></PermissionGuard>}
            {activeSection === AppSection.GESTAO_PAPEIS       && <PermissionGuard section={AppSection.GESTAO_PAPEIS}><RoleManagement /></PermissionGuard>}
            {activeSection === AppSection.PERFIL             && <PerfilPage />}
            {activeSection === AppSection.FISCAL             && <PermissionGuard section={AppSection.FISCAL}><Fiscal /></PermissionGuard>}
            {activeSection === AppSection.FOLHA_PAGAMENTO    && <PermissionGuard section={AppSection.FOLHA_PAGAMENTO}><FolhaPagamento /></PermissionGuard>}
            {activeSection === AppSection.CALCULATORS        && <PermissionGuard section={AppSection.CALCULATORS}><CalculadoraView /></PermissionGuard>}
            {activeSection === AppSection.NEWS               && <PermissionGuard section={AppSection.NEWS}><News onNavigate={(s) => navigateTo(s as AppSection)} /></PermissionGuard>}
            {activeSection === AppSection.AI_CHAT            && <PermissionGuard section={AppSection.AI_CHAT}><AIChatSection /></PermissionGuard>}
            {activeSection === AppSection.MIL_AUDITOR        && <PermissionGuard section={AppSection.MIL_AUDITOR}><MilAuditor /></PermissionGuard>}
            {activeSection === AppSection.ESCRITORIOS         && <PermissionGuard section={AppSection.ESCRITORIOS}><Escritorios /></PermissionGuard>}
          </div>
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Public (unauthenticated) flow: login <-> forgot password
// =============================================================================

function PublicFlow() {
  const [screen, setScreen] = useState<"login" | "forgot" | "register">("login");
  return screen === "login"
    ? <LoginPage onForgotPassword={() => setScreen("forgot")} onRegister={() => setScreen("register")} />
    : screen === "forgot"
      ? <ForgotPasswordPage onBackToLogin={() => setScreen("login")} />
      : <RegisterPage onBackToLogin={() => setScreen("login")} />;
}

// =============================================================================
// Root App
// =============================================================================

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute fallback={<PublicFlow />}>
        <AuthenticatedShell />
      </ProtectedRoute>
    </AuthProvider>
  );
}
