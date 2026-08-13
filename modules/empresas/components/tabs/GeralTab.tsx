import { Mail, Phone, MapPin } from "lucide-react";
import { Company } from "../../types";
import CompanyHealthCard from "../cards/CompanyHealthCard";
import CompanyAlertsCard from "../cards/CompanyAlertsCard";

interface Props {
  company: Company;
}

export default function GeralTab({ company }: Props) {
  return (
    
   <div className="space-y-6">

  <CompanyHealthCard
    company={company}
  />

  <CompanyAlertsCard
    company={company}
  />

  <div className="grid grid-cols-2 gap-4">

        <div>
          <p className="text-[10px] font-black uppercase text-slate-400">
            CNPJ
          </p>
          <p className="text-sm font-semibold">{company.cnpj}</p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-slate-400">
            Regime
          </p>
          <p className="text-sm font-semibold">{company.regime}</p>
        </div>

        <div className="col-span-2">
          <p className="text-[10px] font-black uppercase text-slate-400">
            CNAE
          </p>

          <p className="text-sm font-semibold">
            {company.cnae}
          </p>

          <p className="text-xs text-slate-500">
            {company.cnaeDescricao}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-slate-400">
            Responsável
          </p>

          <p className="text-sm font-semibold">
            {company.responsavel}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-slate-400">
            Contador
          </p>

          <p className="text-sm font-semibold">
            {company.contadorResponsavel || "—"}
          </p>
        </div>

      </div>

      <div className="border-t pt-5 space-y-3">

        <div className="flex items-center gap-2 text-sm">
          <Mail size={15} />
          {company.email || "—"}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Phone size={15} />
          {company.telefone || "—"}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <MapPin size={15} />
          {company.endereco || "—"}
        </div>

      </div>

    </div>
  );
}