import { Wallet } from "lucide-react";
import { Company } from "../types";

interface Props {
  company: Company;
}

export default function FinanceiroTab({ company }: Props) {
  return (
    <div className="space-y-6">

      <div className="rounded-xl border border-slate-200 p-5">

        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Wallet size={18} />
          Financeiro
        </h3>

        <p className="text-sm text-slate-500 mt-3">
          Este módulo exibirá mensalidades, cobranças,
          pagamentos, boletos, PIX e histórico financeiro.
        </p>

      </div>

      <div className="grid grid-cols-2 gap-4">

        <div className="rounded-xl bg-emerald-50 p-4">
          <p className="text-xs uppercase text-slate-500">
            Mensalidade
          </p>

          <p className="text-2xl font-bold text-emerald-700">
            —
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 p-4">
          <p className="text-xs uppercase text-slate-500">
            Próximo vencimento
          </p>

          <p className="text-2xl font-bold text-blue-700">
            —
          </p>
        </div>

      </div>

    </div>
  );
}