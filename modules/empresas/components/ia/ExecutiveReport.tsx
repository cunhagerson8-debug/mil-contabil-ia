import { Company } from "../../types";
import { analyzeCompany } from "../../services/MILIAEngine";
import ExecutiveSummary from "./ExecutiveSummary";

interface Props {
  company: Company;
}

export default function ExecutiveReport({ company }: Props) {

  const diagnosis = analyzeCompany(company);

  return (

    <div className="rounded-xl border bg-white p-5 shadow-sm">

      <h2 className="text-xl font-bold mb-4">
        🧠 Relatório Inteligente
      </h2>

      <div className="mb-5">

        <div className="flex justify-between mb-2">

          <span>Saúde Geral</span>

          <strong>{diagnosis.score}%</strong>

        </div>

        <div className="w-full h-3 rounded-full bg-slate-200">

          <div
            className="h-3 rounded-full bg-violet-600"
            style={{ width: `${diagnosis.score}%` }}
          />

        </div>

      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
  <span className="font-medium text-slate-700">
    Prioridade
  </span>

  <span
    className={`rounded-full px-3 py-1 text-sm font-bold ${
      diagnosis.priority === "Baixa"
        ? "bg-green-100 text-green-700"
        : diagnosis.priority === "Média"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700"
    }`}
  >
    {diagnosis.priority}
  </span>
</div>

      <div className="space-y-2">

       <div className="space-y-3">

  <div className="flex justify-between">
    <span>📋 Cadastro</span>
    <span className="text-emerald-600 font-semibold">✔ OK</span>
  </div>

  <div className="flex justify-between">
    <span>🏛 Fiscal</span>
    <span className="text-amber-600 font-semibold">
      {diagnosis.problems.length} pendências
    </span>
  </div>

  <div className="flex justify-between">
    <span>💰 Financeiro</span>
    <span className="text-slate-500">
      Em desenvolvimento
    </span>
  </div>

  <div className="flex justify-between">
    <span>📄 Documentação</span>
    <span className="text-slate-500">
      Em desenvolvimento
    </span>
  </div>

</div>
<div className="mt-6 rounded-xl bg-violet-50 p-4">

  <h3 className="font-bold text-violet-700 mb-2">
    🔥 Prioridade da MIL IA
  </h3>

  <p className="text-sm">
    {diagnosis.recommendations.length > 0
      ? diagnosis.recommendations[0]
      : "Nenhuma ação necessária."}
  </p>

</div>
    </div>

    <ExecutiveSummary company={company} />
  </div>
  );
}