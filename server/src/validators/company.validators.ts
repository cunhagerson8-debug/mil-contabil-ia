// =============================================================================
// Validators: Companies
// -----------------------------------------------------------------------------
// Schemas Zod separados dos controllers para serem reutilizáveis (ex: um
// futuro endpoint de importação em lote pode validar cada linha com o mesmo
// createCompanySchema) e para manter o controller focado em orquestração,
// não em definição de regras de formato de campo.
// =============================================================================
import { z } from "zod";

export const REGIME_VALUES = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"] as const;
export const STATUS_EMPRESA_VALUES = ["Ativa", "Inativa", "Em Abertura", "Em Encerramento"] as const;

export const createCompanySchema = z.object({
  razaoSocial: z.string().min(2, "Razão social deve ter ao menos 2 caracteres."),
  nomeFantasia: z.string().min(2, "Nome fantasia deve ter ao menos 2 caracteres."),
  cnpj: z.string().min(14, "CNPJ inválido."),
  cnae: z.string().min(1, "CNAE é obrigatório."),
  cnaeDescricao: z.string().optional(),
  regime: z.enum(REGIME_VALUES),
  responsavel: z.string().min(2, "Nome do responsável é obrigatório."),
  contadorResponsavelId: z.string().uuid().optional(),
  dataAbertura: z.string(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial().extend({
  status: z.enum(STATUS_EMPRESA_VALUES).optional(),
});

export const listCompaniesQuerySchema = z.object({
  status: z.enum(STATUS_EMPRESA_VALUES).optional(),
  search: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
