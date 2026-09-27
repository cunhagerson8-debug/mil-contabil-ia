export type AiObligationClassification = "vencida" | "proxima" | "em_dia" | "nao_aplicavel";

export interface AiCompanyRecord {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  regime: string;
  status: string;
}

export interface AiObligationRecord {
  companyId?: string;
  companyName: string;
  nome: string;
  type: string;
  competencia: string;
  vencimento: string;
  classificacao: AiObligationClassification;
  valor?: number;
}

// Allowlist do Resumo Executivo do MIL Auditor exposta à MIL IA: somente os
// campos já classificados deterministicamente pelo backend, sem IDs
// internos, CNPJ/CPF, valores financeiros, certificados, segredos ou
// qualquer payload bruto de banco.
export interface AiExecutivePriority {
  companyName: string | null;
  obligationType: string;
  obligationName: string;
  dueDate: string | null;
  priority: "critica" | "alta";
  priorityReason: string;
  recommendation: string;
  requiresHumanDecision: boolean;
}

export interface AiExecutiveSummary {
  totalCriticalPendencies: number;
  totalOverdueObligations: number;
  totalUpcomingObligations: number;
  topPriorities: AiExecutivePriority[];
  factualSummary: string;
}

export interface AiContextData {
  escopo: "escritorio" | "empresa" | "plataforma";
  totalEscritorios?: number;
  totalEmpresas: number;
  empresasAtivas: number;
  empresasEmDia: number;
  empresasComVencidas: number;
  empresasComProximas: number;
  obrigacoesVencidas: number;
  obrigacoesProximas: number;
  obrigacoesEmDia: number;
  empresaSelecionada?: AiCompanyRecord;
  empresas?: AiCompanyRecord[];
  obrigacoesRelevantes: AiObligationRecord[];
  executiveSummary: AiExecutiveSummary;
  registrosLimitados: boolean;
}