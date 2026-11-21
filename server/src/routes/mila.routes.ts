import { Router } from "express";
import { milaController } from "../controllers/mila.controller.js";
import { milaRateLimit } from "../middleware/milaRateLimit.js";

export const milaRouter = Router();

milaRouter.post("/chat", milaRateLimit, milaController.chat);
