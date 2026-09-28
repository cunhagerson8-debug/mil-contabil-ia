import { TenantContext, withPlatformContext, withTenantContext } from "../db/withTenantContext.js";
import { userManagementRepository, UserFilters } from "../repositories/user.management.repository.js";
import { aiContextRepository } from "../repositories/ai-context.repository.js";
import { findFirmById } from "../repositories/firm.repository.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../utils/errors.js";

// Nesta etapa, platform_admin só pode convidar diretamente para o comando do
// escritório; company_manager/company_user exigem vínculo de empresa e serão
// tratados em etapa separada.
const PLATFORM_ADMIN_INVITE_ROLES = new Set(["firm_owner", "accountant"]);

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

  async invite(ctx: TenantContext, data: { email: string; fullName: string; role: string; firmId?: string }) {
    if (ctx.role === "platform_admin") {
      return withPlatformContext(async (client) => {
        // firmId veio do frontend como dado solicitado, não como autorização:
        // revalida platform_admin no banco antes de aceitar qualquer coisa do payload.
        const isPlatformAdmin = await aiContextRepository.assertPlatformAdmin(client, ctx.userId);
        if (!isPlatformAdmin) throw new ForbiddenError("Usuário não autorizado como platform_admin.");

        if (!PLATFORM_ADMIN_INVITE_ROLES.has(data.role)) {
          throw new ValidationError("Um administrador da plataforma só pode convidar firm_owner ou accountant nesta etapa.");
        }
        if (!data.firmId) {
          throw new ValidationError("Selecione o escritório contábil para o novo usuário.");
        }

        const firm = await findFirmById(client, data.firmId);
        if (!firm) throw new NotFoundError("Escritório", data.firmId);

        return userManagementRepository.invite(client, {
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          firmId: firm.id,
        });
      });
    }

    // Usuário de escritório: firmId externo é ignorado — sempre o próprio ctx.firmId sob RLS.
    return withTenantContext(ctx, (client) =>
      userManagementRepository.invite(client, { email: data.email, fullName: data.fullName, role: data.role, firmId: ctx.firmId! })
    );
  },
};
