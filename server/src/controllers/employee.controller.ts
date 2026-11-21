// ============================================================
// Controller: Gestão de RH - Colaboradores
// ============================================================

import {
  Request,
  Response,
  NextFunction,
} from "express";

import { employeeService } from "../services/employee.service.js";
import {
  createEmployeeSchema,
  employeeIdSchema,
  listEmployeeDepartmentsQuerySchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "../validators/employee.validators.js";

export const employeeController = {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = listEmployeesQuerySchema.parse(req.query);

      const employees = await employeeService.list(
        req.tenantContext!,
        filters
      );

      res.json({ employees });
    } catch (err) {
      next(err);
    }
  },

  async listDepartments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { companyId } = listEmployeeDepartmentsQuerySchema.parse(req.query);
      const departments = await employeeService.listDepartments(
        req.tenantContext!,
        companyId
      );
      res.json({ departments });
    } catch (err) {
      next(err);
    }
  },

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const employee = await employeeService.getById(
        req.tenantContext!,
        employeeIdSchema.parse(req.params.id)
      );

      res.json({ employee });
    } catch (err) {
      next(err);
    }
  },

  async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const employee = await employeeService.create(
        req.tenantContext!,
        createEmployeeSchema.parse(req.body)
      );

      res.status(201).json({ employee });
    } catch (err) {
      next(err);
    }
  },

  async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const employee = await employeeService.update(
        req.tenantContext!,
        employeeIdSchema.parse(req.params.id),
        updateEmployeeSchema.parse(req.body)
      );

      res.json({ employee });
    } catch (err) {
      next(err);
    }
  },

  async remove(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await employeeService.remove(
        req.tenantContext!,
        employeeIdSchema.parse(req.params.id)
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};