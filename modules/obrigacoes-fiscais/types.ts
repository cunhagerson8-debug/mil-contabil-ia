// =============================================================================
// Módulo: Obrigações Fiscais
// Controle de todas as obrigações acessórias e principais do escritório.
// Alimenta automaticamente a Central de Alertas quando status = Vencida ou
// Próxima do Vencimento.
// =============================================================================

export type ObligationType =
  | "DAS"
  | "PGDAS"
  | "DCTFWeb"
  | "EFD-Reinf"
  | "eSocial"
  | "FGTS Digital"
  | "ECD"
  | "ECF"
  | "Certidão"
  | "DARF"
  | "GRF"
  | "GFIP";

export type ObligationStatus = "Em Dia" | "Próxima do Vencimento" | "Vencida" | "Não Aplicável";
export type ObligationPeriodicity = "Mensal" | "Trimestral" | "Anual" | "Eventual";

export interface TaxObligation {
  id: string;
  companyId: string;        // empresa a que pertence
  nome: string;
  type: ObligationType;
  competencia: string;      // ex: "06/2026"
  vencimento: string;       // ISO date
  status: ObligationStatus;
  valor?: number;
  observacoes?: string;
  periodicidade: ObligationPeriodicity;
  // integration hooks — preenchidos quando integração estiver ativa
  integrationRef?: string;  // ex: protocolo eSocial, número recibo PGDAS
  integrationSource?: "Receita Federal" | "eSocial" | "FGTS Digital" | "Manual";
}
