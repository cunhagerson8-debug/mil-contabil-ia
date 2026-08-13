import { AlertTriangle } from "lucide-react";
import { Company } from "../../types";
import { calculateCompanyScore } from "../CompanyScoreEngine";

interface Props {
  company: Company;
}

export default function CompanyAlertsCard({ company }: Props) {
  const result = calculateCompanyScore(company);
  const alerts = result.alerts;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4">
        🔔 Alertas da Empresa
      </h3>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-emerald-600 text-sm font-semibold">
            ✅ Nenhum alerta encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alerta, index) => (
              <div key={index} className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                <span className="text-sm text-slate-700">{alerta}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
