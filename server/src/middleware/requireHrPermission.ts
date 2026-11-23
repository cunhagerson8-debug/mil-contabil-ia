import { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import type { HrPermission } from "../types/hr-permissions.js";

const STAFF_ROLES = new Set(["firm_owner", "accountant"]);

export function requireHrPermission(permission: HrPermission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const context = req.tenantContext;
    if (!context) {
      next(new UnauthorizedError());
      return;
    }

    if (
      STAFF_ROLES.has(context.role)
      || context.hrPermissions?.some((grant) => grant.permissions.includes(permission))
    ) {
      next();
      return;
    }

    next(new ForbiddenError("Permissão específica de RH necessária."));
  };
}
