// ============================================================
// Routes: /api/employees
// Gestão de RH - Colaboradores
// ============================================================

import { Router } from "express";
import { employeeController } from "../controllers/employee.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireHrPermission } from "../middleware/requireHrPermission.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get(
  "/",
  requireRole("firm_owner", "accountant", "company_manager", "company_user"),
  requireHrPermission("employee.read"),
  employeeController.list
);
employeesRouter.get(
  "/departments",
  requireRole("firm_owner", "accountant", "company_manager", "company_user"),
  requireHrPermission("employee.read"),
  employeeController.listDepartments
);
employeesRouter.get(
  "/:id",
  requireRole("firm_owner", "accountant", "company_manager", "company_user"),
  requireHrPermission("employee.read"),
  employeeController.getById
);

employeesRouter.post(
  "/",
  requireRole("firm_owner", "accountant", "company_manager", "company_user"),
  requireHrPermission("employee.manage"),
  employeeController.create
);

employeesRouter.put(
  "/:id",
  requireRole("firm_owner", "accountant", "company_manager", "company_user"),
  requireHrPermission("employee.manage"),
  employeeController.update
);

employeesRouter.delete(
  "/:id",
  requireRole("firm_owner"),
  employeeController.remove
);