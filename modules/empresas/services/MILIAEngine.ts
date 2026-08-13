import { Company } from "../types";
import { analyzeFiscal } from "./FiscalAnalyzer";
import { analyzeCadastro } from "./CadastroAnalyzer";
import { analyzeFinanceiro } from "./FinanceiroAnalyzer";
import { analyzeCertificate } from "./CertificateAnalyzer";

export interface DiagnosisResult {
  score: number;
  priority: "Baixa" | "Média" | "Alta";
  problems: string[];
  recommendations: string[];
}

export function analyzeCompany(company: Company): DiagnosisResult {
  let score = 100;

  const problems: string[] = [];
  const recommendations: string[] = [];
  const fiscal = analyzeFiscal(company);
  const cadastro = analyzeCadastro(company);
  const financeiro = analyzeFinanceiro(company);
  const certificado = analyzeCertificate(company);

  if (!company.email) {
    problems.push("Empresa sem e-mail cadastrado.");
    recommendations.push("Cadastrar um e-mail empresarial.");
    score -= 10;
  }

  if (!company.telefone) {
    problems.push("Telefone não informado.");
    recommendations.push("Cadastrar telefone de contato.");
    score -= 10;
  }

  if (!company.endereco) {
    problems.push("Endereço não informado.");
    recommendations.push("Completar o endereço da empresa.");
    score -= 10;
  }

  if (!company.certificadoDigitalValidade) {
    problems.push("Certificado digital inexistente.");
    recommendations.push("Emitir ou renovar o certificado digital.");
    score -= 20;
  }

  if (company.socios.length === 0) {
    problems.push("Nenhum sócio cadastrado.");
    recommendations.push("Cadastrar o quadro societário.");
    score -= 10;
  }

  problems.push(...fiscal.problems);
recommendations.push(...fiscal.recommendations);

score = Math.min(score, fiscal.score);

  if (score < 0) {
    score = 0;
  }

  problems.push(...cadastro.problems);
recommendations.push(...cadastro.recommendations);

score = Math.min(score, cadastro.score);

problems.push(...financeiro.problems);
recommendations.push(...financeiro.recommendations);

score = Math.min(score, financeiro.score);

problems.push(...certificado.problems);
recommendations.push(...certificado.recommendations);

score = Math.min(score, certificado.score);

  let priority: DiagnosisResult["priority"];

  if (score >= 80) {
    priority = "Baixa";
  } else if (score >= 50) {
    priority = "Média";
  } else {
    priority = "Alta";
  }

  return {
    score,
    priority,
    problems,
    recommendations,
  };
}