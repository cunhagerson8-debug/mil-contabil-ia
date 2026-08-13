import { Company } from "../types";

export interface FiscalResult {
  score: number;
  problems: string[];
  recommendations: string[];
}

export function analyzeFiscal(company: Company): FiscalResult {

  let score = 100;

  const problems: string[] = [];
  const recommendations: string[] = [];

  if (!company.cnae) {
    score -= 15;
    problems.push("CNAE não informado.");
    recommendations.push("Cadastrar o CNAE principal da empresa.");
  }

  if (!company.regime) {
    score -= 20;
    problems.push("Regime tributário não definido.");
    recommendations.push("Definir o regime tributário.");
  }

  if (company.status !== "Ativa") {
    score -= 10;
    problems.push(`Empresa em status: ${company.status}.`);
    recommendations.push("Verificar situação cadastral da empresa.");
  }

  return {
    score,
    problems,
    recommendations,
  };
}