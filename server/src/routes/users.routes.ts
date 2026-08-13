import { Router } from "express";
import { userManagementController } from "../controllers/user.management.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.use(requireRole("platform_admin", "firm_owner"));

usersRouter.get("/", userManagementController.list);
usersRouter.get("/:id", userManagementController.getById);
usersRouter.post("/invite", userManagementController.invite);
usersRouter.patch("/:id/status", userManagementController.updateStatus);
usersRouter.patch("/:id/role", userManagementController.updateRole);
