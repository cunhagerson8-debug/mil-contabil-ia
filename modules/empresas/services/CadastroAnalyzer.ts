import { Company } from "../types";

console.log("CADASTRO ANALYZER CARREGADO");

export interface CadastroResult {
  score: number;
  problems: string[];
  recommendations: string[];
}

export function analyzeCadastro(company: Company): CadastroResult {
  let score = 100;

  const problems: string[] = [];
  const recommendations: string[] = [];

  if (!company.razaoSocial) {
    score -= 20;
    problems.push("Razão social não cadastrada.");
    recommendations.push("Cadastrar a razão social da empresa.");
  }

  if (!company.nomeFantasia) {
    score -= 10;
    problems.push("Nome fantasia não informado.");
    recommendations.push("Cadastrar o nome fantasia.");
  }

  if (!company.cnpj) {
    score -= 30;
    problems.push("CNPJ não informado.");
    recommendations.push("Cadastrar o CNPJ.");
  }

  if (!company.responsavel) {
    score -= 15;
    problems.push("Responsável pela empresa não informado.");
    recommendations.push("Cadastrar o responsável.");
  }

  return {
    score,
    problems,
    recommendations,
  };
}