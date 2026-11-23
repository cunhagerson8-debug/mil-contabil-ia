// =============================================================================
// Routes: /api/auth
// =============================================================================
import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

import {
  loginRateLimit,
  passwordResetCompletionRateLimit,
  passwordResetRequestRateLimit,
} from "../middleware/authRateLimit.js";

export const authRouter = Router();

authRouter.post("/login", loginRateLimit, authController.login);
authRouter.post("/register", authController.register);
authRouter.post("/forgot-password", passwordResetRequestRateLimit, authController.forgotPassword);
authRouter.post("/reset-password", passwordResetCompletionRateLimit, authController.resetPassword);
// POST (token no corpo) evita que o token apareÃ§a em query string/logs de acesso.
authRouter.post("/invitations/validate", authController.validateInvitation);
authRouter.post("/invitations/accept", authController.acceptInvitation);
authRouter.get("/me", requireAuth, authController.me);
