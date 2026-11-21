import { useState } from "react";
import type { Company } from "../../types";
import { generateCertificatePDF } from "../../reports/GenerateCertificatePDF";
import { analyzeCertificate, type CertificateStatus } from "../../services/CertificateAnalyzer";

interface Props {
  company: Company;
}

type CertificateAction = "import" | "export" | "renew" | "save";

const statusStyles: Record<CertificateStatus, string> = {
  "Não cadastrado": "bg-slate-100 text-slate-700",
  "Dados incompletos": "bg-amber-100 text-amber-800",
  "Válido": "bg-green-100 text-green-800",
  "Próximo do vencimento": "bg-amber-100 text-amber-800",
  "Vencido": "bg-red-100 text-red-800",
  "Revogado": "bg-red-100 text-red-800",
};

function formatDate(value: string | null): string {
  if (!value) return "Não informada";

  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  });
}

export default function CertificateTab({ company }: Props) {
  const [unavailableAction, setUnavailableAction] = useState<{
    action: CertificateAction;
    message: string;
  } | null>(null);
  const analysis = analyzeCertificate(company);

  function reportUnavailable(action: CertificateAction, message: string) {
    setUnavailableAction({ action, message });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">🔐 Certificado Digital</h2>
        <p className="mt-2 text-slate-500">
          Situação calculada a partir dos dados de validade disponíveis para esta empresa.
        </p>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">📊 Situação do Certificado</h3>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            type="button"
            onClick={() => reportUnavailable("import",
              "Importação indisponível: o fluxo seguro de leitura e armazenamento do certificado ainda não está integrado. Nenhum arquivo foi enviado."
            )}
            className="rounded-lg border bg-white p-4 transition hover:bg-slate-50"
          >
            📥
            <div className="mt-2 text-sm font-medium">Importar</div>
          </button>

          <button
            type="button"
            onClick={() => generateCertificatePDF(company)}
            className="rounded-lg border bg-white p-4 hover:bg-slate-50"
          >
            📄
            <div className="mt-2 text-sm font-medium">Relatório</div>
          </button>

          <button
            type="button"
            onClick={() => reportUnavailable("export",
              "Exportação indisponível: ainda não há uma operação de exportação conectada."
            )}
            className="rounded-lg border bg-white p-4 transition hover:bg-slate-50"
          >
            📤
            <div className="mt-2 text-sm font-medium">Exportar</div>
          </button>

          <button
            type="button"
            onClick={() => reportUnavailable("renew",
              "Renovação indisponível: ainda não há uma operação de renovação conectada."
            )}
            className="rounded-lg border bg-violet-600 p-4 text-white transition hover:bg-violet-700"
          >
            🔄
            <div className="mt-2 text-sm font-medium">Renovar</div>
          </button>
        </div>

        {unavailableAction && unavailableAction.action !== "save" && (
          <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {unavailableAction.message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Status</span>
            <p className={`mt-1 inline-block rounded-full px-3 py-1 font-semibold ${statusStyles[analysis.status]}`}>
              {analysis.status}
            </p>
          </div>

          <div>
            <span className="text-sm text-gray-500">Tipo</span>
            <p>{company.certificadoDigitalTipo?.trim() || "Não informado"}</p>
          </div>

          <div>
            <span className="text-sm text-gray-500">Validade</span>
            <p>{formatDate(analysis.validUntil)}</p>
          </div>

          {analysis.daysRemaining !== null && (
            <div>
              <span className="text-sm text-gray-500">Dias restantes</span>
              <p>{analysis.daysRemaining}</p>
            </div>
          )}

          {analysis.daysExpired !== null && (
            <div>
              <span className="text-sm text-gray-500">Dias desde o vencimento</span>
              <p>{analysis.daysExpired}</p>
            </div>
          )}

          <div>
            <span className="text-sm text-gray-500">Autoridade</span>
            <p>{company.certificadoAutoridade?.trim() || "Não informado"}</p>
          </div>

          <div>
            <span className="text-sm text-gray-500">Responsável</span>
            <p>{company.certificadoResponsavel?.trim() || "Não informado"}</p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">{analysis.nextAction}</p>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Dados do Certificado</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Tipo
            <select className="mt-2 w-full rounded-lg border p-3" defaultValue="A1">
              <option>A1</option>
              <option>A3</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Autoridade Certificadora
            <input className="mt-2 w-full rounded-lg border p-3" placeholder="Ex.: Certisign" />
          </label>

          <label className="block text-sm font-medium">
            Número de Série
            <input className="mt-2 w-full rounded-lg border p-3" placeholder="Número do certificado" />
          </label>

          <label className="block text-sm font-medium">
            Responsável
            <input className="mt-2 w-full rounded-lg border p-3" placeholder="Nome do responsável" />
          </label>

          <label className="block text-sm font-medium">
            Data de Emissão
            <input type="date" className="mt-2 w-full rounded-lg border p-3" />
          </label>

          <label className="block text-sm font-medium">
            Data de Validade
            <input type="date" className="mt-2 w-full rounded-lg border p-3" />
          </label>
        </div>

        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          O cadastro ainda não está conectado ao serviço de certificados. Os dados preenchidos aqui
          não são enviados nem persistidos.
        </p>

        <button
          type="button"
          onClick={() => reportUnavailable("save",
            "Cadastro não realizado: a gravação ainda não está conectada a esta tela. Nenhum dado foi enviado ou salvo."
          )}
          className="mt-5 rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
        >
          Salvar Certificado
        </button>
        {unavailableAction?.action === "save" && (
          <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {unavailableAction.message}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">📜 Histórico do Certificado</h3>
        <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          O histórico real ainda não está integrado a esta tela. Nenhum evento simulado está sendo exibido.
        </p>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">Análise da validade</h3>
        <p className="mt-2 text-sm text-slate-500">
          Análise local baseada nos dados disponíveis; não representa validação criptográfica do arquivo.
        </p>

        <div className="mt-4 space-y-3">
          <div className={`rounded-lg p-3 ${statusStyles[analysis.status]}`}>
            <p className="font-semibold">{analysis.status}</p>
            {analysis.problems.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm">
                {analysis.problems.map((problem) => <li key={problem}>{problem}</li>)}
              </ul>
            )}
            {analysis.problems.length === 0 && (
              <p className="mt-1 text-sm">A data de validade registrada ainda não expirou.</p>
            )}
          </div>

          {analysis.daysRemaining !== null && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Restam {analysis.daysRemaining} dias até {formatDate(analysis.validUntil)}.
            </p>
          )}

          {analysis.daysExpired !== null && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              A validade terminou há {analysis.daysExpired} dias.
            </p>
          )}

          {analysis.recommendations.map((recommendation) => (
            <p key={recommendation} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              💡 {recommendation}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
