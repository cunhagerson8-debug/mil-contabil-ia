import type { PoolClient } from "pg";

export interface CertificateCreateInput {
  companyId: string;
  titular: string;
  cnpj: string;
  vaultReference: string;
  validFrom: string;
  validUntil: string;
}

export const certificateRepository = {
  async create(client: PoolClient, data: CertificateCreateInput) {
    const result = await client.query(
      `
      INSERT INTO digital_certificates (
        company_id,
        titular,
        cnpj,
        vault_reference,
        valid_from,
        valid_until
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        company_id,
        titular,
        cnpj,
        valid_from,
        valid_until,
        created_at
      `,
      [
        data.companyId,
        data.titular,
        data.cnpj,
        data.vaultReference,
        data.validFrom,
        data.validUntil,
      ]
    );

    return result.rows[0];
  },
};