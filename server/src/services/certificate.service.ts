
import {
  withTenantContext,
  type TenantContext,
} from "../db/withTenantContext.js";

import {
  certificateRepository,
  type CertificateCreateInput,
} from "../repositories/certificate.repository.js";

export const certificateService = {
  async create(
    ctx: TenantContext,
    data: CertificateCreateInput
  ) {
    if (!["firm_owner", "accountant"].includes(ctx.role)) {
      throw new Error("Sem permissão para cadastrar certificados.");
    }

    if (!ctx.firmId) {
      throw new Error("Escritório não identificado.");
    }

    return withTenantContext(ctx, async (client) => {
      const result = await client.query(
        `SELECT cnpj
         FROM companies
         WHERE id = $1
           AND firm_id = $2
           AND deleted_at IS NULL`,
        [data.companyId, ctx.firmId]
      );

      if (result.rows.length === 0) {
        throw new Error("Empresa não encontrada neste escritório.");
      }

      const normalize = (value: string) =>
        value.replace(/\D/g, "");

      if (normalize(result.rows[0].cnpj) !== normalize(data.cnpj)) {
        throw new Error("O CNPJ do certificado não corresponde ao da empresa.");
      }

      if (!data.titular.trim() || !data.vaultReference.trim()) {
        throw new Error("Titular e referência do cofre são obrigatórios.");
      }

      const isDate = (value: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value));

      if (!isDate(data.validFrom) || !isDate(data.validUntil)) {
        throw new Error("Datas do certificado inválidas.");
      }

      if (data.validUntil < data.validFrom) {
        throw new Error("A validade final não pode ser anterior à inicial.");
      }

      return certificateRepository.create(client, data);
    });
  },
};
