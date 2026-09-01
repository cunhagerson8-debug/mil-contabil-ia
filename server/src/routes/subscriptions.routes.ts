// ============================================================
// Routes: /api/subscriptions
// Assinaturas / Cobrança
// ============================================================

import { Router } from "express";
import { subscriptionController } from "../controllers/subscription.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

subscriptionsRouter.get(
  "/",
  requireRole("platform_admin", "firm_owner", "accountant"),
  subscriptionController.list
);

subscriptionsRouter.get(
  "/current",
  requireRole("platform_admin", "firm_owner", "accountant"),
  subscriptionController.getCurrent
);

subscriptionsRouter.get(
  "/:id",
  requireRole("platform_admin", "firm_owner", "accountant"),
  subscriptionController.getById
);

subscriptionsRouter.post(
  "/",
  requireRole("platform_admin"),
  subscriptionController.create
);

subscriptionsRouter.put(
  "/:id",
  requireRole("platform_admin"),
  subscriptionController.update
);

subscriptionsRouter.post(
  "/:id/cancel",
  requireRole("platform_admin"),
  subscriptionController.cancel
);