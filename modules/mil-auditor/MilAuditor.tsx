import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  ServerCog,
  Route,
  Boxes,
} from "lucide-react";
import AuditFindingCard, {
  AuditFinding,
} from "./components/AuditFindingCard";

type AuditStatus = "ok" | "warning" | "error";
type ModuleStatus = "operational" | "incomplete";

interface ModuleDetail {
  module: string;
  database: boolean;
  repository: boolean;
  service: boolean;
  controller: boolean;
  api: boolean;
  status: ModuleStatus;
}

interface AuditCheck {
  name: string;
  status: AuditStatus;
  message: string;
  details?: unknown;
}

interface AuditReport {
  generatedAt: string;
  overallStatus: AuditStatus;
  checks: AuditCheck[];
}

const initialFindings: AuditFinding[] = [
  {
    id: "fiscal-001",
    module: "Fiscal / Obrigações",
    title: "Obrigações próximas do vencimento",
    description:
      "O MIL Auditor identificará obrigações fiscais que exigem atenção antes do vencimento.",
    severity: "warning",
    action: "human",
  },  
];

function getSessionToken(): string | null {
  try {
    const raw = sessionStorage.getItem("mil_contabil_ia.session");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

function StatusPill({ status }: { status: ModuleStatus }) {
  const operational = status === "operational";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        operational
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {operational ? (
        <CheckCircle2 size={14} />
      ) : (
        <AlertTriangle size={14} />
      )}
      {operational ? "Operacional" : "Incompleto"}
    </span>
  );
}

function BooleanStatus({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="text-emerald-600" size={18} />
  ) : (
    <XCircle className="text-red-500" size={18} />
  );
}

export default function MilAuditor() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getSessionToken();

      if (!token) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      const response = await fetch("/api/auditor", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Não foi possível executar a auditoria. HTTP ${response.status}.`
        );
      }

      const data = (await response.json()) as AuditReport;
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao executar o MIL Auditor."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  const moduleCheck = report?.checks.find(
    (check) => check.name === "Diagnóstico de módulos"
  );

  const modules =
    Array.isArray(moduleCheck?.details)
      ? (moduleCheck?.details as ModuleDetail[])
      : [];

  const operationalCount = modules.filter(
    (item) => item.status === "operational"
  ).length;

  const incompleteCount = modules.filter(
    (item) => item.status === "incomplete"
  ).length;

  const automationCheck = report?.checks.find(
  (check) => check.name === "Automação Fiscal"
);

const operationalFindings: AuditFinding[] = [
  ...initialFindings,
  {
    id: "automacao-fiscal",
    module: "Fiscal / Obrigações",
    title: "Automação Fiscal",
    description:
      automationCheck?.message ??
      "Verificando a configuração da automação fiscal.",
    severity:
      automationCheck?.status === "ok"
        ? "normal"
        : automationCheck?.status === "error"
          ? "critical"
          : "warning",
    action:
      automationCheck?.status === "ok"
        ? "none"
        : "human",
  },
];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-600">
            <ShieldCheck size={18} />
            Auditoria Inteligente da Plataforma
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            MIL Auditor
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Diagnóstico técnico dos módulos, banco, serviços e APIs da MIL Contábil IA.
          </p>
        </div>

        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          {loading ? "Auditando..." : "Executar auditoria"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Módulos auditados
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {modules.length}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Boxes size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Operacionais
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-600">
                {operationalCount}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pendências
              </p>
              <p className="mt-2 text-3xl font-bold text-amber-600">
                {incompleteCount}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">
              Diagnóstico dos módulos
            </h2>
            <p className="text-sm text-slate-500">
              Verificação de banco, repository, service, controller e API.
            </p>
          </div>

          {report?.generatedAt && (
            <span className="text-xs text-slate-400">
              Última auditoria:{" "}
              {new Date(report.generatedAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {loading && !report ? (
          <div className="flex min-h-52 items-center justify-center gap-3 text-sm font-medium text-slate-500">
            <RefreshCw className="animate-spin" size={19} />
            Executando diagnóstico...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-semibold">Módulo</th>
                  <th className="px-4 py-3 font-semibold">Banco</th>
                  <th className="px-4 py-3 font-semibold">Repository</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Controller</th>
                  <th className="px-4 py-3 font-semibold">API</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>

              <tbody>
                {modules.map((item) => (
                  <tr
                    key={item.module}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      {item.module}
                    </td>

                    <td className="px-4 py-4">
                      <BooleanStatus value={item.database} />
                    </td>

                    <td className="px-4 py-4">
                      <BooleanStatus value={item.repository} />
                    </td>

                    <td className="px-4 py-4">
                      <BooleanStatus value={item.service} />
                    </td>

                    <td className="px-4 py-4">
                      <BooleanStatus value={item.controller} />
                    </td>

                    <td className="px-4 py-4">
                      <BooleanStatus value={item.api} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                ))}

                {!loading && modules.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      Nenhum diagnóstico de módulo retornado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="mb-4">
    <h2 className="font-bold text-slate-900">
      Auditoria Operacional
    </h2>
    <p className="mt-1 text-sm text-slate-500">
      Situações que exigem atenção, decisão humana ou acompanhamento preventivo.
    </p>
  </div>

  <div className="space-y-3">
    {operationalFindings.map((finding) => (
      <AuditFindingCard
        key={finding.id}
        finding={finding}
      />
    ))}
  </div>
</div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Database className="text-blue-600" size={20} />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Banco de dados
            </p>
            <p className="text-xs text-slate-500">
              Estrutura e tabelas essenciais
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <ServerCog className="text-blue-600" size={20} />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Backend
            </p>
            <p className="text-xs text-slate-500">
              Services, repositories e controllers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Route className="text-blue-600" size={20} />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              APIs
            </p>
            <p className="text-xs text-slate-500">
              Rotas e integração dos módulos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}