import { apiRequest } from "./apiClient";

export type FirmStatus = "active" | "trial" | "suspended" | "cancelled";

export interface Firm {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string;
  status: FirmStatus;
  email: string;
  phone: string | null;
  timezone: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FirmInput {
  name: string;
  trade_name?: string;
  cnpj: string;
  email: string;
  phone?: string;
  timezone?: string;
  status?: FirmStatus;
}

export const firmsApi = {
  async list(): Promise<Firm[]> {
    const { firms } = await apiRequest<{ firms: Firm[] }>("/api/admin/firms");
    return firms;
  },
  async getById(id: string): Promise<Firm> {
    const { firm } = await apiRequest<{ firm: Firm }>(`/api/admin/firms/${id}`);
    return firm;
  },
  async create(input: FirmInput): Promise<Firm> {
    const { firm } = await apiRequest<{ firm: Firm }>("/api/admin/firms", { method: "POST", body: input });
    return firm;
  },
  async update(id: string, input: Partial<FirmInput>): Promise<Firm> {
    const { firm } = await apiRequest<{ firm: Firm }>(`/api/admin/firms/${id}`, { method: "PUT", body: input });
    return firm;
  },
  async updateStatus(id: string, status: FirmStatus): Promise<Firm> {
    const { firm } = await apiRequest<{ firm: Firm }>(`/api/admin/firms/${id}/status`, { method: "PATCH", body: { status } });
    return firm;
  },
};