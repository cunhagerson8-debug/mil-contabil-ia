import { z } from "zod";

const EMPLOYEE_STATUSES = ["active", "vacation", "leave", "terminated"] as const;

function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const calculateDigit = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    return (sum * 10) % 11 % 10;
  };

  return calculateDigit(9) === Number(value[9])
    && calculateDigit(10) === Number(value[10]);
}

const cpfSchema = z.string()
  .trim()
  .regex(/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, "CPF inválido.")
  .transform((value) => value.replace(/\D/g, ""))
  .refine(isValidCpf, "CPF inválido.");

const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Informe uma data válida.");

const employeeFields = {
  companyId: z.string().uuid("Empresa inválida."),
  departmentId: z.string().uuid("Departamento inválido.").nullable().optional(),
  name: z.string().trim().min(2, "Informe o nome completo.").max(160, "Nome muito longo."),
  cpf: cpfSchema,
  email: z.string().trim().email("E-mail inválido.").max(254, "E-mail muito longo.").nullable().optional(),
  phone: z.string().trim().max(40, "Telefone muito longo.").nullable().optional(),
  jobTitle: z.string().trim().max(120, "Cargo muito longo.").nullable().optional(),
  registration: z.string().trim().max(50, "Matrícula muito longa.").nullable().optional(),
  admissionDate: dateSchema,
  terminationDate: dateSchema.nullable().optional(),
  salary: z.number().finite().min(0, "O salário não pode ser negativo.")
    .max(999999999999.99, "Salário acima do limite permitido.").nullable().optional(),
  employmentType: z.string().trim().min(1).max(40).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
};

function validateEmploymentDates(
  data: { admissionDate?: string; terminationDate?: string | null; status?: typeof EMPLOYEE_STATUSES[number] },
  context: z.RefinementCtx
): void {
  if (data.status === "terminated" && !data.terminationDate) {
    context.addIssue({
      code: "custom",
      path: ["terminationDate"],
      message: "Informe a data de desligamento.",
    });
  }
  if (data.admissionDate && data.terminationDate && data.terminationDate < data.admissionDate) {
    context.addIssue({
      code: "custom",
      path: ["terminationDate"],
      message: "A data de desligamento não pode ser anterior à admissão.",
    });
  }
  if (data.terminationDate && data.status !== "terminated") {
    context.addIssue({
      code: "custom",
      path: ["terminationDate"],
      message: "A data de desligamento exige a situação desligado.",
    });
  }
}

export const createEmployeeSchema = z.object(employeeFields).superRefine(validateEmploymentDates);

export const updateEmployeeSchema = z.object(employeeFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Informe ao menos um campo para atualizar.")
  .superRefine(validateEmploymentDates);

export const listEmployeesQuerySchema = z.object({
  companyId: z.string().uuid("Empresa inválida.").optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  search: z.string().trim().max(100, "Pesquisa muito longa.").optional(),
});

export const listEmployeeDepartmentsQuerySchema = z.object({
  companyId: z.string().uuid("Empresa inválida."),
});

export const employeeIdSchema = z.string().uuid("Colaborador inválido.");

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeStatus = typeof EMPLOYEE_STATUSES[number];
