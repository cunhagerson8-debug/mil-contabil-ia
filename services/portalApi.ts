import { apiRequest } from "./apiClient.js";

export interface PortalDocumentDto {
  id: string;
  clientId: string;
  nome: string;
  categoria: string;
  storageKey: string;
  tamanhoBytes?: number;
  dataDisponibilizacao: string;
  validade?: string;
}

export interface PortalGuideDto {
  id: string;
  clientId: string;
  titulo: string;
  descricao?: string;
  tipo: string;
  valor: number;
  vencimento: string;
  codigoBarras?: string;
  pago: boolean;
  paidAt?: string;
  dataDisponibilizacao: string;
}

export interface PortalMessageDto {
  id: string;
  clientId: string;
  assunto: string;
  corpo: string;
  remetente: string;
  status: string;
  respostaId?: string;
  data: string;
}

export const portalApi = {
  // Documents
  async listDocuments(clientId: string) {
    const res = await apiRequest<{ documents: PortalDocumentDto[] }>(`/api/portal/documents/${clientId}`);
    return res.documents;
  },

  async createDocument(data: { clientId: string; nome: string; categoria: string; storageKey: string; tamBytes?: number }) {
    const res = await apiRequest<{ document: PortalDocumentDto }>("/api/portal/documents", { method: "POST", body: data });
    return res.document;
  },

  // Guides
  async listGuides(clientId: string) {
    const res = await apiRequest<{ guides: PortalGuideDto[] }>(`/api/portal/guides/${clientId}`);
    return res.guides;
  },

  async createGuide(data: { clientId: string; titulo: string; descricao?: string; tipo: string; valor: number; vencimento: string; codigoBarras?: string }) {
    const res = await apiRequest<{ guide: PortalGuideDto }>("/api/portal/guides", { method: "POST", body: data });
    return res.guide;
  },

  async markGuidePaid(id: string) {
    const res = await apiRequest<{ guide: PortalGuideDto }>(`/api/portal/guides/${id}/paid`, { method: "PATCH" });
    return res.guide;
  },

  // Messages
  async listMessages(clientId: string) {
    const res = await apiRequest<{ messages: PortalMessageDto[] }>(`/api/portal/messages/${clientId}`);
    return res.messages;
  },

  async createMessage(data: { clientId: string; assunto: string; corpo: string; remetente: string; respostaId?: string }) {
    const res = await apiRequest<{ message: PortalMessageDto }>("/api/portal/messages", { method: "POST", body: data });
    return res.message;
  },

  async updateMessageStatus(id: string, status: string) {
    const res = await apiRequest<{ message: PortalMessageDto }>(`/api/portal/messages/${id}/status`, { method: "PATCH", body: { status } });
    return res.message;
  },
};
