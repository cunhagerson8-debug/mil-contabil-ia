import { Router } from "express";
import { adminFirmController } from "../controllers/admin-firm.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const adminFirmsRouter = Router();
adminFirmsRouter.use(requireAuth, requireRole("platform_admin"));

adminFirmsRouter.get("/", adminFirmController.list);
adminFirmsRouter.post("/", adminFirmController.create);
adminFirmsRouter.get("/:firmId", adminFirmController.getById);
adminFirmsRouter.put("/:firmId", adminFirmController.update);
adminFirmsRouter.patch("/:firmId/status", adminFirmController.updateStatus);