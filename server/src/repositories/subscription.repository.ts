// ============================================================
// Repository: Assinaturas / Cobrança
// ============================================================

import { PoolClient } from "pg";

export interface SubscriptionRow {
  id: string;
  firm_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  payment_provider: string | null;
  payment_provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionCreateRow {
  firmId: string;
  planId: string;
  status?: string;
  currentPeriodStart?: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd?: boolean;
  paymentProvider?: string | null;
  paymentProviderRef?: string | null;
}

export interface SubscriptionUpdateRow {
  planId?: string;
  status?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  paymentProvider?: string | null;
  paymentProviderRef?: string | null;
}

export const subscriptionRepository = {
  async findAll(
    client: PoolClient
  ): Promise<SubscriptionRow[]> {
    const result = await client.query<SubscriptionRow>(
      `
        SELECT *
        FROM subscriptions
        ORDER BY created_at DESC
      `
    );

    return result.rows;
  },

  async findById(
    client: PoolClient,
    subscriptionId: string
  ): Promise<SubscriptionRow | null> {
    const result = await client.query<SubscriptionRow>(
      `
        SELECT *
        FROM subscriptions
        WHERE id = $1
        LIMIT 1
      `,
      [subscriptionId]
    );

    return result.rows[0] ?? null;
  },

  async findCurrentByFirm(
    client: PoolClient,
    firmId: string
  ): Promise<SubscriptionRow | null> {
    const result = await client.query<SubscriptionRow>(
      `
        SELECT *
        FROM subscriptions
        WHERE firm_id = $1
          AND status IN ('trialing', 'active', 'past_due', 'paused')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [firmId]
    );

    return result.rows[0] ?? null;
  },

  async create(
    client: PoolClient,
    data: SubscriptionCreateRow
  ): Promise<SubscriptionRow> {
    const result = await client.query<SubscriptionRow>(
      `
        INSERT INTO subscriptions (
          firm_id,
          plan_id,
          status,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          payment_provider,
          payment_provider_ref
        )
        VALUES (
          $1,
          $2,
          $3,
          COALESCE($4::timestamptz, now()),
          $5,
          $6,
          $7,
          $8
        )
        RETURNING *
      `,
      [
        data.firmId,
        data.planId,
        data.status ?? "trialing",
        data.currentPeriodStart ?? null,
        data.currentPeriodEnd,
        data.cancelAtPeriodEnd ?? false,
        data.paymentProvider ?? null,
        data.paymentProviderRef ?? null,
      ]
    );

    return result.rows[0];
  },

  async update(
    client: PoolClient,
    subscriptionId: string,
    data: SubscriptionUpdateRow
  ): Promise<SubscriptionRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (column: string, value: unknown) => {
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    };

    if (data.planId !== undefined) {
      addField("plan_id", data.planId);
    }

    if (data.status !== undefined) {
      addField("status", data.status);
    }

    if (data.currentPeriodStart !== undefined) {
      addField("current_period_start", data.currentPeriodStart);
    }

    if (data.currentPeriodEnd !== undefined) {
      addField("current_period_end", data.currentPeriodEnd);
    }

    if (data.cancelAtPeriodEnd !== undefined) {
      addField("cancel_at_period_end", data.cancelAtPeriodEnd);
    }

    if (data.cancelledAt !== undefined) {
      addField("cancelled_at", data.cancelledAt);
    }

    if (data.paymentProvider !== undefined) {
      addField("payment_provider", data.paymentProvider);
    }

    if (data.paymentProviderRef !== undefined) {
      addField("payment_provider_ref", data.paymentProviderRef);
    }

    if (fields.length === 0) {
      return this.findById(client, subscriptionId);
    }

    fields.push("updated_at = now()");
    params.push(subscriptionId);

    const result = await client.query<SubscriptionRow>(
      `
        UPDATE subscriptions
        SET ${fields.join(", ")}
        WHERE id = $${params.length}
        RETURNING *
      `,
      params
    );

    return result.rows[0] ?? null;
  },

  async cancel(
    client: PoolClient,
    subscriptionId: string,
    atPeriodEnd = true
  ): Promise<SubscriptionRow | null> {
    const result = await client.query<SubscriptionRow>(
      `
        UPDATE subscriptions
        SET
          cancel_at_period_end = $2,
          cancelled_at = CASE
            WHEN $2 = false THEN now()
            ELSE cancelled_at
          END,
          status = CASE
            WHEN $2 = false THEN 'cancelled'
            ELSE status
          END,
          updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [subscriptionId, atPeriodEnd]
    );

    return result.rows[0] ?? null;
  },
};