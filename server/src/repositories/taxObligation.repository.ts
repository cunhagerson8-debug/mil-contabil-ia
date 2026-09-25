// =============================================================================
// Repository: Tax Obligations
// =============================================================================
import { PoolClient } from "pg";
import { TaxObligationRow, ObligationTypeDb, ObligationStatusDb, ObligationPeriodicityDb, ObligationIntegrationSourceDb } from "../types/db.js";

export interface TaxObligationFilters { companyId?: string; status?: ObligationStatusDb; }
export interface TaxObligationCreateRow {
  firmId: string; companyId: string; nome: string; type: ObligationTypeDb;
  competencia: string; vencimento: string; valor?: number; observacoes?: string;
  periodicidade: ObligationPeriodicityDb; integrationSource?: ObligationIntegrationSourceDb;
}
export interface TaxObligationUpdateRow {
  nome?: string; type?: ObligationTypeDb; competencia?: string; vencimento?: string;
  status?: ObligationStatusDb; valor?: number; observacoes?: string;
  periodicidade?: ObligationPeriodicityDb; paidAt?: string | null;
}

export const taxObligationRepository = {
  async findCompanyFirm(client: PoolClient, companyId: string): Promise<{ id: string; firm_id: string } | null> {
    const result = await client.query<{ id: string; firm_id: string }>(
      `SELECT id, firm_id FROM companies WHERE id = $1 AND deleted_at IS NULL`, [companyId]
    );
    return result.rows[0] ?? null;
  },

  async findAll(client: PoolClient, filters: TaxObligationFilters = {}): Promise<TaxObligationRow[]> {
    const conditions: string[] = ["o.deleted_at IS NULL", "c.deleted_at IS NULL"];
    const params: unknown[] = [];
    if (filters.companyId) { params.push(filters.companyId); conditions.push(`o.company_id = $${params.length}`); }
    if (filters.status) { params.push(filters.status); conditions.push(`o.status = $${params.length}`); }
    const result = await client.query<TaxObligationRow>(
      `SELECT o.* FROM tax_obligations o INNER JOIN companies c ON c.id = o.company_id AND c.firm_id = o.firm_id WHERE ${conditions.join(" AND ")} ORDER BY o.vencimento ASC`, params
    );
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<TaxObligationRow | null> {
    const result = await client.query<TaxObligationRow>(
      `SELECT o.* FROM tax_obligations o INNER JOIN companies c ON c.id = o.company_id AND c.firm_id = o.firm_id WHERE o.id = $1 AND o.deleted_at IS NULL AND c.deleted_at IS NULL`, [id]
    );
    return result.rows[0] ?? null;
  },

  async create(client: PoolClient, data: TaxObligationCreateRow): Promise<TaxObligationRow> {
    // Status é calculado a partir do vencimento no próprio INSERT: uma obrigação
    // cadastrada com data de vencimento já passada nasce "vencida" (não "em_dia"),
    // sem depender do job diário de recálculo para corrigir isso depois.
    const result = await client.query<TaxObligationRow>(
      `INSERT INTO tax_obligations (firm_id, company_id, nome, type, competencia, vencimento, status, valor, observacoes, periodicidade, integration_source)
       VALUES (
         $1,$2,$3,$4,$5,$6,
         CASE
           WHEN $6::date < CURRENT_DATE THEN 'vencida'
           WHEN $6::date <= CURRENT_DATE + INTERVAL '15 days' THEN 'proxima_vencimento'
           ELSE 'em_dia'
         END,
         $7,$8,$9,$10
       ) RETURNING *`,
      [data.firmId, data.companyId, data.nome, data.type, data.competencia, data.vencimento, data.valor ?? null, data.observacoes ?? null, data.periodicidade, data.integrationSource ?? "manual"]
    );
    return result.rows[0];
  },

  async update(client: PoolClient, id: string, data: TaxObligationUpdateRow): Promise<TaxObligationRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    const fieldMap: Record<string, unknown> = { nome: data.nome, type: data.type, competencia: data.competencia, vencimento: data.vencimento, status: data.status, valor: data.valor, observacoes: data.observacoes, periodicidade: data.periodicidade, paid_at: data.paidAt };

    // Se a data de vencimento mudar e nenhum status explícito for informado,
    // recalcula o status a partir do novo vencimento (mesma regra do INSERT),
    // em vez de manter o status anterior desatualizado.
    const autoRecalculateStatus = data.vencimento !== undefined && data.status === undefined;

    for (const [column, value] of Object.entries(fieldMap)) {
      if (column === "status" && autoRecalculateStatus) continue;
      if (value !== undefined) { params.push(value); fields.push(`${column} = $${params.length}`); }
    }

    if (autoRecalculateStatus) {
      params.push(data.vencimento);
      const vencimentoParam = params.length;
      fields.push(
        `status = CASE
           WHEN paid_at IS NOT NULL THEN 'em_dia'
           WHEN $${vencimentoParam}::date < CURRENT_DATE THEN 'vencida'
           WHEN $${vencimentoParam}::date <= CURRENT_DATE + INTERVAL '15 days' THEN 'proxima_vencimento'
           ELSE 'em_dia'
         END`
      );
    }

    if (fields.length === 0) return this.findById(client, id);
    params.push(id);
    const result = await client.query<TaxObligationRow>(`UPDATE tax_obligations SET ${fields.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`, params);
    return result.rows[0] ?? null;
  },

  async hardDelete(client: PoolClient, id: string): Promise<boolean> {
    const result = await client.query(`DELETE FROM tax_obligations WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async markPaid(client: PoolClient, id: string): Promise<TaxObligationRow | null> {
    const result = await client.query<TaxObligationRow>(`UPDATE tax_obligations SET status = 'em_dia', paid_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *`, [id]);
    return result.rows[0] ?? null;
  },
};