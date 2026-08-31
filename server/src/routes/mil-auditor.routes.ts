import { Router } from "express";
import { milAuditorController } from "../controllers/mil-auditor.controller.js";
import { requireRole } from "../middleware/requireRole.js";

export const milAuditorRoutes = Router();

// Auditoria completa da plataforma:
// acesso exclusivo ao administrador da MIL.
milAuditorRoutes.get(
  "/",
  requireRole("platform_admin"),
  milAuditorController.run.bind(milAuditorController)
);