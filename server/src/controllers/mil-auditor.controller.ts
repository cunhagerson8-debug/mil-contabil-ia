import type { Request, Response } from "express";
import { milAuditorService } from "../services/mil-auditor.service.js";

export class MilAuditorController {
  async run(req: Request, res: Response): Promise<void> {
    try {
      const report = await milAuditorService.runAudit(req.tenantContext!);

      res.status(200).json(report);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao executar auditoria da plataforma.",
      });
    }
  }
}

export const milAuditorController = new MilAuditorController();