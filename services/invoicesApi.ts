import { apiRequest } from "./apiClient.js";

export interface InvoiceDto {
  id: string;
  companyId: string;
  numero: string;
  tipo: string;
  status: string;
  dataEmissao: string;
  tomador: string;
  tomadorDoc: string;
  valorTotal: number;
  impostos?: { iss?: number; pis?: number; cofins?: number; csll?: number; irrf?: number };
  chaveAcesso?: string;
  motivoCancelamento?: string;
  items?: InvoiceItemDto[];
}

export interface InvoiceItemDto {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ordem: number;
}

export interface InvoiceCreateInput {
  companyId: string;
  numero: string;
  tipo: string;
  dataEmissao: string;
  tomador: string;
  tomadorDoc: string;
  valorTotal: number;
  iss?: number;
  pis?: number;
  cofins?: number;
  csll?: number;
  irrf?: number;
  items?: Omit<InvoiceItemDto, "id">[];
}

export const invoicesApi = {
  async list(filters?: { companyId?: string; status?: string; search?: string }) {
    const query: Record<string, string | undefined> = {};
    if (filters?.companyId) query.companyId = filters.companyId;
    if (filters?.status) query.status = filters.status;
    if (filters?.search) query.search = filters.search;
    const res = await apiRequest<{ invoices: InvoiceDto[] }>("/api/invoices", { query });
    return res.invoices;
  },

  async getById(id: string) {
    const res = await apiRequest<{ invoice: InvoiceDto }>(`/api/invoices/${id}`);
    return res.invoice;
  },

  async create(data: InvoiceCreateInput) {
    const res = await apiRequest<{ invoice: InvoiceDto }>("/api/invoices", { method: "POST", body: data });
    return res.invoice;
  },

  async updateStatus(id: string, status: string, motivoCancelamento?: string) {
    const res = await apiRequest<{ invoice: InvoiceDto }>(`/api/invoices/${id}/status`, {
      method: "PATCH",
      body: { status, motivoCancelamento },
    });
    return res.invoice;
  },
};
