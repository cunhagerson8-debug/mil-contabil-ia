// =============================================================================
// Tipos que espelham as linhas EXATAS retornadas pelo Postgres (snake_case,
// nomes e tipos de coluna idênticos às migrations). Não confundir com os
// DTOs de API (camelCase, enums em PT-BR) — a tradução entre os dois mundos
// acontece exclusivamente em src/mappers/*.
// =============================================================================

export type RegimeTributarioDb = "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei";
export type StatusEmpresaDb = "ativa" | "inativa" | "em_abertura" | "em_encerramento";

export interface CompanyRow {
  id: string;
  firm_id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  cnae: string;
  cnae_descricao: string | null;
  regime: RegimeTributarioDb;
  responsavel: string;
  contador_responsavel_id: string | null;
  status: StatusEmpresaDb;
  data_abertura: string; // date -> ISO string via pg
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Linha "enriquecida" via JOIN — usada pelo repository quando o service
// precisa exibir o nome do contador responsável (frontend espera o NOME,
// não o id — ver mappers/company.mapper.ts).
export interface CompanyRowWithContador extends CompanyRow {
  contador_responsavel_nome: string | null;
}

export interface CompanyPartnerRow {
  id: string;
  company_id: string;
  nome: string;
  cpf: string;
  participacao: string; // numeric(5,2) -> string via pg (evita perda de precisão)
}

export interface DigitalCertificateRow {
  id: string;
  company_id: string;
  titular: string;
  cnpj: string;
  vault_reference: string;
  valid_from: string;
  valid_until: string;
  revoked_at: string | null;
}

// -----------------------------------------------------------------------------
export type TipoClienteDb = "pessoa_fisica" | "pessoa_juridica";
export type StatusClienteDb = "ativo" | "inativo" | "prospecto";

export interface ClientRow {
  id: string;
  firm_id: string;
  company_id: string | null;
  nome: string;
  tipo: TipoClienteDb;
  documento: string;
  status: StatusClienteDb;
  data_cadastro: string;
  servicos_contratados: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClientContactRow {
  id: string;
  client_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
}

export interface ClientDocumentRow {
  id: string;
  client_id: string;
  nome: string;
  tipo: string;
  storage_key: string;
  tamanho_bytes: string | null;
  data_upload: string;
  validade: string | null;
}

export interface ClientHistoryRow {
  id: string;
  client_id: string;
  tipo: string;
  descricao: string;
  responsavel_id: string | null;
  responsavel_nome: string | null; // via JOIN com users
  data: string;
}

// -----------------------------------------------------------------------------
export type ObligationTypeDb =
  | "das" | "pgdas" | "dctfweb" | "efd_reinf" | "esocial" | "fgts_digital"
  | "ecd" | "ecf" | "certidao" | "darf" | "grf" | "gfip";
export type ObligationStatusDb = "em_dia" | "proxima_vencimento" | "vencida" | "nao_aplicavel";
export type ObligationPeriodicityDb = "mensal" | "trimestral" | "anual" | "eventual";
export type ObligationIntegrationSourceDb = "receita_federal" | "esocial" | "fgts_digital" | "manual";

export interface TaxObligationRow {
  id: string;
  firm_id: string;
  company_id: string;
  nome: string;
  type: ObligationTypeDb;
  competencia: string;
  vencimento: string;
  status: ObligationStatusDb;
  valor: string | null; // numeric -> string via pg
  observacoes: string | null;
  periodicidade: ObligationPeriodicityDb;
  integration_ref: string | null;
  integration_source: ObligationIntegrationSourceDb | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
export type UserRoleDb = "platform_admin" | "firm_owner" | "accountant" | "company_manager" | "company_user";
export type UserStatusDb = "active" | "invited" | "suspended" | "deactivated";

export interface UserRow {
  id: string;
  firm_id: string | null;
  role: UserRoleDb;
  status: UserStatusDb;
  full_name: string;
  email: string;
  phone: string | null;
  password_hash: string | null;
  auth_provider: string;
  mfa_enabled: boolean;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface UserRowWithFirm extends UserRow {
  firm_name: string | null;
}

export interface UserCompanyAccessRow {
  user_id: string;
  company_id: string;
  can_manage: boolean;
}
