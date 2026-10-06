import type { NextFunction, Request, Response } from "express";
import { firmOnboardingService } from "../services/firm.onboarding.service.js";
import { firmService } from "../services/firm.service.js";
import {
  createAdminFirmSchema,
  onboardFirmSchema,
  updateAdminFirmSchema,
  updateAdminFirmStatusSchema,
} from "../validators/firm.validators.js";

export const adminFirmController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ firms: await firmService.listForPlatformAdmin(req.tenantContext!) });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ firm: await firmService.getForPlatformAdmin(req.tenantContext!, req.params.firmId) });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createAdminFirmSchema.parse(req.body);
      res.status(201).json({ firm: await firmService.createForPlatformAdmin(req.tenantContext!, input) });
    } catch (error) {
      next(error);
    }
  },

  async onboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = onboardFirmSchema.parse(req.body);
      res.status(201).json(await firmOnboardingService.onboard(req.tenantContext!, input));
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateAdminFirmSchema.parse(req.body);
      res.json({ firm: await firmService.updateForPlatformAdmin(req.tenantContext!, req.params.firmId, input) });
    } catch (error) {
      next(error);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = updateAdminFirmStatusSchema.parse(req.body);
      res.json({ firm: await firmService.updateStatusForPlatformAdmin(req.tenantContext!, req.params.firmId, status) });
    } catch (error) {
      next(error);
    }
  },
};