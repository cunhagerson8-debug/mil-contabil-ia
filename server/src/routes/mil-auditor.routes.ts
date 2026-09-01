import { Router } from "express";
import { milAuditorController } from "../controllers/mil-auditor.controller.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const milAuditorRoutes = Router();

// Auditoria completa da plataforma:
// acesso exclusivo ao administrador da MIL.
milAuditorRoutes.get(
  "/",
  requireAuth,
  requireRole("platform_admin"),
  milAuditorController.run.bind(milAuditorController)
);