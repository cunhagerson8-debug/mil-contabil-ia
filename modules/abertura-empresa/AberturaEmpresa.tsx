import React, { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

interface Etapa {
  id: number;
  titulo: string;
  descricao: string;
  status: "pendente" | "andamento" | "concluida";
}

export default function AberturaEmpresa() {
  const [cnpj, setCnpj] = useState("");

  const [etapas] = useState<Etapa[]>([
    {
      id: 1,
      titulo: "Dados da empresa",
      descricao: "Informações básicas para iniciar o processo.",
      status: "andamento",
    },
    {
      id: 2,
      titulo: "Viabilidade",
      descricao: "Verificação de nome empresarial e atividade.",
      status: "pendente",
    },
    {
      id: 3,
      titulo: "Registro empresarial",
      descricao: "Preparação dos dados para registro.",
      status: "pendente",
    },
    {
      id: 4,
      titulo: "CNPJ",
      descricao: "Acompanhamento da obtenção do CNPJ.",
      status: "pendente",
    },
    {
      id: 5,
      titulo: "Inscrições e licenças",
      descricao: "Acompanhamento das inscrições necessárias.",
      status: "pendente",
    },
    {
      id: 6,
      titulo: "Conclusão",
      descricao: "Conferência final e encerramento do processo.",
      status: "pendente",
    },
  ]);

  const statusConfig = {
    pendente: {
      label: "Pendente",
      className: "bg-slate-100 text-slate-600",
      icon: Clock3,
    },
    andamento: {
      label: "Em andamento",
      className: "bg-blue-50 text-blue-700",
      icon: Search,
    },
    concluida: {
      label: "Concluída",
      className: "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    },
  };

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Cabeçalho */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-lg">
                <Building2 size={26} />
              </div>

              <div>
                <h1 className="text-2xl font-black text-slate-900">
                  Abertura de Empresa
                </h1>

                <p className="text-sm text-slate-500 mt-1">
                  Gestão inteligente do processo de abertura empresarial
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
            <ShieldCheck className="text-emerald-600" size={20} />

            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">
                MIL IA
              </p>

              <p className="text-sm font-bold text-slate-700">
                Acompanhamento inteligente
              </p>
            </div>
          </div>
        </div>

        {/* Consulta / abertura */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Search size={22} />
            </div>

            <div className="flex-1">
              <h2 className="font-black text-slate-900">
                Iniciar processo
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                Informe o CNPJ, se já existir, ou inicie uma nova abertura.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  className="px-5 py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition"
                >
                  Consultar
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Processos ativos
            </p>

            <p className="text-3xl font-black text-slate-900 mt-2">
              0
            </p>

            <p className="text-sm text-slate-500 mt-1">
              Nenhuma abertura em andamento
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pendências
            </p>

            <p className="text-3xl font-black text-amber-600 mt-2">
              0
            </p>

            <p className="text-sm text-slate-500 mt-1">
              Nenhuma pendência identificada
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Documentos
            </p>

            <p className="text-3xl font-black text-blue-600 mt-2">
              0
            </p>

            <p className="text-sm text-slate-500 mt-1">
              Documentos aguardando processamento
            </p>
          </div>

        </div>

        {/* Fluxo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Fluxo da abertura
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                A MIL IA acompanhará cada etapa do processo.
              </p>
            </div>

            <FileText className="text-slate-400" size={22} />
          </div>

          <div className="space-y-3">
            {etapas.map((etapa) => {
              const config = statusConfig[etapa.status];
              const Icon = config.icon;

              return (
                <div
                  key={etapa.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50"
                >
                  <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-500">
                    {etapa.id}
                  </div>

                  <div className="flex-1">
                    <p className="font-bold text-slate-800">
                      {etapa.titulo}
                    </p>

                    <p className="text-sm text-slate-500 mt-0.5">
                      {etapa.descricao}
                    </p>
                  </div>

                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${config.className}`}
                  >
                    <Icon size={15} />
                    {config.label}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Inteligência */}
        <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-xl">
          <div className="flex items-start gap-4">

            <div className="p-3 rounded-xl bg-white/10">
              <ShieldCheck size={24} />
            </div>

            <div>
              <h2 className="font-black text-lg">
                MIL IA — Controle do processo
              </h2>

              <p className="text-sm text-slate-300 mt-2 max-w-3xl">
                A inteligência da plataforma deverá acompanhar as etapas,
                identificar pendências, registrar acontecimentos e alimentar
                automaticamente o diagnóstico diário da empresa.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold">
                  Monitoramento
                </span>

                <span className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold">
                  Pendências
                </span>

                <span className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold">
                  Documentos
                </span>

                <span className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold">
                  Diagnóstico diário
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}