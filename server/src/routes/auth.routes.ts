// =============================================================================
// Routes: /api/auth
// =============================================================================
import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/register", authController.register);
authRouter.post("/forgot-password", authController.forgotPassword);
// POST (token no corpo) evita que o token apareça em query string/logs de acesso.
authRouter.post("/invitations/validate", authController.validateInvitation);
authRouter.post("/invitations/accept", authController.acceptInvitation);
authRouter.get("/me", requireAuth, authController.me);
