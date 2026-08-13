// =============================================================================
// Routes: /api/tax-obligations
// =============================================================================
import { Router } from "express";
import { taxObligationsController } from "../controllers/taxObligation.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const taxObligationsRouter = Router();
taxObligationsRouter.use(requireAuth);

taxObligationsRouter.get("/", taxObligationsController.list);
taxObligationsRouter.get("/:id", taxObligationsController.getById);

taxObligationsRouter.post("/", requireRole("platform_admin", "firm_owner", "accountant"), taxObligationsController.create);
taxObligationsRouter.put("/:id", requireRole("platform_admin", "firm_owner", "accountant"), taxObligationsController.update);
taxObligationsRouter.post("/:id/mark-paid", requireRole("platform_admin", "firm_owner", "accountant"), taxObligationsController.markPaid);
taxObligationsRouter.delete("/:id", requireRole("platform_admin", "firm_owner", "accountant"), taxObligationsController.remove);
