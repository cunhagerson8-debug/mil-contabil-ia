import { Brain, TriangleAlert, CircleCheck, TrendingUp } from "lucide-react";
import { Company } from "../../types";
import { calculateCompanyScore } from "../CompanyScoreEngine";

interface Props {
  company: Company;
}

export default function CompanyDiagnosisCard({ company }: Props) {
  const result = calculateCompanyScore(company);

  let prioridade = "Baixa";
  let cor = "text-emerald-600";

  if (result.score < 80) {
    prioridade = "Média";
    cor = "text-amber-600";
  }

  if (result.score < 60) {
    prioridade = "Alta";
    cor = "text-red-600";
  }

  return (
    <div className="space-y-5">

      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">

        <div className="flex items-center gap-2 mb-3">
          <Brain className="text-violet-600" size={22} />
          <h3 className="font-bold text-violet-700">
            Diagnóstico Inteligente
          </h3>
        </div>

        <p className="text-slate-700">
          A empresa possui um índice geral de
          <strong> {result.score}% </strong>
          de conformidade.
        </p>

      </div>

      <div className="rounded-xl border p-5">

        <div className="flex items-center gap-2 mb-3">
          <TriangleAlert className="text-amber-500" size={18} />
          <h4 className="font-bold">
            Problemas encontrados
          </h4>
        </div>

        {result.alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CircleCheck size={18} />
            Nenhuma pendência encontrada.
          </div>
        ) : (
          <ul className="space-y-2">
            {result.alerts.map((item, index) => (
              <li key={index}>
                • {item}
              </li>
            ))}
          </ul>
        )}

      </div>

      <div className="rounded-xl border p-5">

        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="text-blue-600" size={18} />
          <h4 className="font-bold">
            Prioridade
          </h4>
        </div>

        <p className={`font-bold ${cor}`}>
          {prioridade}
        </p>

      </div>

      <div className="rounded-xl bg-slate-50 p-5">

        <h4 className="font-bold mb-2">
          Recomendações da MIL IA
        </h4>

        <ul className="space-y-2 text-sm">

          {!company.email && (
            <li>• Cadastrar um e-mail empresarial.</li>
          )}

          {!company.telefone && (
            <li>• Atualizar telefone de contato.</li>
          )}

          {!company.endereco && (
            <li>• Completar endereço da empresa.</li>
          )}

          {!company.certificadoDigitalValidade && (
  <li>• Emitir ou renovar certificado digital.</li>
)}

          <li>• Revisar documentos obrigatórios.</li>

          <li>• Manter dados cadastrais sempre atualizados.</li>

        </ul>

      </div>

    </div>
  );
}