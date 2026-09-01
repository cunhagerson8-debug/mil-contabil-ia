import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  UserCheck,
} from "lucide-react";

export type AuditFindingSeverity =
  | "critical"
  | "warning"
  | "normal";

export type AuditFindingAction =
  | "automatic"
  | "human"
  | "none";

export interface AuditFinding {
  id: string;
  title: string;
  description: string;
  module: string;
  severity: AuditFindingSeverity;
  action: AuditFindingAction;
}

interface AuditFindingCardProps {
  finding: AuditFinding;
}

function severityConfig(severity: AuditFindingSeverity) {
  switch (severity) {
    case "critical":
      return {
        label: "Crítico",
        icon: XCircle,
        container:
          "border-red-200 bg-red-50",
        badge:
          "bg-red-100 text-red-700",
        iconColor:
          "text-red-600",
      };

    case "warning":
      return {
        label: "Atenção",
        icon: AlertTriangle,
        container:
          "border-amber-200 bg-amber-50",
        badge:
          "bg-amber-100 text-amber-700",
        iconColor:
          "text-amber-600",
      };

    default:
      return {
        label: "Normal",
        icon: CheckCircle2,
        container:
          "border-emerald-200 bg-emerald-50",
        badge:
          "bg-emerald-100 text-emerald-700",
        iconColor:
          "text-emerald-600",
      };
  }
}

function ActionInfo({
  action,
}: {
  action: AuditFindingAction;
}) {
  if (action === "automatic") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
        <Wrench size={14} />
        Correção automática disponível
      </div>
    );
  }

  if (action === "human") {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
        <UserCheck size={14} />
        Requer decisão humana
      </div>
    );
  }

  return (
    <div className="text-xs font-medium text-slate-500">
      Nenhuma ação necessária
    </div>
  );
}

export default function AuditFindingCard({
  finding,
}: AuditFindingCardProps) {
  const config = severityConfig(
    finding.severity
  );

  const Icon = config.icon;

  return (
    <div
      className={[
        "rounded-2xl border p-4",
        config.container,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 shrink-0",
            config.iconColor,
          ].join(" ")}
        >
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {finding.module}
              </p>

              <h3 className="mt-1 font-bold text-slate-900">
                {finding.title}
              </h3>
            </div>

            <span
              className={[
                "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
                config.badge,
              ].join(" ")}
            >
              {config.label}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {finding.description}
          </p>

          <div className="mt-3 border-t border-black/5 pt-3">
            <ActionInfo action={finding.action} />
          </div>
        </div>
      </div>
    </div>
  );
}