// ============================================================
// Controller: Assinaturas / Cobrança
// ============================================================

import {
  Request,
  Response,
  NextFunction,
} from "express";

import { subscriptionService } from "../services/subscription.service.js";

export const subscriptionController = {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscriptions =
        await subscriptionService.list(
          req.tenantContext!
        );

      res.json({ subscriptions });
    } catch (err) {
      next(err);
    }
  },

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscription =
        await subscriptionService.getById(
          req.tenantContext!,
          req.params.id
        );

      res.json({ subscription });
    } catch (err) {
      next(err);
    }
  },

  async getCurrent(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscription =
        await subscriptionService.getCurrent(
          req.tenantContext!
        );

      res.json({ subscription });
    } catch (err) {
      next(err);
    }
  },

  async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscription =
        await subscriptionService.create(
          req.tenantContext!,
          req.body
        );

      res.status(201).json({ subscription });
    } catch (err) {
      next(err);
    }
  },

  async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const subscription =
        await subscriptionService.update(
          req.tenantContext!,
          req.params.id,
          req.body
        );

      res.json({ subscription });
    } catch (err) {
      next(err);
    }
  },

  async cancel(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const atPeriodEnd =
        req.body?.atPeriodEnd !== false;

      const subscription =
        await subscriptionService.cancel(
          req.tenantContext!,
          req.params.id,
          atPeriodEnd
        );

      res.json({ subscription });
    } catch (err) {
      next(err);
    }
  },
};