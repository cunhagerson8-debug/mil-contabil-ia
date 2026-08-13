import { Company } from "../../types";
import { analyzeCompany } from "../../services/MILIAEngine";
import ExecutiveReport from "./ExecutiveReport";

interface Props {
  company: Company;
}

export default function IntelligentDiagnosis({ company }: Props) {
 

  const diagnosis = analyzeCompany(company);

  return (
    <div className="space-y-5">

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">

        <h2 className="text-xl font-bold text-violet-700">
          🤖 MIL IA Contábil
        </h2>

        <p className="text-sm text-slate-600 mt-2">
          Transformando dados em decisões inteligentes.
        </p>

      </div>

      <ExecutiveReport company={company} />

      <div className="rounded-xl border p-5">

        <h3 className="font-bold">
          Diagnóstico Geral
        </h3>

        <p className="mt-3">
          A empresa possui um índice geral de
          <span className="font-bold text-violet-700">
            {" "}{diagnosis.score}%
          </span>
          {" "}de conformidade.
        </p>

      </div>

     <div className="rounded-xl border p-5">

  <h3 className="font-bold mb-3">
    Problemas encontrados
  </h3>

  {diagnosis.problems.length === 0 ? (
    <p className="text-emerald-600 font-semibold">
      Nenhuma pendência encontrada.
    </p>
  ) : (
    <ul className="space-y-2">
      {diagnosis.problems.map((item, index) => (
        <li key={index}>
          • {item}
        </li>
      ))}
    </ul>
  )}

</div>

<div className="rounded-xl border p-5">

  <h3 className="font-bold mb-3">
    Recomendações da MIL IA
  </h3>

  <ul className="space-y-2">
    {diagnosis.recommendations.map((item, index) => (
      <li key={index}>
        ✅ {item}
      </li>
    ))}
  </ul>

</div>

    </div>
  );
}
