import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { portalRepository } from "../repositories/portal.repository.js";
import { NotFoundError } from "../utils/errors.js";

export const portalService = {
  async listDocuments(ctx: TenantContext, clientId: string) {
    return withTenantContext(ctx, (client) => portalRepository.findDocuments(client, clientId));
  },

  async createDocument(ctx: TenantContext, data: { clientId: string; nome: string; categoria: string; storageKey: string; tamBytes?: number }) {
    return withTenantContext(ctx, (client) =>
      portalRepository.createDocument(client, { ...data, uploadedBy: ctx.userId })
    );
  },

  async listGuides(ctx: TenantContext, clientId: string) {
    return withTenantContext(ctx, (client) => portalRepository.findGuides(client, clientId));
  },

  async createGuide(ctx: TenantContext, data: { clientId: string; titulo: string; descricao?: string; tipo: string; valor: number; vencimento: string; codigoBarras?: string; taxObligationId?: string }) {
    return withTenantContext(ctx, (client) => portalRepository.createGuide(client, data));
  },

  async markGuidePaid(ctx: TenantContext, id: string) {
    return withTenantContext(ctx, async (client) => {
      const guide = await portalRepository.markGuidePaid(client, id);
      if (!guide) throw new NotFoundError("Guia", id);
      return guide;
    });
  },

  async listMessages(ctx: TenantContext, clientId: string) {
    return withTenantContext(ctx, (client) => portalRepository.findMessages(client, clientId));
  },

  async createMessage(ctx: TenantContext, data: { clientId: string; assunto: string; corpo: string; remetente: string; respostaId?: string }) {
    return withTenantContext(ctx, (client) =>
      portalRepository.createMessage(client, { ...data, senderUserId: ctx.userId })
    );
  },

  async updateMessageStatus(ctx: TenantContext, id: string, status: string) {
    return withTenantContext(ctx, async (client) => {
      const msg = await portalRepository.updateMessageStatus(client, id, status);
      if (!msg) throw new NotFoundError("Mensagem", id);
      return msg;
    });
  },
};
