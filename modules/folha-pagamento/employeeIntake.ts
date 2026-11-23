import type { EmployeeStatus } from "../../services/employeesApi";

export interface EmployeeIntakeValues {
  name?: string;
  cpf?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  registration?: string;
  admissionDate?: string;
  terminationDate?: string;
  salary?: number;
  employmentType?: string;
  status?: EmployeeStatus;
  companyName?: string;
  departmentName?: string;
}

export interface EmployeeIntakeResult {
  values: EmployeeIntakeValues;
  warnings: string[];
}

const FIELD_LABELS: Record<string, keyof EmployeeIntakeValues | null> = {
  nome: "name",
  nomecompleto: "name",
  cpf: "cpf",
  email: "email",
  telefone: "phone",
  celular: "phone",
  datadenascimento: null,
  nascimento: null,
  endereco: null,
  cep: null,
  municipio: null,
  uf: null,
  matricula: "registration",
  registro: "registration",
  cargo: "jobTitle",
  funcao: "jobTitle",
  empresa: "companyName",
  empresaempregadora: "companyName",
  departamento: "departmentName",
  setor: "departmentName",
  admissao: "admissionDate",
  datadeadmissao: "admissionDate",
  desligamento: "terminationDate",
  datadedesligamento: "terminationDate",
  salariobase: "salary",
  salario: "salary",
  tipodevinculo: "employmentType",
  vinculo: "employmentType",
  tipodecontrato: null,
  jornadasemanal: null,
  formaderemuneracao: null,
  situacao: "status",
  status: "status",
  pispasep: null,
  pis: null,
  pasep: null,
  esocial: null,
  dependentes: null,
  observacoes: null,
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value: string): string | undefined {
  const trimmed = value.trim();
  let isoDate: string | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    isoDate = trimmed;
  } else {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (match) {
      isoDate = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
  }
  if (!isoDate) return undefined;
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === isoDate
    ? isoDate
    : undefined;
}

function parseSalary(value: string): number | undefined {
  const normalized = value.replace(/[R$\s]/gi, "");
  let decimalValue: string;

  if (normalized.includes(",") && normalized.includes(".")) {
    if (!/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(normalized)) return undefined;
    decimalValue = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    if (!/^\d+,\d{1,2}$/.test(normalized)) return undefined;
    decimalValue = normalized.replace(",", ".");
  } else if (normalized.includes(".")) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
      decimalValue = normalized.replace(/\./g, "");
    } else if (/^\d+\.\d{1,2}$/.test(normalized)) {
      decimalValue = normalized;
    } else {
      return undefined;
    }
  } else {
    if (!/^\d+$/.test(normalized)) return undefined;
    decimalValue = normalized;
  }

  const salary = Number(decimalValue);
  return Number.isFinite(salary) && salary >= 0 ? salary : undefined;
}

function parseEmploymentType(value: string): string | undefined {
  const normalized = normalizeText(value);
  const types: Record<string, string> = {
    clt: "clt",
    estagio: "internship",
    internship: "internship",
    aprendiz: "apprentice",
    apprentice: "apprentice",
    temporario: "temporary",
    temporary: "temporary",
    pj: "contractor",
    pessoajuridica: "contractor",
    contractor: "contractor",
  };
  return types[normalized];
}

function parseStatus(value: string): EmployeeStatus | undefined {
  const normalized = normalizeText(value);
  const statuses: Record<string, EmployeeStatus> = {
    ativo: "active",
    active: "active",
    afastado: "leave",
    leave: "leave",
    ferias: "vacation",
    vacation: "vacation",
    desligado: "terminated",
    terminated: "terminated",
  };
  return statuses[normalized];
}

export function parseEmployeeInstruction(text: string): EmployeeIntakeResult {
  const values: EmployeeIntakeValues = {};
  const warnings: string[] = [];
  const labels = /\b(nome completo|nome|cpf|e-?mail|telefone|celular|data de nascimento|nascimento|endere[cç]o|cep|munic[ií]pio|uf|matr[ií]cula|registro|cargo|fun[cç][aã]o|empresa empregadora|empresa|departamento|setor|data de admiss[aã]o|admiss[aã]o|data de desligamento|desligamento|sal[aá]rio-base|sal[aá]rio|tipo de v[ií]nculo|v[ií]nculo|tipo de contrato|jornada semanal|forma de remunera[cç][aã]o|situa[cç][aã]o|status|pis\/pasep|pis|pasep|esocial|dependentes|observa[cç][oõ]es)\s*[:=]\s*/gi;
  const matches = Array.from(text.matchAll(labels));
  const seenFields = new Set<keyof EmployeeIntakeValues>();
  const ambiguousFields = new Set<keyof EmployeeIntakeValues>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const label = match[1];
    if (!label || match.index === undefined) continue;

    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const rawValue = text.slice(start, end).trim().replace(/[;,.\s]+$/, "");
    if (!rawValue) continue;

    const field = FIELD_LABELS[normalizeText(label)];
    if (field === undefined) continue;
    if (field === null) {
      warnings.push(`O campo "${label}" ainda não é suportado e não foi importado.`);
      continue;
    }
    if (ambiguousFields.has(field)) continue;
    if (seenFields.has(field)) {
      delete values[field];
      ambiguousFields.add(field);
      warnings.push(`O campo "${label}" foi informado mais de uma vez; revise-o manualmente.`);
      continue;
    }
    seenFields.add(field);

    if (field === "admissionDate" || field === "terminationDate") {
      const date = parseDate(rawValue);
      if (date) values[field] = date;
      else warnings.push(field === "admissionDate"
        ? "Data de admissão não reconhecida; informe DD/MM/AAAA ou AAAA-MM-DD."
        : "Data de desligamento não reconhecida; informe DD/MM/AAAA ou AAAA-MM-DD.");
    } else if (field === "salary") {
      const salary = parseSalary(rawValue);
      if (salary !== undefined) values.salary = salary;
      else warnings.push("Salário não reconhecido; confira o valor no formulário.");
    } else if (field === "employmentType") {
      const employmentType = parseEmploymentType(rawValue);
      if (employmentType) values.employmentType = employmentType;
      else warnings.push("Tipo de vínculo não reconhecido; selecione uma opção no formulário.");
    } else if (field === "status") {
      const status = parseStatus(rawValue);
      if (status) values.status = status;
      else warnings.push("Situação não reconhecida; selecione uma opção no formulário.");
    } else {
      values[field] = rawValue;
    }
  }

  return { values, warnings };
}

export function normalizeEmployeeIntakeText(value: string): string {
  return normalizeText(value);
}
