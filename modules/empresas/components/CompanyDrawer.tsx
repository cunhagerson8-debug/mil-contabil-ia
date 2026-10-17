import React, { useState } from "react";
import GeralTab from "./tabs/GeralTab";
import SociosTab from "./tabs/SociosTab";
import FiscalTab from "./tabs/FiscalTab";
import DocumentosTab from "./tabs/DocumentosTab";
import FinanceiroTab from "./tabs/FinanceiroTab";
import MilIATab from "./tabs/MilIATab";
import CertificateTab from "./tabs/CertificateTab";
import OfficeSettingsTab from "./tabs/OfficeSettingsTab";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";

import {
  Company,
  StatusEmpresa,
} from "../types";

interface Props {
  company: Company;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const statusStyles: Record<StatusEmpresa, string> = {
  Ativa: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inativa: "bg-slate-100 text-slate-600 border-slate-200",
  "Em Abertura": "bg-blue-50 text-blue-700 border-blue-200",
  "Em Encerramento": "bg-amber-50 text-amber-700 border-amber-200",
};

function certificadoStatus(dateStr?: string) {
  if (!dateStr) return null;

  const dias = Math.ceil(
    (new Date(dateStr).getTime() - Date.now()) /
    (1000 * 60 * 60 * 24)
  );

  if (dias < 0)
    return {
      icon: ShieldAlert,
      tone: "text-red-600",
      label: "Certificado vencido",
    };

  if (dias <= 30)
    return {
      icon: AlertCircle,
      tone: "text-amber-600",
      label: `Vence em ${dias} dias`,
    };

  return {
    icon: ShieldCheck,
    tone: "text-emerald-600",
    label: "Certificado válido",
  };
}

const TABS: [string, string][] = [
  ["geral", "Geral"],
  ["socios", "Sócios"],
  ["fiscal", "Fiscal"],
  ["documentos", "Documentos"],
  ["financeiro", "Financeiro"],
  ["certificado", "Certificado"],
  ["escritorio", "Escritório"],
  ["ia", "MIL IA"],
];

export default function CompanyDrawer({
  company,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const [activeTab, setActiveTab] = useState("geral");

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-300">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        Voltar para Empresas
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-blue-600">
              {company.regime}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 break-words">
              {company.nomeFantasia}
            </h2>
            <p className="text-sm text-slate-500 break-words">
              {company.razaoSocial}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={onEdit}
              className="flex-1 md:flex-none bg-blue-50 text-blue-700 rounded-xl px-5 py-2.5 flex items-center justify-center gap-2 font-bold hover:bg-blue-100 transition-colors"
            >
              <Pencil size={14} />
              Editar
            </button>
            <button
              onClick={onDelete}
              className="flex-1 md:flex-none bg-red-50 text-red-600 rounded-xl px-5 py-2.5 flex items-center justify-center gap-2 font-bold hover:bg-red-100 transition-colors"
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 md:px-6 py-3 flex flex-wrap gap-2">
          {TABS.map(([id, texto]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-bold transition
                ${activeTab === id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
        {activeTab === "geral" && <GeralTab company={company} />}
        {activeTab === "socios" && <SociosTab />}
        {activeTab === "fiscal" && <FiscalTab company={company} />}
        {activeTab === "documentos" && <DocumentosTab company={company} />}
        {activeTab === "financeiro" && <FinanceiroTab company={company} />}
        {activeTab === "certificado" && <CertificateTab company={company} />}
        {activeTab === "escritorio" && <OfficeSettingsTab />}
        {activeTab === "ia" && <MilIATab company={company} />}
      </div>
    </div>
  );
}