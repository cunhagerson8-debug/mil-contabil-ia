// =============================================================================
// MIL CONTÁBIL IA — Architecture: Dashboard Data
// =============================================================================
// Funções puras de agregação para os gráficos e widgets do Dashboard.
// Mantidas fora de App.tsx para que o componente de layout não cresça junto
// com a lógica de agregação — qualquer um dos dois pode mudar sem afetar o
// outro. Todas as funções aqui operam sobre os dados já filtrados por
// tenancy (visibleX), nunca sobre os mocks brutos — quem chama é
// responsável por já ter aplicado filterByCompanyAccess.
// =============================================================================

import { TaxObligation } from "../modules/obrigacoes-fiscais/types";
import { Alert, AlertCategory } from "../modules/alertas/types";
import { Invoice } from "../modules/notas-fiscais/types";

// -----------------------------------------------------------------------------
// Obrigações por status — alimenta o gráfico de rosca (donut)
// -----------------------------------------------------------------------------
export interface ObligationStatusSlice {
  name: string;
  value: number;
  color: string;
}

export function obligationsByStatus(obrigacoes: TaxObligation[]): ObligationStatusSlice[] {
  const counts = { "Em Dia": 0, "Próxima do Vencimento": 0, "Vencida": 0, "Não Aplicável": 0 };
  for (const o of obrigacoes) counts[o.status] += 1;

  return [
    { name: "Em Dia",                value: counts["Em Dia"],                color: "#10b981" }, // emerald-500
    { name: "Próxima do Vencimento", value: counts["Próxima do Vencimento"], color: "#f59e0b" }, // amber-500
    { name: "Vencida",               value: counts["Vencida"],               color: "#ef4444" }, // red-500
  ].filter((slice) => slice.value > 0);
}

// -----------------------------------------------------------------------------
// Alertas por categoria — alimenta o gráfico de barras horizontal
// -----------------------------------------------------------------------------
export interface AlertCategoryBar {
  category: AlertCategory;
  label: string;
  count: number;
}

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  "Obrigação Fiscal": "Obrigação Fiscal",
  "Certificado Digital": "Certificado Digital",
  "Pendência Fiscal": "Pendência Fiscal",
  "Nota Fiscal": "Nota Fiscal",
  "Cliente": "Cliente",
  "Sistema": "Sistema",
};

export function alertsByCategory(alerts: Alert[]): AlertCategoryBar[] {
  const counts = new Map<AlertCategory, number>();
  for (const a of alerts) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, label: CATEGORY_LABELS[category], count }))
    .sort((a, b) => b.count - a.count);
}

// -----------------------------------------------------------------------------
// Faturamento mensal — alimenta o gráfico de barras de tendência
// -----------------------------------------------------------------------------
// NOTA HONESTA SOBRE OS DADOS: o mock de notas fiscais (modules/notas-fiscais/
// mockData.ts) só cobre maio-junho/2026 — não há histórico suficiente para
// uma tendência real de 6 meses. Para não fabricar precisão que os dados não
// têm, os meses anteriores ao mês corrente são compostos a partir da MESMA
// base real (notas "Emitida" agregadas), sem inflar ou simular crescimento
// artificial — apenas repetindo o sinal real disponível. Quando o backend
// real existir, esta função deve ser substituída por uma query agregando
// invoices por mês civil, sem necessidade de mudar a forma dos dados que o
// gráfico consome (RevenueMonth[]).
export interface RevenueMonth {
  month: string;   // "Jan", "Fev", ...
  revenue: number;
  isCurrentMonth: boolean;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthlyRevenueTrend(invoices: Invoice[], referenceDate: Date = new Date()): RevenueMonth[] {
  const months: RevenueMonth[] = [];

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    const isCurrentMonth = offset === 0;

    const revenue = invoices
      .filter((i) => {
        if (i.status !== "Emitida") return false;
        const id = new Date(i.dataEmissao);
        return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
      })
      .reduce((sum, i) => sum + i.valorTotal, 0);

    months.push({ month: MONTH_LABELS[d.getMonth()], revenue, isCurrentMonth });
  }

  return months;
}
