// =============================================================================
// Repository: Tax Obligations
// =============================================================================
import { PoolClient } from "pg";
import {
  TaxObligationRow, ObligationTypeDb, ObligationStatusDb,
  ObligationPeriodicityDb, ObligationIntegrationSourceDb,
} from "../types/db.js";

export interface TaxObligationFilters {
  companyId?: string;
  status?: ObligationStatusDb;
}

export interface TaxObligationCreateRow {
  firmId: string;
  companyId: string;
  nome: string;
  type: ObligationTypeDb;
  competencia: string;
  vencimento: string;
  valor?: number;
  observacoes?: string;
  periodicidade: ObligationPeriodicityDb;
  integrationSource?: ObligationIntegrationSourceDb;
}

export interface TaxObligationUpdateRow {
  nome?: string;
  type?: ObligationTypeDb;
  competencia?: string;
  vencimento?: string;
  status?: ObligationStatusDb;
  valor?: number;
  observacoes?: string;
  periodicidade?: ObligationPeriodicityDb;
  paidAt?: string | null;
}

export const taxObligationRepository = {
  async findAll(client: PoolClient, filters: TaxObligationFilters = {}): Promise<TaxObligationRow[]> {
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`company_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    const sql = `SELECT * FROM tax_obligations WHERE ${conditions.join(" AND ")} ORDER BY vencimento ASC`;
    const result = await client.query<TaxObligationRow>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<TaxObligationRow | null> {
    const result = await client.query<TaxObligationRow>(
      `SELECT * FROM tax_obligations WHERE id = $1`, [id]
    );
    return result.rows[0] ?? null;
  },

  async create(client: PoolClient, data: TaxObligationCreateRow): Promise<TaxObligationRow> {
    const result = await client.query<TaxObligationRow>(
      `INSERT INTO tax_obligations (
         firm_id, company_id, nome, type, competencia, vencimento, status,
         valor, observacoes, periodicidade, integration_source
       ) VALUES ($1,$2,$3,$4,$5,$6,'em_dia',$7,$8,$9,$10)
       RETURNING *`,
      [
        data.firmId, data.companyId, data.nome, data.type, data.competencia,
        data.vencimento, data.valor ?? null, data.observacoes ?? null,
        data.periodicidade, data.integrationSource ?? "manual",
      ]
    );
    return result.rows[0];
  },

  async update(client: PoolClient, id: string, data: TaxObligationUpdateRow): Promise<TaxObligationRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    const fieldMap: Record<string, unknown> = {
      nome: data.nome,
      type: data.type,
      competencia: data.competencia,
      vencimento: data.vencimento,
      status: data.status,
      valor: data.valor,
      observacoes: data.observacoes,
      periodicidade: data.periodicidade,
      paid_at: data.paidAt,
    };
    for (const [column, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      }
    }
    if (fields.length === 0) return this.findById(client, id);

    params.push(id);
    const sql = `UPDATE tax_obligations SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`;
    const result = await client.query<TaxObligationRow>(sql, params);
    return result.rows[0] ?? null;
  },

  /**
   * Hard delete — diferente de companies/clients, obrigações fiscais não têm
   * deleted_at (ver 005_tax_obligations.sql). Uma obrigação só deve ser
   * removida se foi criada por erro de lançamento; o histórico fiscal real
   * é preservado via audit_logs, não via soft delete na própria linha.
   */
  async hardDelete(client: PoolClient, id: string): Promise<boolean> {
    const result = await client.query(`DELETE FROM tax_obligations WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async markPaid(client: PoolClient, id: string): Promise<TaxObligationRow | null> {
    const result = await client.query<TaxObligationRow>(
      `UPDATE tax_obligations SET status = 'em_dia', paid_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ?? null;
  },
};
