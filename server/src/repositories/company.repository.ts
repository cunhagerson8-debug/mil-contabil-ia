// =============================================================================
// Repository: Companies
// -----------------------------------------------------------------------------
// Regra do projeto: repositories SÓ fazem SQL. Nenhuma decisão de negócio
// (validação, regra de permissão alem do que RLS já impõe, geração de
// alerta etc.) pertence aqui — isso é responsabilidade da service layer.
// Todo método recebe um PoolClient já dentro do contexto de tenant (ver
// db/withTenantContext.ts) — nunca importamos `pool` aqui.
// =============================================================================
import { PoolClient } from "pg";
import { CompanyRowWithContador, CompanyPartnerRow, RegimeTributarioDb, StatusEmpresaDb } from "../types/db.js";

export interface CompanyFilters {
  status?: StatusEmpresaDb;
  search?: string; // aplica contra nome_fantasia, razao_social, cnpj (trigram)
}

export interface CompanyCreateRow {
  firmId: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnae: string;
  cnaeDescricao?: string;
  regime: RegimeTributarioDb;
  responsavel: string;
  contadorResponsavelId?: string;
  dataAbertura: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

export interface CompanyUpdateRow {
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  cnae?: string;
  cnaeDescricao?: string;
  regime?: RegimeTributarioDb;
  responsavel?: string;
  contadorResponsavelId?: string;
  status?: StatusEmpresaDb;
  dataAbertura?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

const SELECT_WITH_CONTADOR = `
  SELECT c.*, u.full_name AS contador_responsavel_nome
  FROM companies c
  LEFT JOIN users u ON u.id = c.contador_responsavel_id
`;

export const companyRepository = {
  async findAll(client: PoolClient, filters: CompanyFilters = {}): Promise<CompanyRowWithContador[]> {
    const conditions: string[] = ["c.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(`(c.nome_fantasia ILIKE $${params.length} OR c.razao_social ILIKE $${params.length} OR c.cnpj ILIKE $${params.length})`);
    }

    const sql = `${SELECT_WITH_CONTADOR} WHERE ${conditions.join(" AND ")} ORDER BY c.nome_fantasia ASC`;
    const result = await client.query<CompanyRowWithContador>(sql, params);
    return result.rows;
  },

  async findById(client: PoolClient, id: string): Promise<CompanyRowWithContador | null> {
    const sql = `${SELECT_WITH_CONTADOR} WHERE c.id = $1 AND c.deleted_at IS NULL`;
    const result = await client.query<CompanyRowWithContador>(sql, [id]);
    return result.rows[0] ?? null;
  },

  async findByCnpj(client: PoolClient, firmId: string, cnpj: string): Promise<CompanyRowWithContador | null> {
    const sql = `${SELECT_WITH_CONTADOR} WHERE c.firm_id = $1 AND c.cnpj = $2 AND c.deleted_at IS NULL`;
    const result = await client.query<CompanyRowWithContador>(sql, [firmId, cnpj]);
    return result.rows[0] ?? null;
  },

  async create(client: PoolClient, data: CompanyCreateRow): Promise<CompanyRowWithContador> {
    const sql = `
      INSERT INTO companies (
        firm_id, razao_social, nome_fantasia, cnpj, cnae, cnae_descricao,
        regime, responsavel, contador_responsavel_id, status, data_abertura,
        email, telefone, endereco
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ativa',$10,$11,$12,$13)
      RETURNING id
    `;
    const result = await client.query<{ id: string }>(sql, [
      data.firmId, data.razaoSocial, data.nomeFantasia, data.cnpj, data.cnae,
      data.cnaeDescricao ?? null, data.regime, data.responsavel,
      data.contadorResponsavelId ?? null, data.dataAbertura,
      data.email ?? null, data.telefone ?? null, data.endereco ?? null,
    ]);
    const created = await this.findById(client, result.rows[0].id);
    if (!created) throw new Error("Falha ao recarregar empresa recém-criada.");
    return created;
  },

  async update(client: PoolClient, id: string, data: CompanyUpdateRow): Promise<CompanyRowWithContador | null> {
    const fields: string[] = [];
    const params: unknown[] = [];

    const fieldMap: Record<string, unknown> = {
      razao_social: data.razaoSocial,
      nome_fantasia: data.nomeFantasia,
      cnpj: data.cnpj,
      cnae: data.cnae,
      cnae_descricao: data.cnaeDescricao,
      regime: data.regime,
      responsavel: data.responsavel,
      contador_responsavel_id: data.contadorResponsavelId,
      status: data.status,
      data_abertura: data.dataAbertura,
      email: data.email,
      telefone: data.telefone,
      endereco: data.endereco,
    };

    for (const [column, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      }
    }

    if (fields.length === 0) {
      return this.findById(client, id);
    }

    params.push(id);
    const sql = `UPDATE companies SET ${fields.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING id`;
    const result = await client.query<{ id: string }>(sql, params);
    if (result.rows.length === 0) return null;
    return this.findById(client, id);
  },

  /** Soft delete — preserva histórico de auditoria e billing (ver database/README.md). */
  async softDelete(client: PoolClient, id: string): Promise<boolean> {
    const result = await client.query(
      `UPDATE companies SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async findPartners(client: PoolClient, companyId: string): Promise<CompanyPartnerRow[]> {
    const result = await client.query<CompanyPartnerRow>(
      `SELECT * FROM company_partners WHERE company_id = $1 ORDER BY participacao DESC`,
      [companyId]
    );
    return result.rows;
  },

  /** Retorna a data de validade do certificado A1 mais recente (não revogado), se existir. */
  async findActiveCertificateValidUntil(client: PoolClient, companyId: string): Promise<string | null> {
    const result = await client.query<{ valid_until: string }>(
      `SELECT valid_until FROM digital_certificates
       WHERE company_id = $1 AND revoked_at IS NULL
       ORDER BY valid_until DESC LIMIT 1`,
      [companyId]
    );
    return result.rows[0]?.valid_until ?? null;
  },
};
