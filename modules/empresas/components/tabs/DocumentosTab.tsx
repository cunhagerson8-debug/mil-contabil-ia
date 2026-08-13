import { FileText } from "lucide-react";
import { Company } from "../../types";

interface Props {
  company: Company;
}

export default function DocumentosTab({ company }: Props) {
  return (
    <div className="space-y-6">

      <div className="rounded-xl border border-slate-200 p-5">

        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText size={18} />
          Documentos da Empresa
        </h3>

        <p className="text-sm text-slate-500">
          Aqui ficarão os documentos enviados pelo escritório contábil e pelo cliente.
        </p>

      </div>

      <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center">

        <FileText
          size={36}
          className="mx-auto text-slate-400 mb-4"
        />

        <p className="font-semibold text-slate-700">
          Nenhum documento disponível
        </p>

        <p className="text-sm text-slate-500 mt-2">
          Contratos, procurações, certificado digital,
          documentos fiscais e societários aparecerão aqui.
        </p>

      </div>

    </div>
  );
}