// ============================================================
// Routes: /api/employees
// Gestão de RH - Colaboradores
// ============================================================

import { Router } from "express";
import { employeeController } from "../controllers/employee.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get("/", employeeController.list);
employeesRouter.get("/:id", employeeController.getById);

employeesRouter.post(
  "/",
  requireRole("platform_admin", "firm_owner", "accountant"),
  employeeController.create
);

employeesRouter.put(
  "/:id",
  requireRole("platform_admin", "firm_owner", "accountant"),
  employeeController.update
);

employeesRouter.delete(
  "/:id",
  requireRole("platform_admin", "firm_owner", "accountant"),
  employeeController.remove
);