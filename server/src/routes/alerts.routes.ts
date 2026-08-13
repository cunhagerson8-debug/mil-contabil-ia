import { Router } from "express";
import { alertsController } from "../controllers/alert.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

alertsRouter.get("/", alertsController.list);
alertsRouter.get("/:id", alertsController.getById);
alertsRouter.patch("/:id/read", alertsController.markRead);
alertsRouter.post("/mark-all-read", alertsController.markAllRead);
