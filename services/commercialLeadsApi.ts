import { apiRequest } from "./apiClient";

export type CommercialLeadStatus = "new" | "contacting" | "qualified" | "converted" | "closed";
export type CommercialLeadInterest = "software_subscription" | "accounting_services" | "both" | "undecided";

export interface CommercialLead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  serviceInterest: CommercialLeadInterest;
  voluntaryDetails: string | null;
  consentedAt: string;
  consentVersion: string;
  status: CommercialLeadStatus;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialLeadPage {
  leads: CommercialLead[];
  total: number;
  page: number;
  limit: number;
}

export const commercialLeadsApi = {
  list(filters: { status?: CommercialLeadStatus; search?: string; page?: number; limit?: number } = {}) {
    return apiRequest<CommercialLeadPage>("/api/admin/commercial-leads", {
      query: {
        status: filters.status,
        search: filters.search,
        page: filters.page?.toString(),
        limit: filters.limit?.toString(),
      },
    });
  },

  async updateStatus(id: string, status: CommercialLeadStatus): Promise<CommercialLead> {
    const { lead } = await apiRequest<{ lead: CommercialLead }>(
      `/api/admin/commercial-leads/${encodeURIComponent(id)}/status`,
      { method: "PATCH", body: { status } },
    );
    return lead;
  },
};
