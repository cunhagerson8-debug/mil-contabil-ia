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
import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { taxObligationRepository, TaxObligationFilters } from "../repositories/taxObligation.repository.js";
import { toTaxObligationDto, obligationTypeToDb, periodicityToDb } from "../mappers/taxObligation.mapper.js";
import { TaxObligationCreateInput, TaxObligationUpdateInput, TaxObligationDto, ObligationStatus } from "../types/dto.js";
import { NotFoundError, ConflictError, ValidationError } from "../utils/errors.js";

export const taxObligationService = {
  async list(ctx: TenantContext, filters: { companyId?: string; status?: ObligationStatus } = {}): Promise<TaxObligationDto[]> {
    return withTenantContext(ctx, async (client) => {
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
    return withTenantContext(ctx, async (client) => {
      const row = await taxObligationRepository.findById(client, id);
      if (!row) throw new NotFoundError("Obrigação Fiscal", id);
      return toTaxObligationDto(row);
    });
  },

  async create(ctx: TenantContext, input: TaxObligationCreateInput): Promise<TaxObligationDto> {
    if (!ctx.firmId) throw new ConflictError("Usuário sem escritório associado não pode cadastrar obrigações.");
    if (new Date(input.vencimento).toString() === "Invalid Date") {
      throw new ValidationError("Data de vencimento inválida.");
    }

    return withTenantContext(ctx, async (client) => {
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
