import { Request, Response, NextFunction } from "express";
import { userManagementService } from "../services/user.management.service.js";
import { z } from "zod";

const listQuerySchema = z.object({
  role: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
}).passthrough();

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.string(),
});

const updateStatusSchema = z.object({ status: z.string() });
const updateRoleSchema = z.object({ role: z.string() });

export const userManagementController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = listQuerySchema.parse(req.query);
      const users = await userManagementService.list(req.tenantContext!, filters);
      res.json({ users });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userManagementService.getById(req.tenantContext!, req.params.id);
      res.json({ user });
    } catch (err) { next(err); }
  },

  async invite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = inviteSchema.parse(req.body);
      const user = await userManagementService.invite(req.tenantContext!, data);
      res.status(201).json({ user });
    } catch (err) { next(err); }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = updateStatusSchema.parse(req.body);
      const user = await userManagementService.updateStatus(req.tenantContext!, req.params.id, status);
      res.json({ user });
    } catch (err) { next(err); }
  },

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role } = updateRoleSchema.parse(req.body);
      const user = await userManagementService.updateRole(req.tenantContext!, req.params.id, role);
      res.json({ user });
    } catch (err) { next(err); }
  },
};
