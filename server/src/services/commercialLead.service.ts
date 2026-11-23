import { aiContextRepository } from "../repositories/ai-context.repository.js";
import { commercialLeadRepository, type PublicCommercialLeadRowInput } from "../repositories/commercialLead.repository.js";
import { withPlatformContext, withPlatformReadOnlyContext, type TenantContext } from "../db/withTenantContext.js";
import type { CommercialLeadDto, CommercialLeadStatus } from "../types/dto.js";
import type { CommercialLeadRow } from "../types/db.js";
import {
  normalizeBrazilianWhatsApp,
  publicCommercialLeadSchema,
  type CommercialLeadListQuery,
} from "../validators/commercialLead.validators.js";
import { ForbiddenError, NotFoundError, ServiceUnavailableError, ValidationError } from "../utils/errors.js";

const CONSENT_VERSION = "mila-lead-v1";

interface PublicLeadRepository {
  insertIfNew(input: PublicCommercialLeadRowInput): Promise<void>;
}

function safeDatabaseCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "unknown";
  const code = error.code;
  return typeof code === "string" && /^[A-Z0-9_]{2,30}$/.test(code)
    ? code
    : "unknown";
}

function assertPlatformAdmin(ctx: TenantContext): void {
  if (ctx.role !== "platform_admin") {
    throw new ForbiddenError("Acesso restrito a administradores da plataforma.");
  }
}

function toDto(row: CommercialLeadRow): CommercialLeadDto {
  return {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp_e164,
    email: row.email,
    serviceInterest: row.service_interest,
    voluntaryDetails: row.voluntary_details,
    consentedAt: row.consented_at,
    consentVersion: row.consent_version,
    status: row.status,
    lastContactedAt: row.last_contacted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPublicCommercialLeadService(repository: PublicLeadRepository) {
  return {
    async submit(input: unknown): Promise<{ accepted: true }> {
      const validated = publicCommercialLeadSchema.parse(input);
      if (validated.website) return { accepted: true };

      const whatsappE164 = normalizeBrazilianWhatsApp(validated.whatsapp);
      if (!whatsappE164) throw new ValidationError("Informe um WhatsApp válido.");

      try {
        await repository.insertIfNew({
          name: validated.name,
          whatsappE164,
          email: validated.email || null,
          serviceInterest: validated.serviceInterest,
          voluntaryDetails: validated.voluntaryDetails || null,
          consentVersion: CONSENT_VERSION,
        });
      } catch (error) {
        console.error("[commercial-leads] submission failed", { code: safeDatabaseCode(error) });
        throw new ServiceUnavailableError(
          "Não foi possível registrar sua solicitação agora. Tente novamente mais tarde.",
        );
      }

      return { accepted: true };
    },
  };
}

export const publicCommercialLeadService = createPublicCommercialLeadService(commercialLeadRepository);

export const commercialLeadService = {
  async listForPlatformAdmin(
    ctx: TenantContext,
    query: CommercialLeadListQuery,
  ): Promise<{ leads: CommercialLeadDto[]; total: number; page: number; limit: number }> {
    assertPlatformAdmin(ctx);
    return withPlatformReadOnlyContext(async (client) => {
      if (!(await aiContextRepository.assertPlatformAdmin(client, ctx.userId))) {
        throw new ForbiddenError("Usuário não autorizado como platform_admin.");
      }
      const result = await commercialLeadRepository.list(client, query);
      return {
        leads: result.rows.map(toDto),
        total: result.total,
        page: query.page,
        limit: query.limit,
      };
    });
  },

  async updateStatus(
    ctx: TenantContext,
    id: string,
    status: CommercialLeadStatus,
  ): Promise<CommercialLeadDto> {
    assertPlatformAdmin(ctx);
    return withPlatformContext(async (client) => {
      if (!(await aiContextRepository.assertPlatformAdmin(client, ctx.userId))) {
        throw new ForbiddenError("Usuário não autorizado como platform_admin.");
      }
      const row = await commercialLeadRepository.updateStatus(
        client,
        id,
        status,
        ctx.userId,
      );
      if (!row) throw new NotFoundError("Solicitação comercial", id);
      return toDto(row);
    });
  },
};
