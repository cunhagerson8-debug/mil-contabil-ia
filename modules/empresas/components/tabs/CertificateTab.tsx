import { Company } from "../../types";
import { generateCertificatePDF } from "../../reports/GenerateCertificatePDF";

interface Props {
  company: Company;
}

export default function CertificateTab({ company }: Props) {
  return (
    <div className="space-y-6">

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">
          🔐 Certificado Digital
        </h2>

<div className="rounded-xl border bg-white p-6 mb-6">
  <h3 className="text-lg font-semibold mb-4">
    📊 Situação do Certificado
  </h3>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

  <button className="rounded-lg border bg-white p-4 hover:bg-slate-50 transition">
    📥
    <div className="mt-2 text-sm font-medium">
      Importar
    </div>
  </button>

<button
  onClick={() => generateCertificatePDF(company)}
  className="rounded-lg border bg-white p-4 hover:bg-slate-50"
>
  📄
  <div className="mt-2 text-sm font-medium">
    Relatório
  </div>
</button>

  <button className="rounded-lg border bg-white p-4 hover:bg-slate-50 transition">
    📤
    <div className="mt-2 text-sm font-medium">
      Exportar
    </div>
  </button>

  <button className="rounded-lg border bg-violet-600 text-white p-4 hover:bg-violet-700 transition">
    🔄
    <div className="mt-2 text-sm font-medium">
      Renovar
    </div>
  </button>

</div>

  <div className="grid grid-cols-2 gap-4">

    <div>
      <span className="text-gray-500 text-sm">Status</span>
      <p className="font-semibold text-green-600">
        Certificado Válido
      </p>
    </div>

    <div>
      <span className="text-gray-500 text-sm">Tipo</span>
      <p>{company.certificadoDigitalTipo || "-"}</p>
    </div>

    <div>
      <span className="text-gray-500 text-sm">Validade</span>
      <p>{company.certificadoDigitalValidade || "-"}</p>
    </div>

    <div>
      <span className="text-gray-500 text-sm">Autoridade</span>
      <p>{company.certificadoAutoridade || "-"}</p>
    </div>

    <div>
      <span className="text-gray-500 text-sm">Responsável</span>
      <p>{company.certificadoResponsavel || "-"}</p>
    </div>

    <div>
      <span className="text-gray-500 text-sm">Renovação</span>
      <p className="text-blue-600 font-medium">
        Monitoramento ativo
      </p>
    </div>

  </div>
</div>

        <p className="text-slate-500 mt-2">
          Gerenciamento completo dos certificados digitais da empresa.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">

        <div>
          <label className="block text-sm font-medium mb-2">
            Tipo
          </label>

          <select className="w-full rounded-lg border p-3">
            <option>A1</option>
            <option>A3</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Autoridade Certificadora
          </label>

          <input
            className="w-full rounded-lg border p-3"
            placeholder="Ex.: Certisign"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Número de Série
          </label>

          <input
            className="w-full rounded-lg border p-3"
            placeholder="Número do certificado"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Responsável
          </label>

          <input
            className="w-full rounded-lg border p-3"
            placeholder="Nome do responsável"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Data de Emissão
          </label>

          <input
            type="date"
            className="w-full rounded-lg border p-3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Data de Validade
          </label>

          <input
            type="date"
            className="w-full rounded-lg border p-3"
          />
        </div>

      </div>

      <div className="rounded-xl border bg-slate-50 p-5">

        <h3 className="font-semibold mb-3">
          Status do Certificado
        </h3>

        <p>
          🟢 Situação calculada automaticamente após salvar.
        </p>

      </div>

      <button className="rounded-lg bg-violet-600 px-6 py-3 text-white font-semibold hover:bg-violet-700">
        Salvar Certificado
      </button>

    {/* ===========================
    HISTÓRICO DO CERTIFICADO
=========================== */}

<div className="rounded-xl border bg-white p-6 shadow-sm mt-6">
  <div className="flex items-center gap-2 mb-2">
    <span className="text-2xl">📜</span>

    <div>
      <h3 className="text-lg font-bold">
        Histórico do Certificado
      </h3>

      <p className="text-sm text-slate-500">
        Acompanhe todas as alterações realizadas neste certificado.
      </p>
    </div>
  </div>

  <div className="mt-6 space-y-4">

    {/* Evento */}

    <div className="flex items-start justify-between rounded-lg border p-4">
      <div>
        <p className="font-semibold text-green-600">
          🟢 Certificado cadastrado
        </p>

        <p className="text-sm text-slate-500">
          Cadastro realizado com sucesso.
        </p>
      </div>

      <span className="text-xs text-slate-400">
        Hoje • 14:35
      </span>
    </div>

    {/* Evento */}

    <div className="flex items-start justify-between rounded-lg border p-4">
      <div>
        <p className="font-semibold text-blue-600">
          🔄 Certificado renovado
        </p>

        <p className="text-sm text-slate-500">
          Renovação registrada no sistema.
        </p>
      </div>

      <span className="text-xs text-slate-400">
        15/06/2026
      </span>
    </div>

    {/* Evento */}

    <div className="flex items-start justify-between rounded-lg border p-4">
      <div>
        <p className="font-semibold text-amber-600">
          ✏️ Responsável alterado
        </p>

        <p className="text-sm text-slate-500">
          Dados do responsável atualizados.
        </p>
      </div>

      <span className="text-xs text-slate-400">
        10/06/2026
      </span>
    </div>

    {/* Evento */}

    <div className="flex items-start justify-between rounded-lg border p-4">
      <div>
        <p className="font-semibold text-slate-600">
          ⬇️ Download realizado
        </p>

        <p className="text-sm text-slate-500">
          Arquivo do certificado baixado.
        </p>
      </div>

      <span className="text-xs text-slate-400">
        05/06/2026
      </span>
    </div>

<div className="rounded-xl border bg-white p-6 shadow-sm mt-6">
  <div className="flex items-center gap-2 mb-4">
    <span className="text-2xl">🤖</span>

    <div>
      <h3 className="text-lg font-bold">
        Análise Inteligente da MIL IA
      </h3>

      <p className="text-sm text-slate-500">
        Diagnóstico automático baseado nas informações do certificado.
      </p>
    </div>
  </div>

  <div className="space-y-3">

    <div className="rounded-lg bg-green-50 border border-green-200 p-3">
      <p className="font-semibold text-green-700">
        ✅ Certificado válido
      </p>
      <p className="text-sm text-green-600">
        Nenhum problema encontrado.
      </p>
    </div>

    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
      <p className="font-semibold text-blue-700">
        📅 Validade
      </p>
      <p className="text-sm text-blue-600">
        Restam 284 dias para o vencimento.
      </p>
    </div>

    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
      <p className="font-semibold text-amber-700">
        💡 Recomendação
      </p>
      <p className="text-sm text-amber-600">
        Iniciar a renovação 30 dias antes do vencimento.
      </p>
    </div>

  </div>
</div>

  </div>
  </div>
</div>
  );
}