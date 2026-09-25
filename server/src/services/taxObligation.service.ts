// =============================================================================
// Service: Tax Obligations
// -----------------------------------------------------------------------------
// Nota sobre o trigger de alertas: o banco já gera alertas automaticamente
// quando uma obrigação transiciona para 'vencida' ou 'proxima_vencimento'
// (ver generate_alert_from_obligation em 007_alerts.sql). Esta service NÃO
// duplica essa lógica — apenas grava o estado da obrigação; a geração de
// alerta é responsabilidade do banco via trigger, mantendo uma única fonte
// de verdade para essa regra.
// =============================================================================
import { TenantContext, withPlatformContext, withPlatformReadOnlyContext, withTenantContext } from "../db/withTenantContext.js";
import type { PoolClient } from "pg";
import { taxObligationRepository } from "../repositories/taxObligation.repository.js";
import type { TaxObligationFilters } from "../repositories/taxObligation.repository.js";
import { toTaxObligationDto, obligationTypeToDb, periodicityToDb } from "../mappers/taxObligation.mapper.js";
import { TaxObligationCreateInput, TaxObligationUpdateInput, TaxObligationDto, ObligationStatus } from "../types/dto.js";
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from "../utils/errors.js";
import { aiContextRepository } from "../repositories/ai-context.repository.js";

async function assertPlatformAdmin(client: PoolClient, ctx: TenantContext): Promise<void> {
  if (ctx.role !== "platform_admin" || !(await aiContextRepository.assertPlatformAdmin(client, ctx.userId))) {
    throw new ForbiddenError("Usuário não autorizado como platform_admin.");
  }
}

async function assertTenantCompany(client: PoolClient, ctx: TenantContext, companyId: string): Promise<void> {
  const company = await taxObligationRepository.findCompanyFirm(client, companyId);
  if (!company) throw new NotFoundError("Empresa", companyId);
  if (!ctx.firmId || company.firm_id !== ctx.firmId) {
    throw new ForbiddenError("A empresa não pertence ao escritório do usuário.");
  }
}

