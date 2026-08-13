import { PoolClient } from "pg";

export interface AlertRow {
  id: string;
  firm_id: string;
  company_id: string | null;
  title: string;
  description: string;
  severity: string;
  category: string;
  due_date: string | null;
  read: boolean;
  read_at: string | null;
  read_by: string | null;
  action_label: string | null;
  action_target: string | null;
  source_module: string;
  source_obligation_id: string | null;
  source_invoice_id: string | null;
  source_certificate_id: string | null;
  created_at: string;
}

export interface AlertFilters {
  companyId?: string;
  severity?: string;
  category?: string;
  read?: boolean;
}

export const alertRepository = {
  async findAll(client: PoolClient, filters: AlertFilters = {}): Promise<AlertRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`company_id = $${params.length}`);
    }
    if (filters.severity) {
      params.push(filters.severity);
      conditions.push(`severity = $${params.length}`);
    }
    if (filters.category) {
      params.push(filters.category);
      conditions.push(`category = $${params.length}`);
    }
    if (filters.read !== undefined) {
      params.push(filters.read);
      conditions.push(`read = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM alerts ${where} ORDER BY created_at DESC`;
    const result = await client.query<AlertRow>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<AlertRow | null> {
    const result = await client.query<AlertRow>(`SELECT * FROM alerts WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  },

  async markRead(client: PoolClient, id: string, userId: string): Promise<AlertRow | null> {
    const result = await client.query<AlertRow>(
      `UPDATE alerts SET read = true, read_at = now(), read_by = $1 WHERE id = $2 RETURNING *`,
      [userId, id]
    );
    return result.rows[0] ?? null;
  },

  async markAllRead(client: PoolClient, firmId: string, userId: string): Promise<number> {
    const result = await client.query(
      `UPDATE alerts SET read = true, read_at = now(), read_by = $1 WHERE firm_id = $2 AND read = false`,
      [userId, firmId]
    );
    return result.rowCount ?? 0;
  },
};
