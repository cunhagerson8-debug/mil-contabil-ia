import { apiRequest } from "./apiClient.js";

export interface AlertDto {
  id: string;
  companyId?: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  dueDate?: string;
  read: boolean;
  readAt?: string;
  actionLabel?: string;
  actionTarget?: string;
  sourceModule: string;
  createdAt: string;
}

export const alertsApi = {
  async list(filters?: { companyId?: string; severity?: string; category?: string; read?: boolean }) {
    const query: Record<string, string | undefined> = {};
    if (filters?.companyId) query.companyId = filters.companyId;
    if (filters?.severity) query.severity = filters.severity;
    if (filters?.category) query.category = filters.category;
    if (filters?.read !== undefined) query.read = String(filters.read);
    const res = await apiRequest<{ alerts: AlertDto[] }>("/api/alerts", { query });
    return res.alerts;
  },

  async getById(id: string) {
    const res = await apiRequest<{ alert: AlertDto }>(`/api/alerts/${id}`);
    return res.alert;
  },

  async markRead(id: string) {
    const res = await apiRequest<{ alert: AlertDto }>(`/api/alerts/${id}/read`, { method: "PATCH" });
    return res.alert;
  },

  async markAllRead() {
    const res = await apiRequest<{ markedCount: number }>("/api/alerts/mark-all-read", { method: "POST" });
    return res.markedCount;
  },
};
