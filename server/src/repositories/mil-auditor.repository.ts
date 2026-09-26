import type { PoolClient } from "pg";

export interface MilAuditorCompanyRow {
  id: string;
  nome_fantasia: string;
}

export const milAuditorRepository = {
  async findCompanyNamesByFirm(
    client: PoolClient,
    firmId: string,
    companyIds: string[]
  ): Promise<MilAuditorCompanyRow[]> {
    if (companyIds.length === 0) return [];

    const result = await client.query<MilAuditorCompanyRow>(
      `
      SELECT id, nome_fantasia
      FROM companies
      WHERE firm_id = $1
        AND id = ANY($2::uuid[])
        AND deleted_at IS NULL
      `,
      [firmId, companyIds]
    );
    return result.rows;
  },

  async findCompanyNamesGlobally(
    client: PoolClient,
    companyIds: string[]
  ): Promise<MilAuditorCompanyRow[]> {
    if (companyIds.length === 0) return [];

    const result = await client.query<MilAuditorCompanyRow>(
      `
      SELECT id, nome_fantasia
      FROM companies
      WHERE id = ANY($1::uuid[])
        AND deleted_at IS NULL
      `,
      [companyIds]
    );
    return result.rows;
  },
};