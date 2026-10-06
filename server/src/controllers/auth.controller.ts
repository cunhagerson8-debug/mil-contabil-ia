// =============================================================================
// Controller: Auth
// =============================================================================
import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import { invitationService } from "../services/invitation.service.js";
import {
  loginSchema, registerSchema, forgotPasswordSchema, validateInvitationSchema, acceptInvitationSchema,
} from "../validators/auth.validators.js";
import { UnauthorizedError } from "../utils/errors.js";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const session = await authService.login(input);
      res.json(session);
    } catch (err) {
      next(err);
    }
  },

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const session = await authService.register(input);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await authService.requestPasswordReset(email);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async validateInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = validateInvitationSchema.parse(req.body);
      const invitation = await invitationService.validate(token);
      res.json({ invitation });
    } catch (err) {
      next(err);
    }
  },

  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = acceptInvitationSchema.parse(req.body);
      await invitationService.accept(token, password);
      res.json({ accepted: true });
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = req.tenantContext!;
      const user = await authService.getUserById(ctx.userId, ctx.firmId, ctx.role);
      if (!user) {
        next(new UnauthorizedError("Usuário não encontrado."));
        return;
      }
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
};
