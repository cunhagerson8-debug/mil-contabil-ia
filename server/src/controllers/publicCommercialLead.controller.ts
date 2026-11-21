import type { NextFunction, Request, Response } from "express";
import { publicCommercialLeadService } from "../services/commercialLead.service.js";

export const publicCommercialLeadController = {
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await publicCommercialLeadService.submit(req.body);
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  },
};
