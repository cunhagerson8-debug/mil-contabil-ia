import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { userManagementRepository, UserFilters } from "../repositories/user.management.repository.js";
import { NotFoundError } from "../utils/errors.js";

export const userManagementService = {
  async list(ctx: TenantContext, filters: UserFilters) {
    return withTenantContext(ctx, (client) => userManagementRepository.findAll(client, filters));
  },

  async getById(ctx: TenantContext, id: string) {
    return withTenantContext(ctx, async (client) => {
      const user = await userManagementRepository.findById(client, id);
      if (!user) throw new NotFoundError("Usuário", id);
      const access = await userManagementRepository.findCompanyAccess(client, id);
      return { ...user, companyAccess: access };
    });
  },

  async updateStatus(ctx: TenantContext, id: string, status: string) {
    return withTenantContext(ctx, async (client) => {
      const user = await userManagementRepository.updateStatus(client, id, status);
      if (!user) throw new NotFoundError("Usuário", id);
      return user;
    });
  },

  async updateRole(ctx: TenantContext, id: string, role: string) {
    return withTenantContext(ctx, async (client) => {
      const user = await userManagementRepository.updateRole(client, id, role);
      if (!user) throw new NotFoundError("Usuário", id);
      return user;
    });
  },

  async invite(ctx: TenantContext, data: { email: string; fullName: string; role: string }) {
    return withTenantContext(ctx, (client) =>
      userManagementRepository.invite(client, { ...data, firmId: ctx.firmId! })
    );
  },
};
