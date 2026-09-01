// ============================================================
// Controller: Gestão de RH - Colaboradores
// ============================================================

import {
  Request,
  Response,
  NextFunction,
} from "express";

import { employeeService } from "../services/employee.service.js";

export const employeeController = {
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const filters = {
        companyId:
          typeof req.query.companyId === "string"
            ? req.query.companyId
            : undefined,
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
        search:
          typeof req.query.search === "string"
            ? req.query.search
            : undefined,
      };

      const employees = await employeeService.list(
        req.tenantContext!,
        filters
      );

      res.json({ employees });
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
        req.params.id
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
        req.body
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
        req.params.id,
        req.body
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
        req.params.id
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};