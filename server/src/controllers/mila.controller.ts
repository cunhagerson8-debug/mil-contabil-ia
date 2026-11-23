import type { NextFunction, Request, Response } from "express";
import { milaService } from "../services/mila.service.js";

export const milaController = {
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await milaService.chat(req.body);
      res.json({ response });
    } catch (error) {
      next(error);
    }
  },
};
