import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { alertRepository, AlertFilters } from "../repositories/alert.repository.js";
import { NotFoundError } from "../utils/errors.js";

export const alertService = {
  async list(ctx: TenantContext, filters: AlertFilters) {
    return withTenantContext(ctx, (client) => alertRepository.findAll(client, filters));
  },

  async getById(ctx: TenantContext, id: string) {
    return withTenantContext(ctx, async (client) => {
      const alert = await alertRepository.findById(client, id);
      if (!alert) throw new NotFoundError("Alerta", id);
      return alert;
    });
  },

  async markRead(ctx: TenantContext, id: string) {
    return withTenantContext(ctx, async (client) => {
      const alert = await alertRepository.markRead(client, id, ctx.userId);
      if (!alert) throw new NotFoundError("Alerta", id);
      return alert;
    });
  },

  async markAllRead(ctx: TenantContext) {
    return withTenantContext(ctx, (client) =>
      alertRepository.markAllRead(client, ctx.firmId!, ctx.userId)
    );
  },
};
