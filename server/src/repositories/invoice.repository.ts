import { PoolClient } from "pg";

export interface InvoiceRow {
  id: string;
  firm_id: string;
  company_id: string;
  numero: string;
  tipo: string;
  status: string;
  data_emissao: string;
  tomador: string;
  tomador_doc: string;
  valor_total: string;
  iss: string | null;
  pis: string | null;
  cofins: string | null;
  csll: string | null;
  irrf: string | null;
  chave_acesso: string | null;
  motivo_cancelamento: string | null;
  issued_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  descricao: string;
  quantidade: string;
  valor_unitario: string;
  valor_total: string;
  ordem: number;
}

export interface InvoiceFilters {
  companyId?: string;
  status?: string;
  search?: string;
}

export interface InvoiceCreateRow {
  firmId: string;
  companyId: string;
  numero: string;
  tipo: string;
  dataEmissao: string;
  tomador: string;
  tomadorDoc: string;
  valorTotal: number;
  iss?: number;
  pis?: number;
  cofins?: number;
  csll?: number;
  irrf?: number;
  issuedBy?: string;
}

export interface InvoiceItemCreateRow {
  invoiceId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ordem: number;
}

export const invoiceRepository = {
  async findAll(client: PoolClient, filters: InvoiceFilters = {}): Promise<InvoiceRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`company_id = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(tomador ILIKE $${params.length} OR numero ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM invoices ${where} ORDER BY data_emissao DESC, created_at DESC`;
    const result = await client.query<InvoiceRow>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<InvoiceRow | null> {
    const result = await client.query<InvoiceRow>(`SELECT * FROM invoices WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  },

  async findItems(client: PoolClient, invoiceId: string): Promise<InvoiceItemRow[]> {
    const result = await client.query<InvoiceItemRow>(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY ordem`,
      [invoiceId]
    );
    return result.rows;
  },

  async create(client: PoolClient, data: InvoiceCreateRow): Promise<InvoiceRow> {
    const sql = `
      INSERT INTO invoices (firm_id, company_id, numero, tipo, data_emissao, tomador, tomador_doc, valor_total, iss, pis, cofins, csll, irrf, issued_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `;
    const result = await client.query<InvoiceRow>(sql, [
      data.firmId, data.companyId, data.numero, data.tipo, data.dataEmissao,
      data.tomador, data.tomadorDoc, data.valorTotal,
      data.iss ?? null, data.pis ?? null, data.cofins ?? null, data.csll ?? null, data.irrf ?? null,
      data.issuedBy ?? null,
    ]);
    return result.rows[0];
  },

  async createItem(client: PoolClient, data: InvoiceItemCreateRow): Promise<InvoiceItemRow> {
    const sql = `
      INSERT INTO invoice_items (invoice_id, descricao, quantidade, valor_unitario, valor_total, ordem)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `;
    const result = await client.query<InvoiceItemRow>(sql, [
      data.invoiceId, data.descricao, data.quantidade, data.valorUnitario, data.valorTotal, data.ordem,
    ]);
    return result.rows[0];
  },

  async updateStatus(client: PoolClient, id: string, status: string, motivoCancelamento?: string): Promise<InvoiceRow | null> {
    const sql = motivoCancelamento
      ? `UPDATE invoices SET status = $1, motivo_cancelamento = $2 WHERE id = $3 RETURNING *`
      : `UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *`;
    const params = motivoCancelamento ? [status, motivoCancelamento, id] : [status, id];
    const result = await client.query<InvoiceRow>(sql, params);
    return result.rows[0] ?? null;
  },
};
