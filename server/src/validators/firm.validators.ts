import { z } from "zod";

export const FIRM_STATUS_VALUES = ["active", "trial", "suspended", "cancelled"] as const;

export const createAdminFirmSchema = z.object({
  name: z.string().trim().min(2, "Razão social deve ter ao menos 2 caracteres."),
  trade_name: z.string().trim().optional(),
  cnpj: z.string().trim().min(14, "CNPJ inválido."),
  email: z.string().trim().email("E-mail inválido."),
  phone: z.string().trim().optional(),
  timezone: z.string().trim().default("America/Sao_Paulo"),
  status: z.enum(FIRM_STATUS_VALUES).default("trial"),
});

export const updateAdminFirmSchema = createAdminFirmSchema.partial();

export const updateAdminFirmStatusSchema = z.object({
  status: z.enum(FIRM_STATUS_VALUES),
});

export type CreateAdminFirmInput = z.infer<typeof createAdminFirmSchema>;
export type UpdateAdminFirmInput = z.infer<typeof updateAdminFirmSchema>;