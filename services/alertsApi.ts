import { apiRequest } from "./apiClient.js";
import type { AlertCategory, AlertSeverity } from "../modules/alertas/types.js";

export interface AlertDto {
  id: string;
  companyId?: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: AlertCategory;
  dueDate?: string;
  read: boolean;
  readAt?: string;
  actionLabel?: string;
  actionTarget?: string;
  sourceModule: string;
  createdAt: string;
}

interface AlertApiRow {
  id?: unknown;
  company_id?: unknown;
  companyId?: unknown;
  title?: unknown;
  description?: unknown;
  severity?: unknown;
  category?: unknown;
  due_date?: unknown;
  dueDate?: unknown;
  read?: unknown;
  read_at?: unknown;
  readAt?: unknown;
  action_label?: unknown;
  actionLabel?: unknown;
  action_target?: unknown;
  actionTarget?: unknown;
  source_module?: unknown;
  sourceModule?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
}

const SEVERITY_BY_API_VALUE: Record<string, AlertSeverity> = {
  critico: "Crítico",
  "crítico": "Crítico",
  atencao: "Atenção",
  "atenção": "Atenção",
  informativo: "Informativo",
};

const CATEGORY_BY_API_VALUE: Record<string, AlertCategory> = {
  obrigacao_fiscal: "Obrigação Fiscal",
  "obrigação fiscal": "Obrigação Fiscal",
  certificado_digital: "Certificado Digital",
  "certificado digital": "Certificado Digital",
  pendencia_fiscal: "Pendência Fiscal",
  "pendência fiscal": "Pendência Fiscal",
  nota_fiscal: "Nota Fiscal",
  "nota fiscal": "Nota Fiscal",
  cliente: "Cliente",
  sistema: "Sistema",
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalDate(value: unknown): string | undefined {
  const text = optionalString(value);
  if (!text || Number.isNaN(new Date(text).getTime())) return undefined;
  return text;
}

function normalizeSeverity(value: unknown): AlertSeverity {
  const normalized = optionalString(value)?.toLocaleLowerCase("pt-BR");
  return normalized ? SEVERITY_BY_API_VALUE[normalized] ?? "Informativo" : "Informativo";
}

function normalizeCategory(value: unknown): AlertCategory {
  const normalized = optionalString(value)?.toLocaleLowerCase("pt-BR");
  return normalized ? CATEGORY_BY_API_VALUE[normalized] ?? "Sistema" : "Sistema";
}

function normalizeAlert(payload: unknown): AlertDto {
  const row = payload && typeof payload === "object" ? payload as AlertApiRow : {};
  const companyId = optionalString(row.company_id ?? row.companyId);
  const dueDate = optionalDate(row.due_date ?? row.dueDate);
  const readAt = optionalDate(row.read_at ?? row.readAt);
  const actionLabel = optionalString(row.action_label ?? row.actionLabel);
  const actionTarget = optionalString(row.action_target ?? row.actionTarget);

  return {
    id: optionalString(row.id) ?? "",
    ...(companyId ? { companyId } : {}),
    title: optionalString(row.title) ?? "Alerta",
    description: typeof row.description === "string" ? row.description : "",
    severity: normalizeSeverity(row.severity),
    category: normalizeCategory(row.category),
    ...(dueDate ? { dueDate } : {}),
    read: row.read === true,
    ...(readAt ? { readAt } : {}),
    ...(actionLabel ? { actionLabel } : {}),
    ...(actionTarget ? { actionTarget } : {}),
    sourceModule: optionalString(row.source_module ?? row.sourceModule) ?? "Sistema",
    createdAt: optionalDate(row.created_at ?? row.createdAt) ?? "",
  };
}

export const alertsApi = {
  async list(filters?: { companyId?: string; severity?: string; category?: string; read?: boolean }) {
    const query: Record<string, string | undefined> = {};
    if (filters?.companyId) query.companyId = filters.companyId;
    if (filters?.severity) query.severity = filters.severity;
    if (filters?.category) query.category = filters.category;
    if (filters?.read !== undefined) query.read = String(filters.read);
    const res = await apiRequest<{ alerts?: unknown }>("/api/alerts", { query });
    return Array.isArray(res.alerts) ? res.alerts.map(normalizeAlert) : [];
  },

  async getById(id: string) {
    const res = await apiRequest<{ alert?: unknown }>(`/api/alerts/${id}`);
    return normalizeAlert(res.alert);
  },

  async markRead(id: string) {
    const res = await apiRequest<{ alert?: unknown }>(`/api/alerts/${id}/read`, { method: "PATCH" });
    return normalizeAlert(res.alert);
  },

  async markAllRead() {
    const res = await apiRequest<{ markedCount: number }>("/api/alerts/mark-all-read", { method: "POST" });
    return res.markedCount;
  },
};
