import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { certificateController } from "../controllers/certificate.controller.js";
export const certificatesRouter = Router();

certificatesRouter.use(requireAuth);

certificatesRouter.post(
  "/",
  requireRole("firm_owner", "accountant"),
  certificateController.create
);
