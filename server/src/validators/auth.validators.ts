// =============================================================================
// Validators: Auth
// =============================================================================
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  password: z.string().min(1, "Senha é obrigatória."),
});

export const registerSchema = z.object({
  firm: z.object({
    name: z.string().min(1, "Nome do escritório é obrigatório."),
    tradeName: z.string().optional(),
    cnpj: z.string().min(1, "CNPJ é obrigatório."),
    email: z.string().email("E-mail do escritório inválido."),
    phone: z.string().optional(),
    timezone: z.string().optional(),
  }),
  admin: z.object({
    fullName: z.string().min(1, "Nome do administrador é obrigatório."),
    email: z.string().email("E-mail do administrador inválido."),
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres."),
    phone: z.string().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
