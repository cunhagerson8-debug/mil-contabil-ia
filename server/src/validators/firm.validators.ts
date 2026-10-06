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

// Onboarding: role, firmId e status NÃO são aceitos; zod descarta chaves desconhecidas.
export const onboardFirmSchema = z.object({
  name: z.string().trim().min(2, "Razão social deve ter ao menos 2 caracteres."),
  trade_name: z.string().trim().optional(),
  cnpj: z.string().trim().min(14, "CNPJ inválido."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  adminFullName: z.string().trim().min(2, "Informe o nome completo do administrador."),
  phone: z.string().trim().optional(),
  timezone: z.string().trim().default("America/Sao_Paulo"),
});

export const updateAdminFirmSchema = createAdminFirmSchema.partial();

export const updateAdminFirmStatusSchema = z.object({
  status: z.enum(FIRM_STATUS_VALUES),
});

export type CreateAdminFirmInput = z.infer<typeof createAdminFirmSchema>;
export type OnboardFirmInput = z.infer<typeof onboardFirmSchema>;
export type UpdateAdminFirmInput = z.infer<typeof updateAdminFirmSchema>;