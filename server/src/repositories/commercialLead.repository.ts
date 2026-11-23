import type { PoolClient } from "pg";
import type { CommercialLeadRow, CommercialLeadStatusDb } from "../types/db.js";
import type { CommercialLeadListQuery } from "../validators/commercialLead.validators.js";
import { withPublicLeadContext } from "../db/withTenantContext.js";

export interface PublicCommercialLeadRowInput {
  name: string;
  whatsappE164: string;
  email: string | null;
  serviceInterest: string;
  voluntaryDetails: string | null;
  consentVersion: string;
}

export const commercialLeadRepository = {
  async insertIfNew(input: PublicCommercialLeadRowInput): Promise<void> {
    await withPublicLeadContext(async (client) => {
      await client.query(
        `INSERT INTO commercial_leads (
           name, whatsapp_e164, email, service_interest, voluntary_details,
           consented_at, consent_version, source
         )
         VALUES ($1, $2, $3, $4, $5, now(), $6, 'mila')
         ON CONFLICT (whatsapp_e164) DO NOTHING`,
        [
          input.name,
          input.whatsappE164,
          input.email,
          input.serviceInterest,
          input.voluntaryDetails,
          input.consentVersion,
        ],
      );
    });
  },

  async list(
    client: PoolClient,
    query: CommercialLeadListQuery,
  ): Promise<{ rows: CommercialLeadRow[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search.replace(/[\\%_]/g, "\\$&")}%`);
      conditions.push(
        `(name ILIKE $${params.length} ESCAPE '\\' OR whatsapp_e164 ILIKE $${params.length} ESCAPE '\\' OR email ILIKE $${params.length} ESCAPE '\\')`,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const pageParams = [...params, query.limit, (query.page - 1) * query.limit];
    const [listResult, countResult] = await Promise.all([
      client.query<CommercialLeadRow>(
        `SELECT * FROM commercial_leads ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        pageParams,
      ),
      client.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM commercial_leads ${where}`,
        params,
      ),
    ]);

    return {
      rows: listResult.rows,
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  },

  async updateStatus(
    client: PoolClient,
    id: string,
    status: CommercialLeadStatusDb,
    userId: string,
  ): Promise<CommercialLeadRow | null> {
    const result = await client.query<CommercialLeadRow>(
      `UPDATE commercial_leads
       SET status = $2,
           updated_by = $3,
           updated_at = now(),
           last_contacted_at = CASE
             WHEN $2 IN ('contacting', 'qualified') THEN now()
             ELSE last_contacted_at
           END
       WHERE id = $1
       RETURNING *`,
      [id, status, userId],
    );
    return result.rows[0] ?? null;
  },
};
