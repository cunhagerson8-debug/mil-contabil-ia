import { Router } from "express";
import { adminCommercialLeadController } from "../controllers/adminCommercialLead.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const adminCommercialLeadRouter = Router();

adminCommercialLeadRouter.use(requireAuth, requireRole("platform_admin"));
adminCommercialLeadRouter.get("/", adminCommercialLeadController.list);
adminCommercialLeadRouter.patch("/:id/status", adminCommercialLeadController.updateStatus);
