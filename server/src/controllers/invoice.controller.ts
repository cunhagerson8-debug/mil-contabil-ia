import { Request, Response, NextFunction } from "express";
import { invoiceService } from "../services/invoice.service.js";
import { z } from "zod";

const listQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
}).passthrough();

const createSchema = z.object({
  companyId: z.string().uuid(),
  numero: z.string().min(1),
  tipo: z.string(),
  dataEmissao: z.string(),
  tomador: z.string().min(1),
  tomadorDoc: z.string().min(1),
  valorTotal: z.number().min(0),
  iss: z.number().optional(),
  pis: z.number().optional(),
  cofins: z.number().optional(),
  csll: z.number().optional(),
  irrf: z.number().optional(),
  items: z.array(z.object({
    descricao: z.string().min(1),
    quantidade: z.number().positive(),
    valorUnitario: z.number().min(0),
    valorTotal: z.number().min(0),
    ordem: z.number().int().min(0),
  })).default([]),
});

const updateStatusSchema = z.object({
  status: z.string(),
  motivoCancelamento: z.string().optional(),
});

export const invoicesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = listQuerySchema.parse(req.query);
      const invoices = await invoiceService.list(req.tenantContext!, filters);
      res.json({ invoices });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getById(req.tenantContext!, req.params.id);
      res.json({ invoice });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { items, ...data } = createSchema.parse(req.body);
      const invoice = await invoiceService.create(
        req.tenantContext!,
        { ...data, firmId: req.tenantContext!.firmId! },
        items
      );
      res.status(201).json({ invoice });
    } catch (err) { next(err); }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, motivoCancelamento } = updateStatusSchema.parse(req.body);
      const invoice = await invoiceService.updateStatus(req.tenantContext!, req.params.id, status, motivoCancelamento);
      res.json({ invoice });
    } catch (err) { next(err); }
  },
};
