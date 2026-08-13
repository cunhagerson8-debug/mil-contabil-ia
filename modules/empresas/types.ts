// =============================================================================
// Módulo: Empresas
// Cadastro das empresas clientes do escritório contábil (raiz da multitenancy).
// =============================================================================

export type RegimeTributario = "Simples Nacional" | "Lucro Presumido" | "Lucro Real" | "MEI";
export type StatusEmpresa = "Ativa" | "Inativa" | "Em Abertura" | "Em Encerramento";

export interface Socio {
  id: string;
  nome: string;
  cpf: string;
  participacao: number; // percentual (0-100)
}

export interface Company {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  cnaeDescricao: string;
  regime: RegimeTributario;
  responsavel: string;
  contadorResponsavel: string;
  status: StatusEmpresa;
  dataAbertura: string;
  socios: Socio[];
  email: string;
  telefone: string;
  endereco: string;
  certificadoDigitalValidade?: string; // ISO date, alimenta Central de Alertas
}
