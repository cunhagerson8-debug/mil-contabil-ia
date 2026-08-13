import { Company } from "../types";

interface Props {
  company: Company;
}

export default function CertificateReport({ company }: Props) {
  return (
    <div className="rounded-xl border bg-white p-6 space-y-4">

      <h2 className="text-2xl font-bold">
        📄 Relatório do Certificado
      </h2>

      <button
    onClick={() => window.print()}
    className="bg-blue-600 text-white px-4 py-2 rounded-lg"
>
    Imprimir Relatório
</button>
      <div className="grid grid-cols-2 gap-4">
        

        <div>
          <strong>Empresa</strong>
          <p>{company.razaoSocial}</p>
        </div>

        <div>
          <strong>CNPJ</strong>
          <p>{company.cnpj}</p>
        </div>

        <div>
          <strong>Tipo</strong>
          <p>{company.certificadoDigitalTipo || "-"}</p>
        </div>

        <div>
          <strong>Autoridade</strong>
          <p>{company.certificadoAutoridade || "-"}</p>
        </div>

        <div>
          <strong>Responsável</strong>
          <p>{company.certificadoResponsavel || "-"}</p>
        </div>

        <div>
          <strong>Validade</strong>
          <p>{company.certificadoDigitalValidade || "-"}</p>
        </div>

      </div>

      <div className="rounded-lg bg-slate-50 p-4">
        <h3 className="font-semibold mb-2">
          🤖 Análise da MIL IA
        </h3>

        <p>
          O certificado encontra-se monitorado pela MIL Contábil IA.
          As recomendações serão exibidas automaticamente conforme
          a validade e o status do certificado.
        </p>

      </div>

    </div>
  );
}