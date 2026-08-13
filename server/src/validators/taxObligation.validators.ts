// =============================================================================
// Validators: Tax Obligations
// =============================================================================
import { z } from "zod";

export const OBLIGATION_TYPE_VALUES = [
  "DAS", "PGDAS", "DCTFWeb", "EFD-Reinf", "eSocial", "FGTS Digital",
  "ECD", "ECF", "Certidão", "DARF", "GRF", "GFIP",
] as const;
export const OBLIGATION_STATUS_VALUES = ["Em Dia", "Próxima do Vencimento", "Vencida", "Não Aplicável"] as const;
export const OBLIGATION_PERIODICITY_VALUES = ["Mensal", "Trimestral", "Anual", "Eventual"] as const;

export const createTaxObligationSchema = z.object({
  companyId: z.string().uuid(),
  nome: z.string().min(2, "Nome da obrigação é obrigatório."),
  type: z.enum(OBLIGATION_TYPE_VALUES),
  competencia: z.string().min(4, "Competência inválida."),
  vencimento: z.string(),
  valor: z.number().nonnegative().optional(),
  observacoes: z.string().optional(),
  periodicidade: z.enum(OBLIGATION_PERIODICITY_VALUES),
});

export const updateTaxObligationSchema = createTaxObligationSchema.partial().extend({
  status: z.enum(OBLIGATION_STATUS_VALUES).optional(),
});

export const listTaxObligationsQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.enum(OBLIGATION_STATUS_VALUES).optional(),
});

export type CreateTaxObligationInput = z.infer<typeof createTaxObligationSchema>;
export type UpdateTaxObligationInput = z.infer<typeof updateTaxObligationSchema>;
