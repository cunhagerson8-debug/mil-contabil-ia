import { apiRequest } from "./apiClient";
import { Client } from "../modules/clientes/types";

// =============================================================================
// Cliente de API para o módulo Clientes.
// =============================================================================

export interface ClientCreateInput {
  companyId?: string;
  nome: string;
  tipo: Client["tipo"];
  documento: string;
  servicosContratados?: string[];
}

export type ClientUpdateInput = Partial<ClientCreateInput> & { status?: Client["status"] };

export const clientsApi = {
  async list(filters: { status?: string; search?: string } = {}): Promise<Client[]> {
    const { clients } = await apiRequest<{ clients: Client[] }>("/api/clients", { query: filters });
    return clients;
  },

  async getById(id: string): Promise<Client> {
    const { client } = await apiRequest<{ client: Client }>(`/api/clients/${id}`);
    return client;
  },

  async create(input: ClientCreateInput): Promise<Client> {
    const { client } = await apiRequest<{ client: Client }>("/api/clients", {
      method: "POST",
      body: input,
    });
    return client;
  },

  async update(id: string, input: ClientUpdateInput): Promise<Client> {
    const { client } = await apiRequest<{ client: Client }>(`/api/clients/${id}`, {
      method: "PUT",
      body: input,
    });
    return client;
  },

  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/api/clients/${id}`, { method: "DELETE" });
  },
};
