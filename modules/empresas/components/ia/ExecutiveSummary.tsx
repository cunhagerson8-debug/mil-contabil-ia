import { Company } from "../../types";
import { analyzeCompany } from "../../services/MILIAEngine";

interface Props {
  company: Company;
}

export default function ExecutiveSummary({ company }: Props) {
  const diagnosis = analyzeCompany(company);

  const totalPendencias = diagnosis.problems.length;

  let mensagem = "";

  if (diagnosis.score >= 80) {
    mensagem =
      "A empresa apresenta excelente nível de conformidade. Recomenda-se apenas manter o monitoramento preventivo.";
  } else if (diagnosis.score >= 50) {
    mensagem =
      "A empresa possui algumas pendências que merecem atenção. Recomenda-se iniciar a regularização pelos itens prioritários.";
  } else {
    mensagem =
      "A empresa apresenta diversas pendências críticas. A MIL IA recomenda iniciar imediatamente a regularização cadastral e fiscal.";
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm mt-5">

      <h2 className="text-xl font-bold mb-4">
        🧠 Resumo Executivo
      </h2>

      <p className="text-slate-700 leading-7">
        {mensagem}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4">

        <div className="rounded-lg bg-violet-50 p-4">
          <div className="text-sm text-slate-500">
            Índice Geral
          </div>

          <div className="text-2xl font-bold text-violet-700">
            {diagnosis.score}%
          </div>
        </div>

        <div className="rounded-lg bg-red-50 p-4">
          <div className="text-sm text-slate-500">
            Pendências
          </div>

          <div className="text-2xl font-bold text-red-600">
            {totalPendencias}
          </div>
        </div>

      </div>

    </div>
  );
}