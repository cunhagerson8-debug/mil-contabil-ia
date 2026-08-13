// =============================================================================
// Controller: Tax Obligations
// =============================================================================
import { Request, Response, NextFunction } from "express";
import { taxObligationService } from "../services/taxObligation.service.js";
import {
  createTaxObligationSchema, updateTaxObligationSchema, listTaxObligationsQuerySchema,
} from "../validators/taxObligation.validators.js";

export const taxObligationsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = listTaxObligationsQuerySchema.parse(req.query);
      const obligations = await taxObligationService.list(req.tenantContext!, filters);
      res.json({ obligations });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const obligation = await taxObligationService.getById(req.tenantContext!, req.params.id);
      res.json({ obligation });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createTaxObligationSchema.parse(req.body);
      const obligation = await taxObligationService.create(req.tenantContext!, input);
      res.status(201).json({ obligation });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateTaxObligationSchema.parse(req.body);
      const obligation = await taxObligationService.update(req.tenantContext!, req.params.id, input);
      res.json({ obligation });
    } catch (err) {
      next(err);
    }
  },

  async markPaid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const obligation = await taxObligationService.markAsPaid(req.tenantContext!, req.params.id);
      res.json({ obligation });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await taxObligationService.remove(req.tenantContext!, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
