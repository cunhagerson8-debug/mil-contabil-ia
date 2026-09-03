import type { PoolClient } from "pg";

export interface AiCompanyRow {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  regime: string;
  status: string;
}

export interface AiObligationRow {
  company_id: string;
  company_name: string;
  nome: string | null;
  obligation_type: string | null;
  period: string | null;
  due_date: string;
  status: string;
  amount: string | null;
  completed_at: string | null;
  paid_at: string | null;
}

const MAX_COMPANY_ROWS = 100;
const MAX_OBLIGATION_ROWS = 1000;

export const aiContextRepository = {
  async countCompanies(client: PoolClient): Promise<number> {
    const result = await client.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
      FROM companies
      WHERE deleted_at IS NULL
    `);
    return Number(result.rows[0]?.count ?? 0);
  },

  async findCompanies(client: PoolClient, search?: string): Promise<AiCompanyRow[]> {
    const params: string[] = [];
    const conditions = ["deleted_at IS NULL"];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(razao_social ILIKE $1 OR nome_fantasia ILIKE $1 OR cnpj ILIKE $1)`);
    }
    params.push(String(MAX_COMPANY_ROWS));
    const result = await client.query<AiCompanyRow>(`
      SELECT id, razao_social, nome_fantasia, cnpj, regime::text, status::text
      FROM companies
      WHERE ${conditions.join(" AND ")}
      ORDER BY nome_fantasia ASC
      LIMIT $${params.length}
    `, params);
    return result.rows;
  },

  async findObligations(client: PoolClient, companyId?: string): Promise<AiObligationRow[]> {
    const params: string[] = [];
    const conditions = [
      "o.deleted_at IS NULL",
      "c.deleted_at IS NULL",
      "o.firm_id = c.firm_id",
    ];
    if (companyId) {
      params.push(companyId);
      conditions.push(`o.company_id = $1`);
    }
    params.push(String(MAX_OBLIGATION_ROWS));
    const result = await client.query<AiObligationRow>(`
      SELECT
        o.company_id,
        c.nome_fantasia AS company_name,
        COALESCE(o.nome, o.obligation_type) AS nome,
        COALESCE(o.type::text, o.obligation_type) AS obligation_type,
        COALESCE(o.competencia, o.period) AS period,
        COALESCE(o.due_date, o.vencimento)::text AS due_date,
        o.status::text AS status,
        COALESCE(o.valor, o.amount)::text AS amount,
        o.completed_at::text,
        o.paid_at::text
      FROM tax_obligations o
      INNER JOIN companies c ON c.id = o.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(o.due_date, o.vencimento) ASC
      LIMIT $${params.length}
    `, params);
    return result.rows;
  },
};

export const AI_CONTEXT_LIMITS = {
  companies: 50,
  obligations: MAX_OBLIGATION_ROWS,
  relevantObligations: 100,
};