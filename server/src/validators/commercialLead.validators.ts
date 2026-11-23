import { z } from "zod";

export const COMMERCIAL_LEAD_STATUSES = [
  "new",
  "contacting",
  "qualified",
  "converted",
  "closed",
] as const;

export const COMMERCIAL_LEAD_INTERESTS = [
  "software_subscription",
  "accounting_services",
  "both",
  "undecided",
] as const;

export function normalizeBrazilianWhatsApp(value: string): string | null {
  if (!/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;

  if (nationalNumber.length !== 10 && nationalNumber.length !== 11) return null;
  return `+55${nationalNumber}`;
}

export const publicCommercialLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Nome muito longo."),
  whatsapp: z.string()
    .trim()
    .min(8, "Informe um WhatsApp válido.")
    .max(24, "Informe um WhatsApp válido.")
    .refine((value) => normalizeBrazilianWhatsApp(value) !== null, "Informe um WhatsApp válido."),
  email: z.union([
    z.string().trim().max(254).email("Informe um e-mail válido."),
    z.literal(""),
  ]).optional(),
  serviceInterest: z.enum(COMMERCIAL_LEAD_INTERESTS),
  voluntaryDetails: z.string().trim().max(500, "Use até 500 caracteres.").optional(),
  consent: z.literal(true, { error: "É necessário autorizar o armazenamento e o contato." }),
  website: z.string().max(200).optional(),
}).strict();

export const commercialLeadListQuerySchema = z.object({
  status: z.enum(COMMERCIAL_LEAD_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const commercialLeadStatusSchema = z.object({
  status: z.enum(COMMERCIAL_LEAD_STATUSES),
}).strict();

export const commercialLeadIdSchema = z.string().uuid();

export type PublicCommercialLeadInput = z.infer<typeof publicCommercialLeadSchema>;
export type CommercialLeadListQuery = z.infer<typeof commercialLeadListQuerySchema>;
