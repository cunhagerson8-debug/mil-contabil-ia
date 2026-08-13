import { TenantContext, withTenantContext } from "../db/withTenantContext.js";
import { invoiceRepository, InvoiceFilters, InvoiceCreateRow, InvoiceItemCreateRow } from "../repositories/invoice.repository.js";
import { NotFoundError, ValidationError } from "../utils/errors.js";

export const invoiceService = {
  async list(ctx: TenantContext, filters: InvoiceFilters) {
    return withTenantContext(ctx, (client) => invoiceRepository.findAll(client, filters));
  },

  async getById(ctx: TenantContext, id: string) {
    return withTenantContext(ctx, async (client) => {
      const invoice = await invoiceRepository.findById(client, id);
      if (!invoice) throw new NotFoundError("Nota Fiscal", id);
      const items = await invoiceRepository.findItems(client, id);
      return { ...invoice, items };
    });
  },

  async create(ctx: TenantContext, data: InvoiceCreateRow, items: Omit<InvoiceItemCreateRow, "invoiceId">[]) {
    return withTenantContext(ctx, async (client) => {
      const invoice = await invoiceRepository.create(client, data);
      for (const item of items) {
        await invoiceRepository.createItem(client, { ...item, invoiceId: invoice.id });
      }
      const createdItems = await invoiceRepository.findItems(client, invoice.id);
      return { ...invoice, items: createdItems };
    });
  },

  async updateStatus(ctx: TenantContext, id: string, status: string, motivoCancelamento?: string) {
    if (status === "cancelada" && !motivoCancelamento) {
      throw new ValidationError("Motivo de cancelamento é obrigatório.");
    }
    return withTenantContext(ctx, async (client) => {
      const invoice = await invoiceRepository.updateStatus(client, id, status, motivoCancelamento);
      if (!invoice) throw new NotFoundError("Nota Fiscal", id);
      return invoice;
    });
  },
};
