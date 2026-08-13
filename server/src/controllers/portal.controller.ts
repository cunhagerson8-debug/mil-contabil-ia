import { Request, Response, NextFunction } from "express";
import { portalService } from "../services/portal.service.js";
import { z } from "zod";

const createDocSchema = z.object({
  clientId: z.string().uuid(),
  nome: z.string().min(1),
  categoria: z.string(),
  storageKey: z.string().min(1),
  tamBytes: z.number().optional(),
});

const createGuideSchema = z.object({
  clientId: z.string().uuid(),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  tipo: z.string(),
  valor: z.number().min(0),
  vencimento: z.string(),
  codigoBarras: z.string().optional(),
  taxObligationId: z.string().uuid().optional(),
});

const createMessageSchema = z.object({
  clientId: z.string().uuid(),
  assunto: z.string().min(1),
  corpo: z.string().min(1),
  remetente: z.enum(["escritorio", "cliente"]),
  respostaId: z.string().uuid().optional(),
});

export const portalController = {
  // Documents
  async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await portalService.listDocuments(req.tenantContext!, req.params.clientId);
      res.json({ documents: docs });
    } catch (err) { next(err); }
  },

  async createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createDocSchema.parse(req.body);
      const doc = await portalService.createDocument(req.tenantContext!, data);
      res.status(201).json({ document: doc });
    } catch (err) { next(err); }
  },

  // Guides
  async listGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const guides = await portalService.listGuides(req.tenantContext!, req.params.clientId);
      res.json({ guides });
    } catch (err) { next(err); }
  },

  async createGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createGuideSchema.parse(req.body);
      const guide = await portalService.createGuide(req.tenantContext!, data);
      res.status(201).json({ guide });
    } catch (err) { next(err); }
  },

  async markGuidePaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const guide = await portalService.markGuidePaid(req.tenantContext!, req.params.id);
      res.json({ guide });
    } catch (err) { next(err); }
  },

  // Messages
  async listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const messages = await portalService.listMessages(req.tenantContext!, req.params.clientId);
      res.json({ messages });
    } catch (err) { next(err); }
  },

  async createMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createMessageSchema.parse(req.body);
      const msg = await portalService.createMessage(req.tenantContext!, data);
      res.status(201).json({ message: msg });
    } catch (err) { next(err); }
  },

  async updateMessageStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const msg = await portalService.updateMessageStatus(req.tenantContext!, req.params.id, status);
      res.json({ message: msg });
    } catch (err) { next(err); }
  },
};
