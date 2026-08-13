import { Company } from "../types";

export interface CertificateResult {
  score: number;
  status: "Válido" | "Vencendo" | "Vencido";
  color: string;
  daysRemaining: number;
  problems: string[];
  recommendations: string[];
   alerts: string[];
  nextAction: string;
}

export function analyzeCertificate(
  company: Company
): CertificateResult {

  const problems: string[] = [];
  const recommendations: string[] = [];

  if (!company.certificadoDigitalValidade) {
    return {
      score: 0,
      status: "Vencido",
      color: "red",
      daysRemaining: 0,

      problems: [
        "A empresa não possui certificado digital cadastrado."
      ],

      recommendations: [
        "Emitir um certificado digital."
      ],

      alerts: [
        "Nenhum certificado cadastrado."
      ],

      nextAction: "Cadastrar um certificado digital."
    };
  }

  const today = new Date();

  const expiration = new Date(company.certificadoDigitalValidade);

  const diff =
    expiration.getTime() - today.getTime();

  const daysRemaining =
    Math.ceil(diff / (1000 * 60 * 60 * 24));

  let score = 100;

  let status: "Válido" | "Vencendo" | "Vencido" =
    "Válido";

  let color = "green";
  let alerts: string[] = [];
  let nextAction = "Acompanhar o certificado digital.";

  if (daysRemaining < 0) {

    status = "Vencido";
    color = "red";
    nextAction = "Renovar imediatamente o certificado digital.";

    score = 0;

    problems.push("Certificado digital vencido.");

    recommendations.push(
      "Renovar imediatamente o certificado digital."
    );

  } else if (daysRemaining <= 30) {

    status = "Vencendo";
    color = "amber";
    nextAction = "Solicitar renovação do certificado digital.";

    score = 60;

    problems.push(
      `Certificado vence em ${daysRemaining} dias.`
    );

    recommendations.push(
      "Solicitar renovação do certificado."
    );

  }

  return {
    score,
    status,
    color,
    daysRemaining,
    problems,
    recommendations,
    alerts,
    nextAction
  };

}