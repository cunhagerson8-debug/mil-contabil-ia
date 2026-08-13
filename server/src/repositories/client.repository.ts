// =============================================================================
// Repository: Clients
// =============================================================================
import { PoolClient } from "pg";
import { ClientRow, ClientContactRow, ClientDocumentRow, ClientHistoryRow, TipoClienteDb, StatusClienteDb } from "../types/db.js";

export interface ClientFilters {
  status?: StatusClienteDb;
  search?: string;
}

export interface ClientCreateRow {
  firmId: string;
  companyId?: string;
  nome: string;
  tipo: TipoClienteDb;
  documento: string;
  servicosContratados?: string[];
}

export interface ClientUpdateRow {
  companyId?: string;
  nome?: string;
  tipo?: TipoClienteDb;
  documento?: string;
  status?: StatusClienteDb;
  servicosContratados?: string[];
}

export const clientRepository = {
  async findAll(client: PoolClient, filters: ClientFilters = {}): Promise<ClientRow[]> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(nome ILIKE $${params.length} OR documento ILIKE $${params.length})`);
    }

    const sql = `SELECT * FROM clients WHERE ${conditions.join(" AND ")} ORDER BY nome ASC`;
    const result = await client.query<ClientRow>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<ClientRow | null> {
    const result = await client.query<ClientRow>(
      `SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    return result.rows[0] ?? null;
  },

  async findByDocumento(client: PoolClient, firmId: string, documento: string): Promise<ClientRow | null> {
    const result = await client.query<ClientRow>(
      `SELECT * FROM clients WHERE firm_id = $1 AND documento = $2 AND deleted_at IS NULL`,
      [firmId, documento]
    );
    return result.rows[0] ?? null;
  },

  async create(client: PoolClient, data: ClientCreateRow): Promise<ClientRow> {
    const result = await client.query<ClientRow>(
      `INSERT INTO clients (firm_id, company_id, nome, tipo, documento, status, servicos_contratados)
       VALUES ($1,$2,$3,$4,$5,'prospecto',$6)
       RETURNING *`,
      [data.firmId, data.companyId ?? null, data.nome, data.tipo, data.documento, data.servicosContratados ?? []]
    );
    return result.rows[0];
  },

  async update(client: PoolClient, id: string, data: ClientUpdateRow): Promise<ClientRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    const fieldMap: Record<string, unknown> = {
      company_id: data.companyId,
      nome: data.nome,
      tipo: data.tipo,
      documento: data.documento,
      status: data.status,
      servicos_contratados: data.servicosContratados,
    };
    for (const [column, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      }
    }
    if (fields.length === 0) return this.findById(client, id);

    params.push(id);
    const sql = `UPDATE clients SET ${fields.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`;
    const result = await client.query<ClientRow>(sql, params);
    return result.rows[0] ?? null;
  },

  async softDelete(client: PoolClient, id: string): Promise<boolean> {
    const result = await client.query(
      `UPDATE clients SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async findContacts(client: PoolClient, clientId: string): Promise<ClientContactRow[]> {
    const result = await client.query<ClientContactRow>(
      `SELECT * FROM client_contacts WHERE client_id = $1 ORDER BY principal DESC, nome ASC`, [clientId]
    );
    return result.rows;
  },

  async findDocuments(client: PoolClient, clientId: string): Promise<ClientDocumentRow[]> {
    const result = await client.query<ClientDocumentRow>(
      `SELECT * FROM client_documents WHERE client_id = $1 ORDER BY data_upload DESC`, [clientId]
    );
    return result.rows;
  },

  async findHistory(client: PoolClient, clientId: string): Promise<ClientHistoryRow[]> {
    const result = await client.query<ClientHistoryRow>(
      `SELECT h.*, u.full_name AS responsavel_nome
       FROM client_history_entries h
       LEFT JOIN users u ON u.id = h.responsavel_id
       WHERE h.client_id = $1
       ORDER BY h.data DESC`,
      [clientId]
    );
    return result.rows;
  },
};
