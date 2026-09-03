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
  registrosLimitados: boolean;
}