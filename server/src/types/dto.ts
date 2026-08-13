// =============================================================================
// DTOs de API — formato EXATO que o frontend já espera (camelCase, enums em
// PT-BR como nos arquivos modules/*/types.ts). Mantidos como cópia
// intencional (não import direto do frontend) porque o backend não deve
// depender do código do frontend — são contratos publicados
// independentemente, e o frontend é apenas um dos consumidores possíveis.
// =============================================================================

export type RegimeTributario = "Simples Nacional" | "Lucro Presumido" | "Lucro Real" | "MEI";
export type StatusEmpresa = "Ativa" | "Inativa" | "Em Abertura" | "Em Encerramento";

export interface SocioDto {
  id: string;
  nome: string;
  cpf: string;
  participacao: number;
}

export interface CompanyDto {
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
  socios: SocioDto[];
  email: string;
  telefone: string;
  endereco: string;
  certificadoDigitalValidade?: string;
}

export interface CompanyCreateInput {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  cnaeDescricao?: string;
  regime: RegimeTributario;
  responsavel: string;
  contadorResponsavelId?: string;
  dataAbertura: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

export type CompanyUpdateInput = Partial<CompanyCreateInput> & { status?: StatusEmpresa };

// -----------------------------------------------------------------------------
export type TipoCliente = "Pessoa Física" | "Pessoa Jurídica";
export type StatusCliente = "Ativo" | "Inativo" | "Prospecto";

export interface ClientContactDto {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  principal: boolean;
}

export interface ClientDocumentDto {
  id: string;
  nome: string;
  tipo: "Contrato Social" | "Procuração" | "Certidão" | "Comprovante" | "Outro";
  dataUpload: string;
  validade?: string;
}

export interface ClientHistoryEntryDto {
  id: string;
  data: string;
  tipo: "Atendimento" | "Documento" | "Cobrança" | "Observação";
  descricao: string;
  responsavel: string;
}

export interface ClientDto {
  id: string;
  companyId?: string;
  nome: string;
  tipo: TipoCliente;
  documento: string;
  status: StatusCliente;
  dataCadastro: string;
  servicosContratados: string[];
  contatos: ClientContactDto[];
  documentos: ClientDocumentDto[];
  historico: ClientHistoryEntryDto[];
}

export interface ClientCreateInput {
  companyId?: string;
  nome: string;
  tipo: TipoCliente;
  documento: string;
  status?: StatusCliente;
  servicosContratados?: string[];
}

export type ClientUpdateInput = Partial<ClientCreateInput>;

// -----------------------------------------------------------------------------
export type ObligationType =
  | "DAS" | "PGDAS" | "DCTFWeb" | "EFD-Reinf" | "eSocial" | "FGTS Digital"
  | "ECD" | "ECF" | "Certidão" | "DARF" | "GRF" | "GFIP";
export type ObligationStatus = "Em Dia" | "Próxima do Vencimento" | "Vencida" | "Não Aplicável";
export type ObligationPeriodicity = "Mensal" | "Trimestral" | "Anual" | "Eventual";
export type ObligationIntegrationSource = "Receita Federal" | "eSocial" | "FGTS Digital" | "Manual";

export interface TaxObligationDto {
  id: string;
  companyId: string;
  nome: string;
  type: ObligationType;
  competencia: string;
  vencimento: string;
  status: ObligationStatus;
  valor?: number;
  observacoes?: string;
  periodicidade: ObligationPeriodicity;
  integrationRef?: string;
  integrationSource?: ObligationIntegrationSource;
}

export interface TaxObligationCreateInput {
  companyId: string;
  nome: string;
  type: ObligationType;
  competencia: string;
  vencimento: string;
  valor?: number;
  observacoes?: string;
  periodicidade: ObligationPeriodicity;
}

export type TaxObligationUpdateInput = Partial<TaxObligationCreateInput> & { status?: ObligationStatus };

// -----------------------------------------------------------------------------
export type UserRole = "platform_admin" | "firm_owner" | "accountant" | "company_manager" | "company_user";
export type UserStatus = "active" | "invited" | "suspended" | "deactivated";

export interface AuthUserDto {
  id: string;
  firmId: string | null;
  firmName?: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  email: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  companyAccess?: string[];
  canManageCompanies?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterFirmInput {
  name: string;
  tradeName?: string;
  cnpj: string;
  email: string;
  phone?: string;
  timezone?: string;
}

export interface RegisterAdminInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface RegisterInput {
  firm: RegisterFirmInput;
  admin: RegisterAdminInput;
}

export interface AuthSessionDto {
  user: AuthUserDto;
  token: string;
  expiresAt: string;
}
