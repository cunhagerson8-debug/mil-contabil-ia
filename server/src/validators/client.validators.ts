// =============================================================================
// Validators: Clients
// =============================================================================
import { z } from "zod";

export const TIPO_CLIENTE_VALUES = ["Pessoa Física", "Pessoa Jurídica"] as const;
export const STATUS_CLIENTE_VALUES = ["Ativo", "Inativo", "Prospecto"] as const;

export const createClientSchema = z.object({
  companyId: z.string().uuid().optional(),
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  tipo: z.enum(TIPO_CLIENTE_VALUES),
  documento: z.string().min(11, "Documento inválido."),
  servicosContratados: z.array(z.string()).optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  status: z.enum(STATUS_CLIENTE_VALUES).optional(),
});

export const listClientsQuerySchema = z.object({
  status: z.enum(STATUS_CLIENTE_VALUES).optional(),
  search: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
