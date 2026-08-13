import { PoolClient } from "pg";

export interface PortalDocumentRow {
  id: string;
  client_id: string;
  nome: string;
  categoria: string;
  storage_key: string;
  tamanho_bytes: string | null;
  data_disponibilizacao: string;
  validade: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PortalGuideRow {
  id: string;
  client_id: string;
  tax_obligation_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: string;
  valor: string;
  vencimento: string;
  codigo_barras: string | null;
  pago: boolean;
  paid_at: string | null;
  data_disponibilizacao: string;
  created_at: string;
  updated_at: string;
}

export interface PortalMessageRow {
  id: string;
  client_id: string;
  assunto: string;
  corpo: string;
  remetente: string;
  sender_user_id: string | null;
  status: string;
  resposta_id: string | null;
  data: string;
  created_at: string;
}

export const portalRepository = {
  // Documents
  async findDocuments(client: PoolClient, clientId: string): Promise<PortalDocumentRow[]> {
    const result = await client.query<PortalDocumentRow>(
      `SELECT * FROM portal_documents WHERE client_id = $1 ORDER BY data_disponibilizacao DESC`,
      [clientId]
    );
    return result.rows;
  },

  async createDocument(client: PoolClient, data: { clientId: string; nome: string; categoria: string; storageKey: string; tamBytes?: number; uploadedBy?: string }): Promise<PortalDocumentRow> {
    const result = await client.query<PortalDocumentRow>(
      `INSERT INTO portal_documents (client_id, nome, categoria, storage_key, tamanho_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.clientId, data.nome, data.categoria, data.storageKey, data.tamBytes ?? null, data.uploadedBy ?? null]
    );
    return result.rows[0];
  },

  // Guides
  async findGuides(client: PoolClient, clientId: string): Promise<PortalGuideRow[]> {
    const result = await client.query<PortalGuideRow>(
      `SELECT * FROM portal_guides WHERE client_id = $1 ORDER BY vencimento DESC`,
      [clientId]
    );
    return result.rows;
  },

  async createGuide(client: PoolClient, data: { clientId: string; titulo: string; descricao?: string; tipo: string; valor: number; vencimento: string; codigoBarras?: string; taxObligationId?: string }): Promise<PortalGuideRow> {
    const result = await client.query<PortalGuideRow>(
      `INSERT INTO portal_guides (client_id, tax_obligation_id, titulo, descricao, tipo, valor, vencimento, codigo_barras)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.clientId, data.taxObligationId ?? null, data.titulo, data.descricao ?? null, data.tipo, data.valor, data.vencimento, data.codigoBarras ?? null]
    );
    return result.rows[0];
  },

  async markGuidePaid(client: PoolClient, id: string): Promise<PortalGuideRow | null> {
    const result = await client.query<PortalGuideRow>(
      `UPDATE portal_guides SET pago = true, paid_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  // Messages
  async findMessages(client: PoolClient, clientId: string): Promise<PortalMessageRow[]> {
    const result = await client.query<PortalMessageRow>(
      `SELECT * FROM portal_messages WHERE client_id = $1 ORDER BY data DESC`,
      [clientId]
    );
    return result.rows;
  },

  async createMessage(client: PoolClient, data: { clientId: string; assunto: string; corpo: string; remetente: string; senderUserId?: string; respostaId?: string }): Promise<PortalMessageRow> {
    const result = await client.query<PortalMessageRow>(
      `INSERT INTO portal_messages (client_id, assunto, corpo, remetente, sender_user_id, resposta_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [data.clientId, data.assunto, data.corpo, data.remetente, data.senderUserId ?? null, data.respostaId ?? null]
    );
    return result.rows[0];
  },

  async updateMessageStatus(client: PoolClient, id: string, status: string): Promise<PortalMessageRow | null> {
    const result = await client.query<PortalMessageRow>(
      `UPDATE portal_messages SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0] ?? null;
  },
};
