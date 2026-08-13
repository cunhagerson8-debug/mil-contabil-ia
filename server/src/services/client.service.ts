// =============================================================================
// Service: Clients
// =============================================================================
import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { clientRepository, ClientFilters } from "../repositories/client.repository.js";
import { toClientDto, tipoClienteToDb, statusClienteToDb } from "../mappers/client.mapper.js";
import { ClientCreateInput, ClientUpdateInput, ClientDto, StatusCliente } from "../types/dto.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";

async function hydrate(client: any, row: Awaited<ReturnType<typeof clientRepository.findById>>): Promise<ClientDto> {
  if (!row) throw new NotFoundError("Cliente", "?");
  const [contacts, documents, history] = await Promise.all([
    clientRepository.findContacts(client, row.id),
    clientRepository.findDocuments(client, row.id),
    clientRepository.findHistory(client, row.id),
  ]);
  return toClientDto(row, contacts, documents, history);
}

export const clientService = {
  async list(ctx: TenantContext, filters: { status?: StatusCliente; search?: string } = {}): Promise<ClientDto[]> {
    return withTenantContext(ctx, async (client) => {
      const dbFilters: ClientFilters = {
        status: filters.status ? statusClienteToDb(filters.status) : undefined,
        search: filters.search,
      };
      const rows = await clientRepository.findAll(client, dbFilters);
      return Promise.all(rows.map((row) => hydrate(client, row)));
    });
  },

  async getById(ctx: TenantContext, id: string): Promise<ClientDto> {
    return withTenantContext(ctx, async (client) => {
      const row = await clientRepository.findById(client, id);
      if (!row) throw new NotFoundError("Cliente", id);
      return hydrate(client, row);
    });
  },

  async create(ctx: TenantContext, input: ClientCreateInput): Promise<ClientDto> {
    if (!ctx.firmId) throw new ConflictError("Usuário sem escritório associado não pode cadastrar clientes.");

    return withTenantContext(ctx, async (client) => {
      const existing = await clientRepository.findByDocumento(client, ctx.firmId!, input.documento);
      if (existing) {
        throw new ConflictError(`Já existe um cliente com o documento ${input.documento} cadastrado neste escritório.`);
      }

      const created = await clientRepository.create(client, {
        firmId: ctx.firmId!,
        companyId: input.companyId,
        nome: input.nome,
        tipo: tipoClienteToDb(input.tipo),
        documento: input.documento,
        servicosContratados: input.servicosContratados,
      });
      return hydrate(client, created);
    });
  },

  async update(ctx: TenantContext, id: string, input: ClientUpdateInput): Promise<ClientDto> {
    return withTenantContext(ctx, async (client) => {
      const current = await clientRepository.findById(client, id);
      if (!current) throw new NotFoundError("Cliente", id);

      if (input.documento && input.documento !== current.documento) {
        const conflict = await clientRepository.findByDocumento(client, current.firm_id, input.documento);
        if (conflict && conflict.id !== id) {
          throw new ConflictError(`Já existe outro cliente com o documento ${input.documento} neste escritório.`);
        }
      }

      const updated = await clientRepository.update(client, id, {
        companyId: input.companyId,
        nome: input.nome,
        tipo: input.tipo ? tipoClienteToDb(input.tipo) : undefined,
        documento: input.documento,
        status: input.status ? statusClienteToDb(input.status) : undefined,
        servicosContratados: input.servicosContratados,
      });
      if (!updated) throw new NotFoundError("Cliente", id);
      return hydrate(client, updated);
    });
  },

  /** Soft delete — mesma justificativa de companyService.remove(). */
  async remove(ctx: TenantContext, id: string): Promise<void> {
    await withTenantContext(ctx, async (client) => {
      const deleted = await clientRepository.softDelete(client, id);
      if (!deleted) throw new NotFoundError("Cliente", id);
    });
  },
};
