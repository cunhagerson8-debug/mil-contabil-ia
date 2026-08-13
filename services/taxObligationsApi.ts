import { apiRequest } from "./apiClient";
import { TaxObligation } from "../modules/obrigacoes-fiscais/types";

// =============================================================================
// Cliente de API para o módulo Obrigações Fiscais.
// =============================================================================

export interface TaxObligationCreateInput {
  companyId: string;
  nome: string;
  type: TaxObligation["type"];
  competencia: string;
  vencimento: string;
  valor?: number;
  observacoes?: string;
  periodicidade: TaxObligation["periodicidade"];
}

export type TaxObligationUpdateInput = Partial<TaxObligationCreateInput> & { status?: TaxObligation["status"] };

export const taxObligationsApi = {
  async list(filters: { companyId?: string; status?: string } = {}): Promise<TaxObligation[]> {
    const { obligations } = await apiRequest<{ obligations: TaxObligation[] }>("/api/tax-obligations", { query: filters });
    return obligations;
  },

  async getById(id: string): Promise<TaxObligation> {
    const { obligation } = await apiRequest<{ obligation: TaxObligation }>(`/api/tax-obligations/${id}`);
    return obligation;
  },

  async create(input: TaxObligationCreateInput): Promise<TaxObligation> {
    const { obligation } = await apiRequest<{ obligation: TaxObligation }>("/api/tax-obligations", {
      method: "POST",
      body: input,
    });
    return obligation;
  },

  async update(id: string, input: TaxObligationUpdateInput): Promise<TaxObligation> {
    const { obligation } = await apiRequest<{ obligation: TaxObligation }>(`/api/tax-obligations/${id}`, {
      method: "PUT",
      body: input,
    });
    return obligation;
  },

  async markPaid(id: string): Promise<TaxObligation> {
    const { obligation } = await apiRequest<{ obligation: TaxObligation }>(`/api/tax-obligations/${id}/mark-paid`, {
      method: "POST",
    });
    return obligation;
  },

  async remove(id: string): Promise<void> {
    await apiRequest<void>(`/api/tax-obligations/${id}`, { method: "DELETE" });
  },
};
