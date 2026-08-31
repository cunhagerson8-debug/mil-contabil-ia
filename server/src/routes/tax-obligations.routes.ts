import { Router } from "express";
import { taxObligationController } from "../controllers/tax-obligation.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const taxObligationsRoutes = Router();

// Leitura: qualquer usuário autenticado do escritório.
taxObligationsRoutes.get("/", requireAuth, taxObligationController.list);
taxObligationsRoutes.get("/:id", requireAuth, taxObligationController.findById);

// Escrita: segue o mesmo padrão de Companies.
taxObligationsRoutes.post(
  "/",
  requireRole("platform_admin", "firm_owner", "accountant"),
  taxObligationController.create
);

taxObligationsRoutes.put(
  "/:id",
  requireRole("platform_admin", "firm_owner", "accountant"),
  taxObligationController.update
);