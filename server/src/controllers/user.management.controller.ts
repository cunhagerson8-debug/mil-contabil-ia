import { Request, Response, NextFunction } from "express";
import { userManagementService } from "../services/user.management.service.js";
import { z } from "zod";
import { HR_PERMISSIONS } from "../types/hr-permissions.js";

const listQuerySchema = z.object({
  role: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
}).passthrough();

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  role: z.string(),
  // Só é considerado quando o requisitante é platform_admin; nunca usado como autorização.
  firmId: z.string().uuid().optional(),
});

const updateStatusSchema = z.object({ status: z.string() });
const updateRoleSchema = z.object({ role: z.string() });
const updateHrPermissionsSchema = z.object({
  permissions: z.array(z.enum(HR_PERMISSIONS)).max(HR_PERMISSIONS.length),
}).strict().superRefine(({ permissions }, context) => {
  if (new Set(permissions).size !== permissions.length) {
    context.addIssue({
      code: "custom",
      path: ["permissions"],
      message: "Permissões duplicadas.",
    });
  }
  const set = new Set(permissions);
  if (
    (set.has("employee.sensitive.read") && !set.has("employee.read"))
    || (set.has("employee.documents.read") && !set.has("employee.read"))
    || (set.has("employee.manage")
      && (!set.has("employee.read") || !set.has("employee.sensitive.read")))
    || (set.has("employee.documents.manage")
      && (!set.has("employee.read") || !set.has("employee.documents.read")))
  ) {
    context.addIssue({
      code: "custom",
      path: ["permissions"],
      message: "Permissões de gestão ou dados específicos exigem a leitura correspondente.",
    });
  }
});

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
      const { user, emailSent } = await userManagementService.invite(req.tenantContext!, data);
      res.status(201).json({ user, emailSent });
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

  async replaceHrPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = z.string().uuid().parse(req.params.id);
      const companyId = z.string().uuid().parse(req.params.companyId);
      const { permissions } = updateHrPermissionsSchema.parse(req.body);
      const result = await userManagementService.replaceHrPermissions(
        req.tenantContext!,
        userId,
        companyId,
        permissions,
      );
      res.json({ hrPermission: result });
    } catch (err) { next(err); }
  },
};
