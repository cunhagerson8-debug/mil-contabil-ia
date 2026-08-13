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
  X,
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

export default function CompanyDrawer({
  company,
  onClose,
  onEdit,
  onDelete,
}: Props) {

  const [activeTab, setActiveTab] =
    useState("geral");

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="sticky top-0 bg-white border-b border-slate-100 p-6">

          <div className="flex items-start justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-widest text-blue-600">

                {company.regime}

              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-1">

                {company.nomeFantasia}

              </h2>

              <p className="text-sm text-slate-500">

                {company.razaoSocial}

              </p>

            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

          </div>

          <div className="flex gap-2 mt-6">

            <button
              onClick={onEdit}
              className="flex-1 bg-blue-50 text-blue-700 rounded-xl py-2.5 flex items-center justify-center gap-2 font-bold"
            >
              <Pencil size={14} />

              Editar

            </button>

            <button
              onClick={onDelete}
              className="flex-1 bg-red-50 text-red-600 rounded-xl py-2.5 flex items-center justify-center gap-2 font-bold"
            >
              <Trash2 size={14} />

              Excluir

            </button>

          </div>

          <div className="flex gap-2 overflow-auto mt-6 pb-2">

            {[
              ["geral", "Geral"],
              ["socios", "Sócios"],
              ["fiscal", "Fiscal"],
              ["documentos", "Documentos"],
              ["financeiro", "Financeiro"],
              ["certificado", "Certificado"],
              ["escritorio", "Escritório"],
              ["ia", "MIL IA"],
            ].map(([id, texto]) => (

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

        <div className="p-6">

          {activeTab === "geral" && (
            <GeralTab company={company} />
          )}

          {activeTab === "socios" && (
            <SociosTab />
          )}

          {activeTab === "fiscal" && (
            <FiscalTab company={company} />
          )}

          {activeTab === "financeiro" && (
           <FinanceiroTab company={company} />
          )}

          {activeTab === "certificado" && (
          <CertificateTab company={company} />
          )}

          {activeTab === "escritorio" && (
          <OfficeSettingsTab />
          )}

          {activeTab === "ia" && (
          <MilIATab company={company} />
          )}


        </div>

      </div>

    </div>

  );

}