import { Router } from "express";
import { invoicesController } from "../controllers/invoice.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get("/", invoicesController.list);
invoicesRouter.get("/:id", invoicesController.getById);
invoicesRouter.post("/", requireRole("platform_admin", "firm_owner", "accountant"), invoicesController.create);
invoicesRouter.patch("/:id/status", requireRole("platform_admin", "firm_owner", "accountant"), invoicesController.updateStatus);