export const taxObligationService = {
  async list(ctx: TenantContext, filters: { companyId?: string; status?: ObligationStatus } = {}): Promise<TaxObligationDto[]> {
    if (ctx.role === "platform_admin") {
      return withPlatformReadOnlyContext(async (client) => {
        await assertPlatformAdmin(client, ctx);
        const rows = await taxObligationRepository.findAll(client, {
          companyId: filters.companyId,
          status: filters.status ? ({ "Em Dia": "em_dia", "Próxima do Vencimento": "proxima_vencimento", "Vencida": "vencida", "Não Aplicável": "nao_aplicavel" } as const)[filters.status] : undefined,
        });
        return rows.map(toTaxObligationDto);
      });
    }

    return withTenantContext(ctx, async (client) => {
      if (filters.companyId) await assertTenantCompany(client, ctx, filters.companyId);
      const dbFilters: TaxObligationFilters = {
        companyId: filters.companyId,
        status: filters.status ? (
          { "Em Dia": "em_dia", "Próxima do Vencimento": "proxima_vencimento", "Vencida": "vencida", "Não Aplicável": "nao_aplicavel" } as const
        )[filters.status] : undefined,
      };
      const rows = await taxObligationRepository.findAll(client, dbFilters);
      return rows.map(toTaxObligationDto);
    });
  },

  async getById(ctx: TenantContext, id: string): Promise<TaxObligationDto> {
    if (ctx.role === "platform_admin") {
      return withPlatformReadOnlyContext(async (client) => {
        await assertPlatformAdmin(client, ctx);
        const row = await taxObligationRepository.findById(client, id);
        if (!row) throw new NotFoundError("Obrigação Fiscal", id);
        return toTaxObligationDto(row);
      });
    }

    return withTenantContext(ctx, async (client) => {
      const row = await taxObligationRepository.findById(client, id);
      if (!row) throw new NotFoundError("Obrigação Fiscal", id);
      return toTaxObligationDto(row);
    });
  },

  async create(ctx: TenantContext, input: TaxObligationCreateInput): Promise<TaxObligationDto> {
    if (new Date(input.vencimento).toString() === "Invalid Date") {
      throw new ValidationError("Data de vencimento inválida.");
    }

    if (ctx.role === "platform_admin") {
      return withPlatformContext(async (client) => {
        await assertPlatformAdmin(client, ctx);
        const company = await taxObligationRepository.findCompanyFirm(client, input.companyId);
        if (!company) throw new NotFoundError("Empresa", input.companyId);
        const created = await taxObligationRepository.create(client, {
          firmId: company.firm_id,
          companyId: company.id,
          nome: input.nome,
          type: obligationTypeToDb(input.type),
          competencia: input.competencia,
          vencimento: input.vencimento,
          valor: input.valor,
          observacoes: input.observacoes,
          periodicidade: periodicityToDb(input.periodicidade),
        });
        return toTaxObligationDto(created);
      });
    }

    if (!ctx.firmId) throw new ConflictError("Usuário sem escritório associado não pode cadastrar obrigações.");

    return withTenantContext(ctx, async (client) => {
      await assertTenantCompany(client, ctx, input.companyId);
      const created = await taxObligationRepository.create(client, {
        firmId: ctx.firmId!,
        companyId: input.companyId,
        nome: input.nome,
        type: obligationTypeToDb(input.type),
        competencia: input.competencia,
        vencimento: input.vencimento,
        valor: input.valor,
        observacoes: input.observacoes,
        periodicidade: periodicityToDb(input.periodicidade),
      });
      return toTaxObligationDto(created);
    });
  },

  async update(ctx: TenantContext, id: string, input: TaxObligationUpdateInput): Promise<TaxObligationDto> {
    if (ctx.role === "platform_admin") {
      return withPlatformContext(async (client) => {
        await assertPlatformAdmin(client, ctx);
        const updated = await taxObligationRepository.update(client, id, {
          nome: input.nome,
          type: input.type ? obligationTypeToDb(input.type) : undefined,
          competencia: input.competencia,
          vencimento: input.vencimento,
          status: input.status ? ({ "Em Dia": "em_dia", "Próxima do Vencimento": "proxima_vencimento", "Vencida": "vencida", "Não Aplicável": "nao_aplicavel" } as const)[input.status] : undefined,
          valor: input.valor,
          observacoes: input.observacoes,
          periodicidade: input.periodicidade ? periodicityToDb(input.periodicidade) : undefined,
        });
        if (!updated) throw new NotFoundError("Obrigação Fiscal", id);
        return toTaxObligationDto(updated);
      });
    }

    return withTenantContext(ctx, async (client) => {
      const STATUS_TO_DB = { "Em Dia": "em_dia", "Próxima do Vencimento": "proxima_vencimento", "Vencida": "vencida", "Não Aplicável": "nao_aplicavel" } as const;
      const updated = await taxObligationRepository.update(client, id, {
        nome: input.nome,
        type: input.type ? obligationTypeToDb(input.type) : undefined,
        competencia: input.competencia,
        vencimento: input.vencimento,
        status: input.status ? STATUS_TO_DB[input.status] : undefined,
        valor: input.valor,
        observacoes: input.observacoes,
        periodicidade: input.periodicidade ? periodicityToDb(input.periodicidade) : undefined,
      });
      if (!updated) throw new NotFoundError("Obrigação Fiscal", id);
      return toTaxObligationDto(updated);
    });
  },

  async markAsPaid(ctx: TenantContext, id: string): Promise<TaxObligationDto> {
    if (ctx.role === "platform_admin") {
      return withPlatformContext(async (client) => {
        await assertPlatformAdmin(client, ctx);
        const updated = await taxObligationRepository.markPaid(client, id);
        if (!updated) throw new NotFoundError("Obrigação Fiscal", id);
        return toTaxObligationDto(updated);
      });
    }

    return withTenantContext(ctx, async (client) => {
      const updated = await taxObligationRepository.markPaid(client, id);
      if (!updated) throw new NotFoundError("Obrigação Fiscal", id);
      return toTaxObligationDto(updated);
    });
  },

  /**
   * Hard delete — diferente de companies/clients. Justificativa de produto:
   * uma obrigação só é removida quando foi lançada por erro (duplicada,
   * competência errada) ANTES de qualquer pagamento ou geração de alerta.
   * Reforça essa regra aqui, não confiando apenas na UI para impedir.
   */
  async remove(ctx: TenantContext, id: string): Promise<void> {
    if (ctx.role === "platform_admin") {
      await withPlatformContext(async (client) => {
        await assertPlatformAdmin(client, ctx);
        const row = await taxObligationRepository.findById(client, id);
        if (!row) throw new NotFoundError("Obrigação Fiscal", id);
        if (row.paid_at) throw new ConflictError("Não é possível excluir uma obrigação já paga. Histórico fiscal deve ser preservado.");
        await taxObligationRepository.hardDelete(client, id);
      });
      return;
    }

    await withTenantContext(ctx, async (client) => {
      const row = await taxObligationRepository.findById(client, id);
      if (!row) throw new NotFoundError("Obrigação Fiscal", id);
      if (row.paid_at) {
        throw new ConflictError("Não é possível excluir uma obrigação já paga. Histórico fiscal deve ser preservado.");
      }
      await taxObligationRepository.hardDelete(client, id);
    });
  },
};
