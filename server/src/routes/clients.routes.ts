// =============================================================================
// Routes: /api/clients
// =============================================================================
import { Router } from "express";
import { clientsController } from "../controllers/client.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

clientsRouter.get("/", clientsController.list);
clientsRouter.get("/:id", clientsController.getById);

clientsRouter.post("/", requireRole("platform_admin", "firm_owner", "accountant"), clientsController.create);
clientsRouter.put("/:id", requireRole("platform_admin", "firm_owner", "accountant"), clientsController.update);
clientsRouter.delete("/:id", requireRole("platform_admin", "firm_owner", "accountant"), clientsController.remove);
