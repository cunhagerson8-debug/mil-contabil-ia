import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { aiChatService } from "../services/ai-chat.service.js";
import { UnauthorizedError } from "../utils/errors.js";

const aiChatSchema = z.object({
  message: z.string(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
}).strict();

export const aiChatController = {
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.tenantContext?.userId || !req.tenantContext.role) {
        throw new UnauthorizedError("Contexto de autenticação inválido.");
      }

      const input = aiChatSchema.parse(req.body);
      const response = await aiChatService.chat(input.message, input.history);
      res.json({ response });
    } catch (error) {
      next(error);
    }
  },
};