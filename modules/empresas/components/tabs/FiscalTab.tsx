import { Building2 } from "lucide-react";
import { Company } from "../../types";

interface Props {
  company: Company;
}

export default function FiscalTab({ company }: Props) {
  return (
    <div className="space-y-6">

      <div className="rounded-xl border border-slate-200 p-5">

        <h3 className="font-bold text-slate-800 mb-4">
          Dados Fiscais
        </h3>

        <div className="grid grid-cols-2 gap-4">

          <div>
            <p className="text-xs uppercase text-slate-400">
              Regime Tributário
            </p>
            <p className="font-semibold">
              {company.regime}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-400">
              Status
            </p>
            <p className="font-semibold">
              {company.status}
            </p>
          </div>

          <div className="col-span-2">
            <p className="text-xs uppercase text-slate-400">
              CNAE
            </p>

            <p className="font-semibold">
              {company.cnae}
            </p>

            <p className="text-sm text-slate-500">
              {company.cnaeDescricao}
            </p>
          </div>

        </div>

      </div>

      <div className="rounded-xl bg-blue-50 p-5">

        <Building2
          size={28}
          className="text-blue-600 mb-3"
        />

        <h3 className="font-bold text-blue-700">
          Módulo Fiscal
        </h3>

        <p className="text-sm mt-2 text-blue-600">
          Em breve serão exibidas aqui as obrigações fiscais,
          impostos, vencimentos e situação tributária da empresa.
        </p>

      </div>

    </div>
  );
}