import jsPDF from "jspdf";
import { Company } from "../types";

export function generateCertificatePDF(company: Company) {
  const pdf = new jsPDF();

  pdf.setFontSize(20);
  pdf.text("MIL Contábil IA", 20, 20);

  pdf.setFontSize(15);
  pdf.text("Relatório do Certificado Digital", 20, 35);

  pdf.setFontSize(11);

  pdf.text(`Empresa: ${company.razaoSocial}`, 20, 55);
  pdf.text(`CNPJ: ${company.cnpj}`, 20, 65);

  pdf.text(
    `Tipo: ${company.certificadoDigitalTipo || "-"}`,
    20,
    80
  );

  pdf.text(
    `Autoridade: ${company.certificadoAutoridade || "-"}`,
    20,
    90
  );

  pdf.text(
    `Responsável: ${company.certificadoResponsavel || "-"}`,
    20,
    100
  );

  pdf.text(
    `Validade: ${company.certificadoDigitalValidade || "-"}`,
    20,
    110
  );

  pdf.save("CertificadoDigital.pdf");
}