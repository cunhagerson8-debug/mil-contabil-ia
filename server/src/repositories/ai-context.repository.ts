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

export interface AiPlatformSummaryRow {
  total_firms: string;
  total_companies: string;
  active_companies: string;
  companies_on_time: string;
  companies_with_overdue: string;
  companies_with_upcoming: string;
  overdue_obligations: string;
  upcoming_obligations: string;
  on_time_obligations: string;
}

export interface AiPlatformObligationRow {
  company_name: string;
  nome: string | null;
  obligation_type: string | null;
  period: string | null;
  due_date: string;
  classification: string;
  amount: string | null;
}

const MAX_COMPANY_ROWS = 100;
const MAX_OBLIGATION_ROWS = 1000;

export const aiContextRepository = {
  async assertPlatformAdmin(client: PoolClient, userId: string): Promise<boolean> {
    const result = await client.query<{ allowed: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM users
        WHERE id = $1
          AND role::text = 'platform_admin'
          AND firm_id IS NULL
          AND deleted_at IS NULL
      ) AS allowed
    `, [userId]);
    return result.rows[0]?.allowed === true;
  },

  async getPlatformSummary(client: PoolClient): Promise<AiPlatformSummaryRow> {
    const result = await client.query<AiPlatformSummaryRow>(`
      WITH classified AS (
        SELECT o.company_id,
          CASE
            WHEN o.status::text = 'nao_aplicavel' THEN 'nao_aplicavel'
            WHEN o.completed_at IS NOT NULL OR o.paid_at IS NOT NULL THEN 'em_dia'
            WHEN COALESCE(o.due_date, o.vencimento) < CURRENT_DATE THEN 'vencida'
            WHEN COALESCE(o.due_date, o.vencimento) <= CURRENT_DATE + INTERVAL '15 days' THEN 'proxima'
            ELSE 'em_dia'
          END AS classification
        FROM tax_obligations o
        INNER JOIN companies c ON c.id = o.company_id AND c.firm_id = o.firm_id
        WHERE o.deleted_at IS NULL AND c.deleted_at IS NULL
      )
      SELECT
        (SELECT COUNT(*)::text FROM firms WHERE deleted_at IS NULL) AS total_firms,
        (SELECT COUNT(*)::text FROM companies WHERE deleted_at IS NULL) AS total_companies,
        (SELECT COUNT(*)::text FROM companies WHERE deleted_at IS NULL AND status::text = 'ativa') AS active_companies,
        (SELECT COUNT(*)::text FROM companies c
         WHERE c.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM classified x
             WHERE x.company_id = c.id
               AND x.classification IN ('vencida', 'proxima')
           )) AS companies_on_time,
        COUNT(DISTINCT company_id) FILTER (WHERE classification = 'vencida')::text AS companies_with_overdue,
        COUNT(DISTINCT company_id) FILTER (WHERE classification = 'proxima')::text AS companies_with_upcoming,
        COUNT(*) FILTER (WHERE classification = 'vencida')::text AS overdue_obligations,
        COUNT(*) FILTER (WHERE classification = 'proxima')::text AS upcoming_obligations,
        COUNT(*) FILTER (WHERE classification = 'em_dia')::text AS on_time_obligations
      FROM classified
    `);
    return result.rows[0];
  },

  async findRelevantPlatformObligations(client: PoolClient, limit: number): Promise<AiPlatformObligationRow[]> {
    const result = await client.query<AiPlatformObligationRow>(`
      SELECT
        c.nome_fantasia AS company_name,
        COALESCE(o.nome, o.obligation_type) AS nome,
        COALESCE(o.type::text, o.obligation_type) AS obligation_type,
        COALESCE(o.competencia, o.period) AS period,
        COALESCE(o.due_date, o.vencimento)::text AS due_date,
        CASE
          WHEN o.status::text = 'nao_aplicavel' THEN 'nao_aplicavel'
          WHEN o.completed_at IS NOT NULL OR o.paid_at IS NOT NULL THEN 'em_dia'
          WHEN COALESCE(o.due_date, o.vencimento) < CURRENT_DATE THEN 'vencida'
          WHEN COALESCE(o.due_date, o.vencimento) <= CURRENT_DATE + INTERVAL '15 days' THEN 'proxima'
          ELSE 'em_dia'
        END AS classification,
        COALESCE(o.valor, o.amount)::text AS amount
      FROM tax_obligations o
      INNER JOIN companies c ON c.id = o.company_id AND c.firm_id = o.firm_id
      WHERE o.deleted_at IS NULL AND c.deleted_at IS NULL
        AND o.status::text <> 'nao_aplicavel'
        AND o.completed_at IS NULL AND o.paid_at IS NULL
        AND COALESCE(o.due_date, o.vencimento) <= CURRENT_DATE + INTERVAL '15 days'
      ORDER BY COALESCE(o.due_date, o.vencimento) ASC
      LIMIT $1
    `, [limit]);
    return result.rows;
  },

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
  platformObligations: 25,
};