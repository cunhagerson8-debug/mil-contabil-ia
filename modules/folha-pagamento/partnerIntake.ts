export type PartnerWithdrawalStatus = "not_reported" | "none_declared" | "amount_reported";
export type PartnerPaymentStatus = "not_reported" | "pending" | "paid" | "not_applicable";

export interface PartnerAdministratorDraft {
  companyId: string;
  companyName: string;
  name: string;
  cpf: string;
  isAdministrator: boolean;
  isSoleShareholder: boolean;
  participation: number | null;
  competence: string | null;
  withdrawalStatus: PartnerWithdrawalStatus;
  proLaboreAmount: number | null;
  paymentStatus: PartnerPaymentStatus;
}

export interface PartnerIntakeValues {
  companyName?: string;
  name?: string;
  cpf?: string;
  isAdministrator?: boolean;
  isSoleShareholder?: boolean;
  participation?: number;
  competence?: string;
  withdrawalStatus?: PartnerWithdrawalStatus;
  proLaboreAmount?: number;
  paymentStatus?: PartnerPaymentStatus;
}

export interface PartnerIntakeResult {
  values: PartnerIntakeValues;
  warnings: string[];
}

const FIELD_LABELS: Record<string, keyof PartnerIntakeValues> = {
  empresa: "companyName",
  "nome do socio": "name",
  nome: "name",
  cpf: "cpf",
  perfil: "isAdministrator",
  administrador: "isAdministrator",
  administradora: "isAdministrator",
  "socio unico": "isSoleShareholder",
  "socia unica": "isSoleShareholder",
  participacao: "participation",
  "competencia do pro labore": "competence",
  competencia: "competence",
  "pro labore": "withdrawalStatus",
  retirada: "withdrawalStatus",
  "valor do pro labore": "proLaboreAmount",
  "valor de pro labore": "proLaboreAmount",
  pagamento: "paymentStatus",
  "situacao do pagamento": "paymentStatus",
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseBoolean(value: string): boolean | undefined {
  const normalized = normalizeText(value);
  if (["sim", "yes", "true", "administrador", "administradora", "socio unico", "socia unica"].includes(normalized)) return true;
  if (["nao", "no", "false", "nao administrador", "nao administradora"].includes(normalized)) return false;
  return undefined;
}

function parseCompetence(value: string): string | undefined {
  const normalized = value.trim().replace(/\.$/, "");
  const monthFirst = /^(\d{1,2})\/(\d{4})$/.exec(normalized);
  const yearFirst = /^(\d{4})-(\d{1,2})$/.exec(normalized);
  const year = monthFirst?.[2] ?? yearFirst?.[1];
  const month = monthFirst?.[1] ?? yearFirst?.[2];
  if (!year || !month) return undefined;
  const monthNumber = Number(month);
  if (monthNumber < 1 || monthNumber > 12) return undefined;
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function parseMoney(value: string): number | undefined {
  const normalized = value.trim().replace(/\.$/, "").replace(/[R$\s]/gi, "");
  let decimalValue: string;
  if (normalized.includes(",") && normalized.includes(".")) {
    if (!/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(normalized)) return undefined;
    decimalValue = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    if (!/^\d+,\d{1,2}$/.test(normalized)) return undefined;
    decimalValue = normalized.replace(",", ".");
  } else if (/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    decimalValue = normalized;
  } else {
    return undefined;
  }
  const amount = Number(decimalValue);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function parseWithdrawal(value: string): PartnerWithdrawalStatus | undefined {
  const normalized = normalizeText(value);
  if (
    normalized.includes("nao informado")
    || normalized.includes("nenhuma retirada informada")
    || normalized.includes("sem informacao")
  ) return "not_reported";
  if (
    normalized.includes("sem retirada")
    || normalized.includes("nao houve retirada")
    || normalized === "nenhuma retirada"
  ) return "none_declared";
  if (parseMoney(value) !== undefined) return "amount_reported";
  return undefined;
}

function parsePaymentStatus(value: string): PartnerPaymentStatus | undefined {
  const normalized = normalizeText(value);
  if (["pago", "paga", "paid"].includes(normalized)) return "paid";
  if (["pendente", "pending"].includes(normalized)) return "pending";
  if (["nao aplicavel", "not applicable"].includes(normalized)) return "not_applicable";
  if (["nao informado", "not reported"].includes(normalized)) return "not_reported";
  return undefined;
}

export function parsePartnerInstruction(text: string): PartnerIntakeResult {
  const values: PartnerIntakeValues = {};
  const warnings: string[] = [];
  const labels = /\b(empresa|nome do s[oó]cio|nome|cpf|perfil|administrador|administradora|s[oó]cio [uú]nico|s[oó]cia [uú]nica|participa[cç][aã]o|compet[eê]ncia do pr[oó]-labore|compet[eê]ncia|pr[oó]-labore|retirada|valor do pr[oó]-labore|valor de pr[oó]-labore|situa[cç][aã]o do pagamento|pagamento)\s*[:=]\s*/gi;
  const matches = Array.from(text.matchAll(labels));
  const seen = new Set<keyof PartnerIntakeValues>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const label = match[1];
    if (!label || match.index === undefined) continue;

    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const rawValue = text.slice(start, end).trim().replace(/[;,]+$/, "").trim();
    if (!rawValue) continue;

    const field = FIELD_LABELS[normalizeText(label)];
    if (!field) continue;
    if (seen.has(field)) {
      delete values[field];
      warnings.push(`O campo "${label}" foi informado mais de uma vez; revise-o manualmente.`);
      continue;
    }
    seen.add(field);

    if (field === "companyName" || field === "name" || field === "cpf") {
      values[field] = rawValue;
    } else if (field === "isAdministrator" || field === "isSoleShareholder") {
      if (field === "isAdministrator") {
        const profile = normalizeText(rawValue);
        const labelKey = normalizeText(label);
        const saysNoAdmin = profile.includes("nao administrador")
          || profile.includes("nao administradora")
          || profile.includes("sem administrador");
        const hasAdminRole = profile.includes("administrador") && !saysNoAdmin;
        const hasSoleRole = profile.includes("socio unico") || profile.includes("socia unica");
        const booleanValue = parseBoolean(rawValue);
        if (hasSoleRole) values.isSoleShareholder = true;
        if (labelKey === "perfil") {
          if (hasAdminRole || saysNoAdmin) values.isAdministrator = !saysNoAdmin;
          else if (!hasSoleRole) warnings.push("Perfil de administração não reconhecido; confirme-o no formulário.");
        } else if (booleanValue !== undefined) {
          values.isAdministrator = booleanValue;
        } else if (hasAdminRole || saysNoAdmin) {
          values.isAdministrator = !saysNoAdmin;
        } else warnings.push("Perfil de administração não reconhecido; confirme-o no formulário.");
      } else {
        const value = parseBoolean(rawValue);
        if (value !== undefined) values.isSoleShareholder = value;
        else warnings.push("Indicação de sócio único não reconhecida; confirme-a no formulário.");
      }
    } else if (field === "participation") {
      const participationText = rawValue.replace(/%\s*$/, "").replace(/\.$/, "").replace(",", ".").trim();
      const participation = /^\d{1,3}(?:\.\d{1,2})?$/.test(participationText)
        ? Number(participationText)
        : Number.NaN;
      if (Number.isFinite(participation) && participation >= 0 && participation <= 100) {
        values.participation = participation;
      } else warnings.push("Participação societária não reconhecida; informe um percentual entre 0 e 100.");
    } else if (field === "competence") {
      const competence = parseCompetence(rawValue);
      if (competence) values.competence = competence;
      else warnings.push("Competência não reconhecida; informe MM/AAAA ou AAAA-MM.");
    } else if (field === "withdrawalStatus") {
      const status = parseWithdrawal(rawValue);
      if (status) {
        values.withdrawalStatus = status;
        if (status === "amount_reported") values.proLaboreAmount = parseMoney(rawValue);
      } else warnings.push("Pró-labore não reconhecido; selecione uma situação no formulário.");
    } else if (field === "proLaboreAmount") {
      const amount = parseMoney(rawValue);
      if (amount !== undefined) {
        values.proLaboreAmount = amount;
        values.withdrawalStatus = "amount_reported";
      } else warnings.push("Valor de pró-labore não reconhecido; confira-o no formulário.");
    } else if (field === "paymentStatus") {
      const status = parsePaymentStatus(rawValue);
      if (status) values.paymentStatus = status;
      else warnings.push("Situação de pagamento não reconhecida; selecione-a no formulário.");
    }
  }

  return { values, warnings };
}

export function normalizePartnerName(value: string): string {
  return normalizeText(value).replace(/\s/g, "");
}
