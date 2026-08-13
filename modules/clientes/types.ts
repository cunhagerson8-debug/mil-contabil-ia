// =============================================================================
// Módulo: Clientes
// Cadastro completo de clientes (pessoa física ou jurídica), documentos,
// contatos e histórico de interações.
// =============================================================================

export type TipoCliente = "Pessoa Física" | "Pessoa Jurídica";
export type StatusCliente = "Ativo" | "Inativo" | "Prospecto";

export interface ClientDocument {
  id: string;
  nome: string;
  tipo: "Contrato Social" | "Procuração" | "Certidão" | "Comprovante" | "Outro";
  dataUpload: string;
  validade?: string;
}

export interface ClientContact {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  principal: boolean;
}

export interface ClientHistoryEntry {
  id: string;
  data: string;
  tipo: "Atendimento" | "Documento" | "Cobrança" | "Observação";
  descricao: string;
  responsavel: string;
}

export interface Client {
  id: string;
  companyId?: string; // vínculo opcional com empresa cadastrada no módulo Empresas
  nome: string;
  tipo: TipoCliente;
  documento: string; // CPF ou CNPJ
  status: StatusCliente;
  dataCadastro: string;
  servicosContratados: string[];
  contatos: ClientContact[];
  documentos: ClientDocument[];
  historico: ClientHistoryEntry[];
}
