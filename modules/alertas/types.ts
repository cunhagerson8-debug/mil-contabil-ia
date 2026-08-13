// =============================================================================
// Módulo: Central de Alertas
// Agrega alertas críticos de todos os módulos em um painel unificado.
// Fontes: Obrigações Fiscais, Certificados A1, Pendências Fiscais,
//         Notas Fiscais rejeitadas, Clientes inadimplentes.
// =============================================================================

export type AlertSeverity = "Crítico" | "Atenção" | "Informativo";
export type AlertCategory =
  | "Obrigação Fiscal"
  | "Certificado Digital"
  | "Pendência Fiscal"
  | "Nota Fiscal"
  | "Cliente"
  | "Sistema";

export interface Alert {
  id: string;
  companyId?: string;      // undefined = alerta de sistema/plataforma
  title: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  createdAt: string;       // ISO datetime
  dueDate?: string;        // data limite (vencimento da obrigação etc.)
  read: boolean;
  actionLabel?: string;    // texto do botão de ação
  actionTarget?: string;   // AppSection ou URL destino
  sourceModule: string;    // qual módulo originou o alerta
}
