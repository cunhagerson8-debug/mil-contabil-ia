// =============================================================================
// Mapeamento Client: linha do banco <-> DTO de API.
// =============================================================================
import {
  ClientRow, ClientContactRow, ClientDocumentRow, ClientHistoryRow,
  TipoClienteDb, StatusClienteDb,
} from "../types/db.js";
import {
  ClientDto, ClientContactDto, ClientDocumentDto, ClientHistoryEntryDto,
  TipoCliente, StatusCliente,
} from "../types/dto.js";

const TIPO_DB_TO_DTO: Record<TipoClienteDb, TipoCliente> = {
  pessoa_fisica: "Pessoa Física",
  pessoa_juridica: "Pessoa Jurídica",
};
const TIPO_DTO_TO_DB: Record<TipoCliente, TipoClienteDb> = {
  "Pessoa Física": "pessoa_fisica",
  "Pessoa Jurídica": "pessoa_juridica",
};

const STATUS_DB_TO_DTO: Record<StatusClienteDb, StatusCliente> = {
  ativo: "Ativo",
  inativo: "Inativo",
  prospecto: "Prospecto",
};
const STATUS_DTO_TO_DB: Record<StatusCliente, StatusClienteDb> = {
  "Ativo": "ativo",
  "Inativo": "inativo",
  "Prospecto": "prospecto",
};

export function tipoClienteToDb(tipo: TipoCliente): TipoClienteDb {
  return TIPO_DTO_TO_DB[tipo];
}
export function statusClienteToDb(status: StatusCliente): StatusClienteDb {
  return STATUS_DTO_TO_DB[status];
}

function toContactDto(row: ClientContactRow): ClientContactDto {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo ?? "",
    email: row.email ?? "",
    telefone: row.telefone ?? "",
    principal: row.principal,
  };
}

function toDocumentDto(row: ClientDocumentRow): ClientDocumentDto {
  const TIPO_MAP: Record<string, ClientDocumentDto["tipo"]> = {
    contrato_social: "Contrato Social",
    procuracao: "Procuração",
    certidao: "Certidão",
    comprovante: "Comprovante",
    outro: "Outro",
  };
  return {
    id: row.id,
    nome: row.nome,
    tipo: TIPO_MAP[row.tipo] ?? "Outro",
    dataUpload: row.data_upload,
    validade: row.validade ?? undefined,
  };
}

function toHistoryDto(row: ClientHistoryRow): ClientHistoryEntryDto {
  const TIPO_MAP: Record<string, ClientHistoryEntryDto["tipo"]> = {
    atendimento: "Atendimento",
    documento: "Documento",
    cobranca: "Cobrança",
    observacao: "Observação",
  };
  return {
    id: row.id,
    data: row.data,
    tipo: TIPO_MAP[row.tipo] ?? "Observação",
    descricao: row.descricao,
    responsavel: row.responsavel_nome ?? "—",
  };
}

export function toClientDto(
  row: ClientRow,
  contacts: ClientContactRow[],
  documents: ClientDocumentRow[],
  history: ClientHistoryRow[]
): ClientDto {
  return {
    id: row.id,
    companyId: row.company_id ?? undefined,
    nome: row.nome,
    tipo: TIPO_DB_TO_DTO[row.tipo],
    documento: row.documento,
    status: STATUS_DB_TO_DTO[row.status],
    dataCadastro: row.data_cadastro,
    servicosContratados: row.servicos_contratados,
    contatos: contacts.map(toContactDto),
    documentos: documents.map(toDocumentDto),
    historico: history.map(toHistoryDto),
  };
}
