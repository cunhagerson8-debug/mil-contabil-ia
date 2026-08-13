// =============================================================================
// Mapeamento Company: linha do banco (snake_case, enums em inglês/snake_case)
// <-> DTO de API (camelCase, enums em PT-BR — formato que o frontend espera).
// =============================================================================
import { CompanyRowWithContador, CompanyPartnerRow, RegimeTributarioDb, StatusEmpresaDb } from "../types/db.js";
import { CompanyDto, RegimeTributario, StatusEmpresa, SocioDto } from "../types/dto.js";

const REGIME_DB_TO_DTO: Record<RegimeTributarioDb, RegimeTributario> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};
const REGIME_DTO_TO_DB: Record<RegimeTributario, RegimeTributarioDb> = {
  "Simples Nacional": "simples_nacional",
  "Lucro Presumido": "lucro_presumido",
  "Lucro Real": "lucro_real",
  "MEI": "mei",
};

const STATUS_DB_TO_DTO: Record<StatusEmpresaDb, StatusEmpresa> = {
  ativa: "Ativa",
  inativa: "Inativa",
  em_abertura: "Em Abertura",
  em_encerramento: "Em Encerramento",
};
const STATUS_DTO_TO_DB: Record<StatusEmpresa, StatusEmpresaDb> = {
  "Ativa": "ativa",
  "Inativa": "inativa",
  "Em Abertura": "em_abertura",
  "Em Encerramento": "em_encerramento",
};

export function regimeToDb(regime: RegimeTributario): RegimeTributarioDb {
  return REGIME_DTO_TO_DB[regime];
}
export function statusEmpresaToDb(status: StatusEmpresa): StatusEmpresaDb {
  return STATUS_DTO_TO_DB[status];
}

export function toSocioDto(row: CompanyPartnerRow): SocioDto {
  return {
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    participacao: Number(row.participacao),
  };
}

export function toCompanyDto(
  row: CompanyRowWithContador,
  socios: CompanyPartnerRow[],
  certificadoValidUntil: string | null
): CompanyDto {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    cnpj: row.cnpj,
    cnae: row.cnae,
    cnaeDescricao: row.cnae_descricao ?? "",
    regime: REGIME_DB_TO_DTO[row.regime],
    responsavel: row.responsavel,
    contadorResponsavel: row.contador_responsavel_nome ?? "",
    status: STATUS_DB_TO_DTO[row.status],
    dataAbertura: row.data_abertura,
    socios: socios.map(toSocioDto),
    email: row.email ?? "",
    telefone: row.telefone ?? "",
    endereco: row.endereco ?? "",
    certificadoDigitalValidade: certificadoValidUntil ?? undefined,
  };
}
