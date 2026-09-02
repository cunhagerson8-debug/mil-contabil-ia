import { Router } from "express";
import { aiChatController } from "../controllers/ai-chat.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const aiChatRouter = Router();

aiChatRouter.post("/chat", requireAuth, aiChatController.chat);