import { Company } from "../types";

export interface CompanyScore {

  score: number;

  cadastro: number;

  fiscal: number;

  financeiro: number;

  documentos: number;

  certificado: number;

  alerts: string[];

}

export function calculateCompanyScore(
  company: Company
): CompanyScore {

  let cadastro = 100;
  let fiscal = 100;
  let financeiro = 100;
  let documentos = 100;
  let certificado = 100;

  const alerts: string[] = [];

  if (!company.email) {
    cadastro -= 10;
    alerts.push("Empresa sem e-mail.");
  }

  if (!company.telefone) {
    cadastro -= 10;
    alerts.push("Telefone não informado.");
  }

  if (!company.endereco) {
    cadastro -= 10;
    alerts.push("Endereço não informado.");
  }

  if (!company.certificadoDigitalValidade) {

    certificado = 0;

    alerts.push("Certificado digital inexistente.");

  } else {

    const dias = Math.ceil(
      (new Date(company.certificadoDigitalValidade).getTime() -
        Date.now()) /
      (1000 * 60 * 60 * 24)
    );

    if (dias < 0) {

      certificado = 0;

      alerts.push("Certificado vencido.");

    } else if (dias < 30) {

      certificado = 60;

      alerts.push("Certificado vence em breve.");

    }

  }

  const score = Math.round(

    (cadastro +
      fiscal +
      financeiro +
      documentos +
      certificado) / 5

  );

  return {

    score,

    cadastro,

    fiscal,

    financeiro,

    documentos,

    certificado,

    alerts,

  };

}