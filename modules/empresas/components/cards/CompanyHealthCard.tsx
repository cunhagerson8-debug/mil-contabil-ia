import { Activity, CheckCircle2 } from "lucide-react";
import { Company } from "../../types";
import { calculateCompanyScore } from "../CompanyScoreEngine";

interface Props {
  company: Company;
}

export default function CompanyHealthCard({
  company,
}: Props) {

  const result = calculateCompanyScore(company);

  return (

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-center gap-2 mb-4">

        <Activity
          className="text-emerald-600"
          size={20}
        />

        <h3 className="font-bold text-slate-800">
          Saúde da Empresa
        </h3>

      </div>

      <div className="mb-5">

        <div className="flex justify-between mb-2">

          <span className="text-sm text-slate-500">
            Índice Geral
          </span>

          <span className="font-bold text-emerald-600">
    {result.score}%
</span>

        </div>

        <div className="w-full bg-slate-200 rounded-full h-3">

          <div
            className="bg-emerald-500 h-3 rounded-full"
            style={{
              width: `${result.score}%`,
            }}
          />

        </div>

      </div>

      <div className="space-y-3">

        <Item texto={`Cadastro: ${result.cadastro}%`} />

        <Item texto={`Fiscal: ${result.fiscal}%`} />

        <Item texto={`Certificado: ${result.certificado}%`} />

        <Item texto={`Documentos: ${result.documentos}%`} />

      </div>

    </div>

  );

}

function Item({ texto }: { texto: string }) {

  return (

    <div className="flex items-center gap-2">

      <CheckCircle2
        size={16}
        className="text-emerald-500"
      />

      <span className="text-sm">
        {texto}
      </span>

    </div>

  );

}