import { Company } from "../types";

export interface FinanceiroResult {
  score: number;
  problems: string[];
  recommendations: string[];
}

export function analyzeFinanceiro(company: Company): FinanceiroResult {
  const score = 100;

  const problems: string[] = [];
  const recommendations: string[] = [];

  recommendations.push(
    "Módulo financeiro em desenvolvimento."
  );

  return {
    score,
    problems,
    recommendations,
  };
}