// =============================================================================
// Mapeamento TaxObligation: linha do banco <-> DTO de API.
// =============================================================================
import {
  TaxObligationRow, ObligationTypeDb, ObligationStatusDb,
  ObligationPeriodicityDb, ObligationIntegrationSourceDb,
} from "../types/db.js";
import {
  TaxObligationDto, ObligationType, ObligationStatus,
  ObligationPeriodicity, ObligationIntegrationSource,
} from "../types/dto.js";

const TYPE_DB_TO_DTO: Record<ObligationTypeDb, ObligationType> = {
  das: "DAS",
  pgdas: "PGDAS",
  dctfweb: "DCTFWeb",
  efd_reinf: "EFD-Reinf",
  esocial: "eSocial",
  fgts_digital: "FGTS Digital",
  ecd: "ECD",
  ecf: "ECF",
  certidao: "Certidão",
  darf: "DARF",
  grf: "GRF",
  gfip: "GFIP",
};
const TYPE_DTO_TO_DB: Record<ObligationType, ObligationTypeDb> = {
  "DAS": "das",
  "PGDAS": "pgdas",
  "DCTFWeb": "dctfweb",
  "EFD-Reinf": "efd_reinf",
  "eSocial": "esocial",
  "FGTS Digital": "fgts_digital",
  "ECD": "ecd",
  "ECF": "ecf",
  "Certidão": "certidao",
  "DARF": "darf",
  "GRF": "grf",
  "GFIP": "gfip",
};

const STATUS_DB_TO_DTO: Record<ObligationStatusDb, ObligationStatus> = {
  em_dia: "Em Dia",
  proxima_vencimento: "Próxima do Vencimento",
  vencida: "Vencida",
  nao_aplicavel: "Não Aplicável",
};
const STATUS_DTO_TO_DB: Record<ObligationStatus, ObligationStatusDb> = {
  "Em Dia": "em_dia",
  "Próxima do Vencimento": "proxima_vencimento",
  "Vencida": "vencida",
  "Não Aplicável": "nao_aplicavel",
};

const PERIODICITY_DB_TO_DTO: Record<ObligationPeriodicityDb, ObligationPeriodicity> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  eventual: "Eventual",
};
const PERIODICITY_DTO_TO_DB: Record<ObligationPeriodicity, ObligationPeriodicityDb> = {
  "Mensal": "mensal",
  "Trimestral": "trimestral",
  "Anual": "anual",
  "Eventual": "eventual",
};

const SOURCE_DB_TO_DTO: Record<ObligationIntegrationSourceDb, ObligationIntegrationSource> = {
  receita_federal: "Receita Federal",
  esocial: "eSocial",
  fgts_digital: "FGTS Digital",
  manual: "Manual",
};
const SOURCE_DTO_TO_DB: Record<ObligationIntegrationSource, ObligationIntegrationSourceDb> = {
  "Receita Federal": "receita_federal",
  "eSocial": "esocial",
  "FGTS Digital": "fgts_digital",
  "Manual": "manual",
};

export function obligationTypeToDb(type: ObligationType): ObligationTypeDb {
  return TYPE_DTO_TO_DB[type];
}
export function obligationStatusToDb(status: ObligationStatus): ObligationStatusDb {
  return STATUS_DTO_TO_DB[status];
}
export function periodicityToDb(p: ObligationPeriodicity): ObligationPeriodicityDb {
  return PERIODICITY_DTO_TO_DB[p];
}
export function integrationSourceToDb(s: ObligationIntegrationSource): ObligationIntegrationSourceDb {
  return SOURCE_DTO_TO_DB[s];
}

export function toTaxObligationDto(row: TaxObligationRow): TaxObligationDto {
  return {
    id: row.id,
    companyId: row.company_id,
    nome: row.nome,
    type: TYPE_DB_TO_DTO[row.type],
    competencia: row.competencia,
    vencimento: row.vencimento,
    status: STATUS_DB_TO_DTO[row.status],
    valor: row.valor !== null ? Number(row.valor) : undefined,
    observacoes: row.observacoes ?? undefined,
    periodicidade: PERIODICITY_DB_TO_DTO[row.periodicidade],
    integrationRef: row.integration_ref ?? undefined,
    integrationSource: row.integration_source ? SOURCE_DB_TO_DTO[row.integration_source] : undefined,
  };
}
