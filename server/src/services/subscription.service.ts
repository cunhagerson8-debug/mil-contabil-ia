// ============================================================
// Service: Assinaturas / Cobrança
// ============================================================

import {
  TenantContext,
  withTenantContext,
} from "../db/withTenantContext.js";

import {
  subscriptionRepository,
  SubscriptionCreateRow,
  SubscriptionUpdateRow,
} from "../repositories/subscription.repository.js";

import {
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";

export interface SubscriptionCreateInput {
  planId: string;
  status?: string;
  currentPeriodStart?: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
  paymentProvider?: string | null;
  paymentProviderRef?: string | null;
}

export interface SubscriptionUpdateInput {
  planId?: string;
  status?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  paymentProvider?: string | null;
  paymentProviderRef?: string | null;
}

export const subscriptionService = {
  async list(ctx: TenantContext) {
    return withTenantContext(ctx, async (client) => {
      return subscriptionRepository.findAll(client);
    });
  },

  async getById(
    ctx: TenantContext,
    subscriptionId: string
  ) {
    return withTenantContext(ctx, async (client) => {
      const subscription =
        await subscriptionRepository.findById(
          client,
          subscriptionId
        );

      if (!subscription) {
        throw new NotFoundError(
          "Assinatura",
          subscriptionId
        );
      }

      return subscription;
    });
  },

  async getCurrent(ctx: TenantContext) {
    if (!ctx.firmId) {
      throw new ConflictError(
        "Usuário sem escritório associado."
      );
    }

    return withTenantContext(ctx, async (client) => {
      return subscriptionRepository.findCurrentByFirm(
        client,
        ctx.firmId!
      );
    });
  },

  async create(
    ctx: TenantContext,
    input: SubscriptionCreateInput
  ) {
    if (!ctx.firmId) {
      throw new ConflictError(
        "Usuário sem escritório associado não pode criar assinatura."
      );
    }

    return withTenantContext(ctx, async (client) => {
      const existing =
        await subscriptionRepository.findCurrentByFirm(
          client,
          ctx.firmId!
        );

      if (existing) {
        throw new ConflictError(
          "Este escritório já possui uma assinatura ativa."
        );
      }

      const data: SubscriptionCreateRow = {
        firmId: ctx.firmId!,
        planId: input.planId,
        status: input.status ?? "trialing",
        currentPeriodStart:
          input.currentPeriodStart,
        currentPeriodEnd:
          input.currentPeriodEnd,
        cancelAtPeriodEnd:
          input.cancelAtPeriodEnd ?? false,
        paymentProvider:
          input.paymentProvider ?? null,
        paymentProviderRef:
          input.paymentProviderRef ?? null,
      };

      return subscriptionRepository.create(
        client,
        data
      );
    });
  },

  async update(
    ctx: TenantContext,
    subscriptionId: string,
    input: SubscriptionUpdateInput
  ) {
    return withTenantContext(ctx, async (client) => {
      const existing =
        await subscriptionRepository.findById(
          client,
          subscriptionId
        );

      if (!existing) {
        throw new NotFoundError(
          "Assinatura",
          subscriptionId
        );
      }

      const data: SubscriptionUpdateRow = {
        planId: input.planId,
        status: input.status,
        currentPeriodStart:
          input.currentPeriodStart,
        currentPeriodEnd:
          input.currentPeriodEnd,
        cancelAtPeriodEnd:
          input.cancelAtPeriodEnd,
        cancelledAt:
          input.cancelledAt,
        paymentProvider:
          input.paymentProvider,
        paymentProviderRef:
          input.paymentProviderRef,
      };

      const updated =
        await subscriptionRepository.update(
          client,
          subscriptionId,
          data
        );

      if (!updated) {
        throw new NotFoundError(
          "Assinatura",
          subscriptionId
        );
      }

      return updated;
    });
  },

  async cancel(
    ctx: TenantContext,
    subscriptionId: string,
    atPeriodEnd = true
  ) {
    return withTenantContext(ctx, async (client) => {
      const existing =
        await subscriptionRepository.findById(
          client,
          subscriptionId
        );

      if (!existing) {
        throw new NotFoundError(
          "Assinatura",
          subscriptionId
        );
      }

      const cancelled =
        await subscriptionRepository.cancel(
          client,
          subscriptionId,
          atPeriodEnd
        );

      if (!cancelled) {
        throw new NotFoundError(
          "Assinatura",
          subscriptionId
        );
      }

      return cancelled;
    });
  },
};