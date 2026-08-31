import type { TenantContext } from "../db/withTenantContext.js";
import {
  taxObligationRepository,
  type CreateTaxObligationInput,
  type UpdateTaxObligationInput,
  type TaxObligation,
} from "../repositories/tax-obligation.repository.js";

export class TaxObligationService {
  async create(
    ctx: TenantContext,
    input: CreateTaxObligationInput
  ): Promise<TaxObligation> {
    if (!input.company_id) {
      throw new Error("Empresa é obrigatória.");
    }

    if (!input.obligation_type) {
      throw new Error("Tipo da obrigação é obrigatório.");
    }

    if (!input.period) {
      throw new Error("Período é obrigatório.");
    }

    if (!input.due_date) {
      throw new Error("Data de vencimento é obrigatória.");
    }

    return taxObligationRepository.create(ctx, input);
  }

  async listByFirm(ctx: TenantContext): Promise<TaxObligation[]> {
    return taxObligationRepository.listByFirm(ctx);
  }

  async listByCompany(
    ctx: TenantContext,
    companyId: string
  ): Promise<TaxObligation[]> {
    if (!companyId) {
      throw new Error("Empresa é obrigatória.");
    }

    return taxObligationRepository.listByCompany(ctx, companyId);
  }

  async findById(
    ctx: TenantContext,
    id: string
  ): Promise<TaxObligation | null> {
    if (!id) {
      throw new Error("ID da obrigação é obrigatório.");
    }

    return taxObligationRepository.findById(ctx, id);
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateTaxObligationInput
  ): Promise<TaxObligation | null> {
    if (!id) {
      throw new Error("ID da obrigação é obrigatório.");
    }

    return taxObligationRepository.update(ctx, id, input);
  }
}

export const taxObligationService = new TaxObligationService();