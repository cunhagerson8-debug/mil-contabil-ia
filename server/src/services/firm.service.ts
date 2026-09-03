import {
  TenantContext,
  withTenantContext,
  withPlatformContext,
} from "../db/withTenantContext.js";
import {
  createFirm,
  findFirmByCnpj,
  findFirmById,
  listFirms,
  softDeleteFirm,
  updateFirm,
  type CreateFirmInput,
  type UpdateFirmInput,
} from "../repositories/firm.repository.js";
import { withPlatformReadOnlyContext } from "../db/withTenantContext.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../utils/errors.js";
import type { CreateAdminFirmInput, UpdateAdminFirmInput } from "../validators/firm.validators.js";

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function validateCnpj(cnpj: string): void {
  const normalized = normalizeCnpj(cnpj);

  if (normalized.length !== 14) {
    throw new Error("CNPJ deve conter 14 dígitos.");
  }
}

function validateName(name: string): void {
  if (!name?.trim()) {
    throw new Error("Razão social é obrigatória.");
  }
}

function assertPlatformAdmin(ctx: TenantContext): void {
  if (ctx.role !== "platform_admin") {
    throw new ForbiddenError("Somente o administrador da plataforma pode administrar escritórios.");
  }
}

function normalizeAndValidateCnpj(cnpj: string): string {
  const normalized = normalizeCnpj(cnpj);
  validateCnpj(normalized);
  return normalized;
}

export const firmService = {
  async listForPlatformAdmin(ctx: TenantContext) {
    assertPlatformAdmin(ctx);
    return withPlatformReadOnlyContext((client) => listFirms(client));
  },

  async getForPlatformAdmin(ctx: TenantContext, firmId: string) {
    assertPlatformAdmin(ctx);
    return withPlatformReadOnlyContext(async (client) => {
      const firm = await findFirmById(client, firmId);
      if (!firm) throw new NotFoundError("Escritório", firmId);
      return firm;
    });
  },

  async createForPlatformAdmin(ctx: TenantContext, input: CreateAdminFirmInput) {
    assertPlatformAdmin(ctx);
    const cnpj = normalizeAndValidateCnpj(input.cnpj);
    return withPlatformContext(async (client) => {
      if (await findFirmByCnpj(client, cnpj)) {
        throw new ConflictError(`Já existe um escritório cadastrado com o CNPJ ${cnpj}.`);
      }
      return createFirm(client, {
        name: input.name,
        trade_name: input.trade_name || null,
        cnpj,
        email: input.email,
        phone: input.phone || null,
        timezone: input.timezone,
        status: input.status,
      });
    });
  },

  async updateForPlatformAdmin(ctx: TenantContext, firmId: string, input: UpdateAdminFirmInput) {
    assertPlatformAdmin(ctx);
    if (input.name !== undefined) validateName(input.name);
    const normalizedCnpj = input.cnpj === undefined ? undefined : normalizeAndValidateCnpj(input.cnpj);
    return withPlatformContext(async (client) => {
      const current = await findFirmById(client, firmId);
      if (!current) throw new NotFoundError("Escritório", firmId);
      if (normalizedCnpj && normalizedCnpj !== current.cnpj && await findFirmByCnpj(client, normalizedCnpj)) {
        throw new ConflictError(`Já existe outro escritório cadastrado com o CNPJ ${normalizedCnpj}.`);
      }
      return updateFirm(client, firmId, {
        name: input.name,
        trade_name: input.trade_name,
        cnpj: normalizedCnpj,
        email: input.email,
        phone: input.phone,
        timezone: input.timezone,
        status: input.status,
      });
    });
  },

  async updateStatusForPlatformAdmin(ctx: TenantContext, firmId: string, status: string) {
    assertPlatformAdmin(ctx);
    if (!["active", "trial", "suspended", "cancelled"].includes(status)) {
      throw new ValidationError("Status de escritório inválido.");
    }
    return withPlatformContext(async (client) => {
      const firm = await updateFirm(client, firmId, { status });
      if (!firm) throw new NotFoundError("Escritório", firmId);
      return firm;
    });
  },

  async create(
  ctx: TenantContext,
  input: CreateFirmInput
) {
  if (ctx.role !== "platform_admin") {
    throw new Error(
      "Somente o administrador da plataforma pode criar um escritório."
    );
  }

  validateName(input.name);
  validateCnpj(input.cnpj);

  return withPlatformContext(async (client) => {
    const cnpj = normalizeCnpj(input.cnpj);

    const existingFirm = await findFirmByCnpj(client, cnpj);

    if (existingFirm) {
      throw new Error(
        "Já existe um escritório cadastrado com este CNPJ."
      );
    }

    return createFirm(client, {
      ...input,
      name: input.name.trim(),
      trade_name: input.trade_name?.trim() || null,
      cnpj,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    });
  });
},

  async getById(
    ctx: TenantContext,
    firmId: string
  ) {
    return withTenantContext(ctx, async (client) => {
      const firm = await findFirmById(client, firmId);

      if (!firm) {
        throw new Error("Escritório não encontrado.");
      }

      return firm;
    });
  },

  async list(ctx: TenantContext) {
    return withTenantContext(ctx, async (client) => {
      return listFirms(client);
    });
  },

  async update(
    ctx: TenantContext,
    firmId: string,
    input: UpdateFirmInput
  ) {
    if (input.name !== undefined) {
      validateName(input.name);
    }

    if (input.cnpj !== undefined) {
      validateCnpj(input.cnpj);
    }

    return withTenantContext(ctx, async (client) => {
      const currentFirm = await findFirmById(client, firmId);

      if (!currentFirm) {
        throw new Error("Escritório não encontrado.");
      }

      const normalizedInput: UpdateFirmInput = {
        ...input,
        name: input.name?.trim(),
        trade_name:
          input.trade_name === undefined
            ? undefined
            : input.trade_name?.trim() || null,
        email:
          input.email === undefined
            ? undefined
            : input.email?.trim() || null,
        phone:
          input.phone === undefined
            ? undefined
            : input.phone?.trim() || null,
      };

      if (input.cnpj !== undefined) {
        const normalizedCnpj = normalizeCnpj(input.cnpj);

        if (normalizedCnpj !== currentFirm.cnpj) {
          const firmWithSameCnpj =
            await findFirmByCnpj(client, normalizedCnpj);

          if (
            firmWithSameCnpj &&
            firmWithSameCnpj.id !== firmId
          ) {
            throw new Error(
              "Já existe outro escritório cadastrado com este CNPJ."
            );
          }

          normalizedInput.cnpj = normalizedCnpj;
        }
      }

      return updateFirm(
        client,
        firmId,
        normalizedInput
      );
    });
  },

  async delete(
    ctx: TenantContext,
    firmId: string
  ) {
    return withTenantContext(ctx, async (client) => {
      const currentFirm = await findFirmById(client, firmId);

      if (!currentFirm) {
        throw new Error("Escritório não encontrado.");
      }

      const deleted = await softDeleteFirm(
        client,
        firmId
      );

      if (!deleted) {
        throw new Error(
          "Não foi possível encerrar o escritório."
        );
      }

      return {
        success: true,
        id: firmId,
      };
    });
  },
};