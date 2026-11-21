import type { NextFunction, Request, Response } from "express";
import { commercialLeadService } from "../services/commercialLead.service.js";
import {
  commercialLeadIdSchema,
  commercialLeadListQuerySchema,
  commercialLeadStatusSchema,
} from "../validators/commercialLead.validators.js";

export const adminCommercialLeadController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = commercialLeadListQuerySchema.parse(req.query);
      res.json(await commercialLeadService.listForPlatformAdmin(req.tenantContext!, query));
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = commercialLeadStatusSchema.parse(req.body);
      const id = commercialLeadIdSchema.parse(req.params.id);
      const lead = await commercialLeadService.updateStatus(
        req.tenantContext!,
        id,
        status,
      );
      res.json({ lead });
    } catch (error) {
      next(error);
    }
  },
};
