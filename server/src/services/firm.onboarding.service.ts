import { TenantContext, withPlatformContext } from "../db/withTenantContext.js";
import { createFirm, findFirmByCnpj } from "../repositories/firm.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { userManagementRepository } from "../repositories/user.management.repository.js";
import { toManagedUserDto } from "../mappers/user.mapper.js";
import { aiContextRepository } from "../repositories/ai-context.repository.js";
import { createInvitationCredentials } from "./user.management.service.js";
import { emailService } from "./email.service.js";
import { ConflictError, ForbiddenError, ValidationError } from "../utils/errors.js";
import type { OnboardFirmInput } from "../validators/firm.validators.js";

export const firmOnboardingService = {
  // Cria escritório + firm_owner (invited) + convite em UMA transação; o e-mail
  // só é enviado após o commit e sua falha nunca desfaz os registros.
  async onboard(ctx: TenantContext, input: OnboardFirmInput) {
    if (ctx.role !== "platform_admin") {
      throw new ForbiddenError("Somente o administrador da plataforma pode criar escritórios.");
    }

    const cnpj = input.cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) throw new ValidationError("CNPJ deve conter 14 dígitos.");
    const email = input.email.trim().toLowerCase();

    const created = await withPlatformContext(async (client) => {
      // Revalida no banco, como no convite de platform_admin.
      if (!(await aiContextRepository.assertPlatformAdmin(client, ctx.userId))) {
        throw new ForbiddenError("Usuário não autorizado como platform_admin.");
      }

      // Serializa onboardings concorrentes com o mesmo e-mail (lock liberado no fim da transação).
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`onboarding-email:${email}`]);

      if (await userRepository.findByEmailAnyFirm(client, email)) {
        throw new ConflictError("Já existe um usuário cadastrado com este e-mail.");
      }
      if (await findFirmByCnpj(client, cnpj)) {
        throw new ConflictError(`Já existe um escritório cadastrado com o CNPJ ${cnpj}.`);
      }

      const firm = await createFirm(client, {
        name: input.name,
        trade_name: input.trade_name || null,
        cnpj,
        email,
        phone: input.phone || null,
        timezone: input.timezone,
        status: "trial",
      });

      const invitation = createInvitationCredentials();
      const user = await userManagementRepository.invite(client, {
        email,
        fullName: input.adminFullName,
        role: "firm_owner",
        firmId: firm.id,
        invitedBy: ctx.userId,
        tokenHash: invitation.tokenHash,
        expiresAt: invitation.expiresAt,
      });

      return { firm, user: toManagedUserDto(user), token: invitation.token, expiresAt: invitation.expiresAt };
    });

    let emailSent = true;
    try {
      await emailService.sendInvitationEmail({
        to: email,
        fullName: input.adminFullName,
        token: created.token,
        expiresAt: created.expiresAt,
      });
    } catch (err) {
      emailSent = false;
      console.error("[onboarding] Falha ao enviar e-mail de convite", {
        firmId: created.firm.id,
        userId: created.user.id,
        reason: err instanceof Error ? err.message : "erro desconhecido",
      });
    }

    return { firm: created.firm, user: created.user, emailSent };
  },
};
