// =============================================================================
// MIL CONTÁBIL IA — Tipos centrais compartilhados
// -----------------------------------------------------------------------------
// Tipos específicos de cada módulo de negócio vivem em modules/<modulo>/types.ts
// e são reexportados aqui para manter compatibilidade com o restante do app.
// Isso garante que módulos possam ser extraídos (ex: Folha de Pagamento -> MIL RH IA)
// sem quebrar imports legados que apontam para "./types".
// =============================================================================

export enum AppSection {
  DASHBOARD = "DASHBOARD",
  EMPRESAS = "EMPRESAS",
  CLIENTES = "CLIENTES",
  OBRIGACOES_FISCAIS = "OBRIGACOES_FISCAIS",
  NOTAS_FISCAIS = "NOTAS_FISCAIS",
  ALERTAS = "ALERTAS",
  PORTAL_CLIENTE = "PORTAL_CLIENTE",
  USUARIOS = "USUARIOS",
  GESTAO_PAPEIS = "GESTAO_PAPEIS",
  PERFIL = "PERFIL",
  FISCAL = "FISCAL",
  CALCULATORS = "CALCULATORS",
  FOLHA_PAGAMENTO = "FOLHA_PAGAMENTO",
  NEWS = "NEWS",
  AI_CHAT = "AI_CHAT",
  ABERTURA_EMPRESA = "ABERTURA_EMPRESA",
  MIL_AUDITOR = "MIL_AUDITOR",
}

// -----------------------------------------------------------------------------
// Multi-empresa (tenancy): toda entidade de negócio carrega um companyId,
// preparando o terreno para isolamento de dados por empresa/escritório.
// -----------------------------------------------------------------------------
export interface Tenanted {
  companyId: string;
}

export type StatusObrigacao = "Em Dia" | "Próxima do Vencimento" | "Vencida";
export type StatusGenerico = "Pago" | "Pendente" | "Vencido" | "Ativo" | "Inativo";

// -----------------------------------------------------------------------------
// Reexports de módulos de negócio
// -----------------------------------------------------------------------------
export type { Company, Socio } from "./modules/empresas/types";
export type { Client, ClientDocument, ClientContact, ClientHistoryEntry } from "./modules/clientes/types";
export type {
  TaxObligation,
  ObligationType,
  ObligationStatus,
} from "./modules/obrigacoes-fiscais/types";
export type {
  Invoice,
  InvoiceStatus,
  InvoiceType,
} from "./modules/notas-fiscais/types";
export type { Alert, AlertSeverity, AlertCategory } from "./modules/alertas/types";
export type {
  PortalDocument,
  PortalMessage,
  PortalGuide,
} from "./modules/portal-cliente/types";
export type { AuthUser, UserRole, UserStatus, LoginCredentials, AuthSession } from "./modules/auth/types";

// -----------------------------------------------------------------------------
// Tipos legados (mantidos até a migração completa dos módulos placeholder)
// -----------------------------------------------------------------------------
export interface CalculationResult {
  label: string;
  value: number;
  description?: string;
}

export interface Employee {
  id: number;
  name: string;
  position: string;
  salary: number;
  status: "Pago" | "Pendente";
  admissionDate: string;
  lastPaymentDate?: string;
}

export interface TaxBill {
  id: string;
  name: string;
  type: "DAS" | "IRPJ" | "CSLL" | "PIS" | "COFINS" | "ISS" | "ICMS";
  value: number;
  dueDate: string;
  status: "Pago" | "Pendente" | "Vencido";
  referenceMonth: string;
}

export interface RevenueRecord {
  month: string;
  value: number;
  taxPaid: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  date: string;
  category: "Tributário" | "Trabalhista" | "Previdenciário" | "Geral";
  isUrgent: boolean;
  source: string;
}
