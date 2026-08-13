// =============================================================================
// Service: Companies
// -----------------------------------------------------------------------------
// Regras de negócio que vivem aqui (e não no repository nem na rota):
//   * Unicidade de CNPJ dentro do firm (regra de produto; o banco também
//     garante via UNIQUE constraint, mas aqui devolvemos um erro de
//     domínio claro ANTES de bater no banco, com mensagem amigável).
//   * Composição da resposta (empresa + sócios + validade do certificado)
//     em uma única chamada — o frontend não deveria precisar de 3
//     requisições para montar a tela de detalhe.
//   * Decisão de quem pode excluir (regra de produto: mesmo que RLS permita
//     DELETE para firm_owner, a regra de produto é "nunca exclui de
//     verdade" — sempre soft delete, reforçada aqui).
// =============================================================================
import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { companyRepository, CompanyFilters } from "../repositories/company.repository.js";
import { toCompanyDto, regimeToDb, statusEmpresaToDb } from "../mappers/company.mapper.js";
import { CompanyCreateInput, CompanyUpdateInput, CompanyDto, StatusEmpresa } from "../types/dto.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";

async function hydrate(client: any, row: Awaited<ReturnType<typeof companyRepository.findById>>): Promise<CompanyDto> {
  if (!row) throw new NotFoundError("Empresa", "?");
  const [socios, certValidUntil] = await Promise.all([
    companyRepository.findPartners(client, row.id),
    companyRepository.findActiveCertificateValidUntil(client, row.id),
  ]);
  return toCompanyDto(row, socios, certValidUntil);
}

export const companyService = {
  async list(ctx: TenantContext, filters: { status?: StatusEmpresa; search?: string } = {}): Promise<CompanyDto[]> {
    return withTenantContext(ctx, async (client) => {
      const dbFilters: CompanyFilters = {
        status: filters.status ? statusEmpresaToDb(filters.status) : undefined,
        search: filters.search,
      };
      const rows = await companyRepository.findAll(client, dbFilters);
      // hydrate em paralelo — N+1 aceitável aqui porque a lista de empresas
      // de um escritório é tipicamente pequena (dezenas, não milhares);
      // se isso crescer, trocar por uma query agregada única.
      return Promise.all(rows.map((row) => hydrate(client, row)));
    });
  },

  async getById(ctx: TenantContext, id: string): Promise<CompanyDto> {
    return withTenantContext(ctx, async (client) => {
      const row = await companyRepository.findById(client, id);
      if (!row) throw new NotFoundError("Empresa", id);
      return hydrate(client, row);
    });
  },

  async create(ctx: TenantContext, input: CompanyCreateInput): Promise<CompanyDto> {
    if (!ctx.firmId) throw new ConflictError("Usuário sem escritório associado não pode cadastrar empresas.");

    return withTenantContext(ctx, async (client) => {
      const existing = await companyRepository.findByCnpj(client, ctx.firmId!, input.cnpj);
      if (existing) {
        throw new ConflictError(`Já existe uma empresa com o CNPJ ${input.cnpj} cadastrada neste escritório.`);
      }

      const created = await companyRepository.create(client, {
        firmId: ctx.firmId!,
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia,
        cnpj: input.cnpj,
        cnae: input.cnae,
        cnaeDescricao: input.cnaeDescricao,
        regime: regimeToDb(input.regime),
        responsavel: input.responsavel,
        contadorResponsavelId: input.contadorResponsavelId,
        dataAbertura: input.dataAbertura,
        email: input.email,
        telefone: input.telefone,
        endereco: input.endereco,
      });
      return hydrate(client, created);
    });
  },

  async update(ctx: TenantContext, id: string, input: CompanyUpdateInput): Promise<CompanyDto> {
    return withTenantContext(ctx, async (client) => {
      const current = await companyRepository.findById(client, id);
      if (!current) throw new NotFoundError("Empresa", id);

      if (input.cnpj && input.cnpj !== current.cnpj) {
        const conflict = await companyRepository.findByCnpj(client, current.firm_id, input.cnpj);
        if (conflict && conflict.id !== id) {
          throw new ConflictError(`Já existe outra empresa com o CNPJ ${input.cnpj} neste escritório.`);
        }
      }

      const updated = await companyRepository.update(client, id, {
        razaoSocial: input.razaoSocial,
        nomeFantasia: input.nomeFantasia,
        cnpj: input.cnpj,
        cnae: input.cnae,
        cnaeDescricao: input.cnaeDescricao,
        regime: input.regime ? regimeToDb(input.regime) : undefined,
        responsavel: input.responsavel,
        contadorResponsavelId: input.contadorResponsavelId,
        status: input.status ? statusEmpresaToDb(input.status) : undefined,
        dataAbertura: input.dataAbertura,
        email: input.email,
        telefone: input.telefone,
        endereco: input.endereco,
      });
      if (!updated) throw new NotFoundError("Empresa", id);
      return hydrate(client, updated);
    });
  },

  /**
   * Regra de produto: exclusão é sempre soft delete (deleted_at), nunca
   * remoção física — preserva histórico fiscal/contábil mesmo que a
   * empresa deixe de ser cliente do escritório. RLS já restringe quem pode
   * chamar isto (apenas firm_owner — ver companies_delete_firm_owner_only);
   * a rota/middleware de permissão reforça isso antes de chegar aqui.
   */
  async remove(ctx: TenantContext, id: string): Promise<void> {
    await withTenantContext(ctx, async (client) => {
      const deleted = await companyRepository.softDelete(client, id);
      if (!deleted) throw new NotFoundError("Empresa", id);
    });
  },
};
