
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { certificateService } from "../services/certificate.service.js";

const createCertificateSchema = z.object({
  companyId: z.string().uuid(),
  titular: z.string().trim().min(1),
  cnpj: z.string().regex(/^\d{14}$/),
  vaultReference: z.string().trim().min(1),
  validFrom: z.string().date(),
  validUntil: z.string().date(),
}).refine(
  (data) => data.validUntil >= data.validFrom,
  {
    message: "A validade final deve ser igual ou posterior à inicial.",
    path: ["validUntil"],
  }
);

export const certificateController = {
  async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const input = createCertificateSchema.parse(req.body);

      const certificate = await certificateService.create(
        req.tenantContext!,
        input
      );

      res.status(201).json({ certificate });
    } catch (err) {
      next(err);
    }
  },
};
