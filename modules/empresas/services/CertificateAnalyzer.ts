import type { Company } from "../types";

export type CertificateStatus =
  | "Não cadastrado"
  | "Dados incompletos"
  | "Válido"
  | "Próximo do vencimento"
  | "Vencido"
  | "Revogado";

export interface CertificateResult {
  score: number;
  status: CertificateStatus;
  color: "slate" | "amber" | "green" | "red";
  validUntil: string | null;
  daysRemaining: number | null;
  daysExpired: number | null;
  problems: string[];
  recommendations: string[];
  alerts: string[];
  nextAction: string;
}

function normalizedText(value?: string): string {
  return value?.trim() ?? "";
}

function parseDateOnly(value?: string): { isoDate: string; utcTime: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return { isoDate: value, utcTime: date.getTime() };
}

function result(
  status: CertificateStatus,
  color: CertificateResult["color"],
  nextAction: string,
  options: Partial<CertificateResult> = {}
): CertificateResult {
  return {
    score: 0,
    status,
    color,
    validUntil: null,
    daysRemaining: null,
    daysExpired: null,
    problems: [],
    recommendations: [],
    alerts: [],
    nextAction,
    ...options,
  };
}

export function analyzeCertificate(
  company: Company,
  now: Date = new Date()
): CertificateResult {
  const validUntil = parseDateOnly(company.certificadoDigitalValidade);
  const hasCertificateData = Boolean(
    company.certificadoDigitalCadastrado
    || normalizedText(company.certificadoDigitalValidade)
    || normalizedText(company.certificadoDigitalTipo)
    || normalizedText(company.certificadoAutoridade)
    || normalizedText(company.certificadoResponsavel)
  );

  if (company.certificadoDigitalRevogado) {
    return result("Revogado", "red", "Substituir o certificado revogado.", {
      validUntil: validUntil?.isoDate ?? null,
      problems: ["Certificado revogado."],
      recommendations: ["Cadastre um novo certificado antes de utilizá-lo."],
      alerts: ["O certificado está marcado como revogado."],
    });
  }

  if (!hasCertificateData) {
    return result("Não cadastrado", "slate", "Cadastrar um certificado digital.", {
      problems: ["Nenhum certificado digital cadastrado."],
      recommendations: ["Importe ou cadastre um certificado para acompanhar sua validade."],
      alerts: ["Nenhum certificado cadastrado."],
    });
  }

  if (!company.certificadoDigitalValidade?.trim()) {
    return result("Dados incompletos", "amber", "Informar uma data de validade verificável.", {
      problems: ["A data de validade do certificado não foi informada."],
      recommendations: ["Complete os dados do certificado antes de avaliar sua validade."],
      alerts: ["A validade não está disponível."],
    });
  }

  if (!validUntil) {
    return result("Dados incompletos", "amber", "Corrigir a data de validade do certificado.", {
      problems: ["A data de validade do certificado é inválida."],
      recommendations: ["Informe uma data válida no formato AAAA-MM-DD."],
      alerts: ["A validade não pôde ser calculada."],
    });
  }

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntilExpiry = Math.round((validUntil.utcTime - todayUtc) / 86_400_000);

  if (daysUntilExpiry < 0) {
    const daysExpired = Math.abs(daysUntilExpiry);
    return result("Vencido", "red", "Renovar o certificado antes de utilizá-lo.", {
      score: 0,
      validUntil: validUntil.isoDate,
      daysExpired,
      problems: ["Certificado digital vencido."],
      recommendations: ["Renove o certificado digital."],
      alerts: ["A data de validade já passou."],
    });
  }

  if (daysUntilExpiry <= 30) {
    return result("Próximo do vencimento", "amber", "Solicitar a renovação do certificado.", {
      score: 60,
      validUntil: validUntil.isoDate,
      daysRemaining: daysUntilExpiry,
      problems: [`Certificado vence em ${daysUntilExpiry} dias.`],
      recommendations: ["Inicie a renovação antes da data de validade."],
      alerts: [`Validade próxima: ${daysUntilExpiry} dias restantes.`],
    });
  }

  return result("Válido", "green", "Acompanhar a data de validade.", {
    score: 100,
    validUntil: validUntil.isoDate,
    daysRemaining: daysUntilExpiry,
  });
}
