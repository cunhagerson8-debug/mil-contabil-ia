import { Request, Response, NextFunction } from "express";
import { alertService } from "../services/alert.service.js";
import { z } from "zod";

const listQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  severity: z.string().optional(),
  category: z.string().optional(),
  read: z.enum(["true", "false"]).optional().transform(v => v === undefined ? undefined : v === "true"),
}).passthrough();

export const alertsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = listQuerySchema.parse(req.query);
      const alerts = await alertService.list(req.tenantContext!, filters);
      res.json({ alerts });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alert = await alertService.getById(req.tenantContext!, req.params.id);
      res.json({ alert });
    } catch (err) { next(err); }
  },

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alert = await alertService.markRead(req.tenantContext!, req.params.id);
      res.json({ alert });
    } catch (err) { next(err); }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await alertService.markAllRead(req.tenantContext!);
      res.json({ markedCount: count });
    } catch (err) { next(err); }
  },
};
