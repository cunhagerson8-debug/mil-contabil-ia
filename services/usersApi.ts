import { apiRequest } from "./apiClient.js";

export interface ManagedUserDto {
  id: string;
  firmId: string | null;
  firmName?: string;
  role: string;
  status: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  companyAccess?: { userId: string; companyId: string; canManage: boolean }[];
}

export const usersApi = {
  async list(filters?: { role?: string; status?: string; search?: string }) {
    const query: Record<string, string | undefined> = {};
    if (filters?.role) query.role = filters.role;
    if (filters?.status) query.status = filters.status;
    if (filters?.search) query.search = filters.search;
    const res = await apiRequest<{ users: ManagedUserDto[] }>("/api/users", { query });
    return res.users;
  },

  async getById(id: string) {
    const res = await apiRequest<{ user: ManagedUserDto }>(`/api/users/${id}`);
    return res.user;
  },

  async invite(data: { email: string; fullName: string; role: string }) {
    const res = await apiRequest<{ user: ManagedUserDto }>("/api/users/invite", { method: "POST", body: data });
    return res.user;
  },

  async updateStatus(id: string, status: string) {
    const res = await apiRequest<{ user: ManagedUserDto }>(`/api/users/${id}/status`, { method: "PATCH", body: { status } });
    return res.user;
  },

  async updateRole(id: string, role: string) {
    const res = await apiRequest<{ user: ManagedUserDto }>(`/api/users/${id}/role`, { method: "PATCH", body: { role } });
    return res.user;
  },
};
