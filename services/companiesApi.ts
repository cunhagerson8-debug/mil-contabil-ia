import { apiRequest } from "./apiClient";
import { Company } from "../modules/empresas/types";

// =============================================================================
// Cliente de API para o módulo Empresas.
// Substitui o uso direto de modules/empresas/mockData.ts pelos componentes.
// =============================================================================

export interface CompanyCreateInput {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  cnaeDescricao?: string;
  regime: Company["regime"];
  responsavel: string;
  contadorResponsavelId?: string;
  dataAbertura: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

export type CompanyUpdateInput = Partial<CompanyCreateInput> & { status?: Company["status"] };

export const companiesApi = {
  async list(filters: { status?: string; search?: string } = {}): Promise<Company[]> {
    const { companies } = await apiRequest<{ companies: Company[] }>("/api/companies", { query: filters });
    return companies;
  },

  async getById(id: string): Promise<Company> {
    const { company } = await apiRequest<{ company: Company }>(`/api/companies/${id}`);
    return company;
  },

  async create(input: CompanyCreateInput): Promise<Company> {
    const { company } = await apiRequest<{ company: Company }>("/api/companies", {
      method: "POST",
      body: input,
    });
    return company;
  },

  async update(id: string, input: CompanyUpdateInput): Promise<Company> {
    const { company } = await apiRequest<{ company: Company }>(`/api/companies/${id}`, {
      method: "PUT",
      body: input,
    });
    return company;
  },

  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/api/companies/${id}`, { method: "DELETE" });
  },
};
