import type { TenantContext } from "../db/withTenantContext.js";
import { withTenantContext } from "../db/withTenantContext.js";

export interface TaxObligation {
  id: string;
  firm_id: string;
  company_id: string;
  obligation_type: string;
  period: string;
  due_date: string;
  original_due_date: string | null;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  integration_source: string | null;
  integration_reference: string | null;
  receipt_number: string | null;
  receipt_url: string | null;
  amount: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateTaxObligationInput {
  company_id: string;
  obligation_type: string;
  period: string;
  due_date: string;
  original_due_date?: string | null;
  status?: string;
  integration_source?: string | null;
  integration_reference?: string | null;
  receipt_number?: string | null;
  receipt_url?: string | null;
  amount?: number | null;
  notes?: string | null;
}

export interface UpdateTaxObligationInput {
  obligation_type?: string;
  period?: string;
  due_date?: string;
  original_due_date?: string | null;
  status?: string;
  completed_at?: string | null;
  completed_by?: string | null;
  integration_source?: string | null;
  integration_reference?: string | null;
  receipt_number?: string | null;
  receipt_url?: string | null;
  amount?: number | null;
  notes?: string | null;
}

export class TaxObligationRepository {
  async create(
    ctx: TenantContext,
    input: CreateTaxObligationInput
  ): Promise<TaxObligation> {
    return withTenantContext(ctx, async (client) => {
      const result = await client.query<TaxObligation>(
        `
        INSERT INTO tax_obligations (
          firm_id,
          company_id,
          obligation_type,
          period,
          due_date,
          original_due_date,
          status,
          integration_source,
          integration_reference,
          receipt_number,
          receipt_url,
          amount,
          notes
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          COALESCE($7, 'em_dia'),
          $8, $9, $10, $11, $12, $13
        )
        RETURNING *
        `,
        [
          ctx.firmId,
          input.company_id,
          input.obligation_type,
          input.period,
          input.due_date,
          input.original_due_date ?? null,
          input.status ?? null,
          input.integration_source ?? null,
          input.integration_reference ?? null,
          input.receipt_number ?? null,
          input.receipt_url ?? null,
          input.amount ?? null,
          input.notes ?? null,
        ]
      );

      return result.rows[0];
    });
  }

  async listByFirm(ctx: TenantContext): Promise<TaxObligation[]> {
    return withTenantContext(ctx, async (client) => {
      const result = await client.query<TaxObligation>(
        `
        SELECT *
        FROM tax_obligations
        WHERE firm_id = $1
          AND deleted_at IS NULL
        ORDER BY due_date ASC, created_at DESC
        `,
        [ctx.firmId]
      );

      return result.rows;
    });
  }

  async listByCompany(
    ctx: TenantContext,
    companyId: string
  ): Promise<TaxObligation[]> {
    return withTenantContext(ctx, async (client) => {
      const result = await client.query<TaxObligation>(
        `
        SELECT *
        FROM tax_obligations
        WHERE firm_id = $1
          AND company_id = $2
          AND deleted_at IS NULL
        ORDER BY due_date ASC, created_at DESC
        `,
        [ctx.firmId, companyId]
      );

      return result.rows;
    });
  }

  async findById(
    ctx: TenantContext,
    id: string
  ): Promise<TaxObligation | null> {
    return withTenantContext(ctx, async (client) => {
      const result = await client.query<TaxObligation>(
        `
        SELECT *
        FROM tax_obligations
        WHERE id = $1
          AND firm_id = $2
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [id, ctx.firmId]
      );

      return result.rows[0] ?? null;
    });
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateTaxObligationInput
  ): Promise<TaxObligation | null> {
    return withTenantContext(ctx, async (client) => {
      const allowedFields: Array<keyof UpdateTaxObligationInput> = [
        "obligation_type",
        "period",
        "due_date",
        "original_due_date",
        "status",
        "completed_at",
        "completed_by",
        "integration_source",
        "integration_reference",
        "receipt_number",
        "receipt_url",
        "amount",
        "notes",
      ];

      const updates: string[] = [];
      const values: unknown[] = [];

      for (const field of allowedFields) {
        if (input[field] !== undefined) {
          values.push(input[field]);
          updates.push(`${field} = $${values.length}`);
        }
      }

      if (updates.length === 0) {
        return this.findById(ctx, id);
      }

      values.push(id);
      const idPosition = values.length;

      values.push(ctx.firmId);
      const firmPosition = values.length;

      const result = await client.query<TaxObligation>(
        `
        UPDATE tax_obligations
        SET ${updates.join(", ")},
            updated_at = NOW()
        WHERE id = $${idPosition}
          AND firm_id = $${firmPosition}
          AND deleted_at IS NULL
        RETURNING *
        `,
        values
      );

      return result.rows[0] ?? null;
    });
  }
}

export const taxObligationRepository = new TaxObligationRepository();