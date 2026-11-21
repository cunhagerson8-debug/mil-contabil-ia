import { rateLimit } from "express-rate-limit";

export const commercialLeadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Muitas solicitações em pouco tempo. Aguarde e tente novamente.",
  },
});
