import { Router } from "express";
import { publicCommercialLeadController } from "../controllers/publicCommercialLead.controller.js";
import { commercialLeadRateLimit } from "../middleware/commercialLeadRateLimit.js";

export const publicCommercialLeadRouter = Router();

publicCommercialLeadRouter.post("/", commercialLeadRateLimit, publicCommercialLeadController.submit);
