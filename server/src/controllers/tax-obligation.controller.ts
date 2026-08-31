import type { Request, Response } from "express";
import { taxObligationService } from "../services/tax-obligation.service.js";

export class TaxObligationController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const ctx = req.tenantContext;

      if (!ctx) {
        res.status(401).json({
          error: "Contexto de autenticação não encontrado.",
        });
        return;
      }

      const obligation = await taxObligationService.create(ctx, req.body);

      res.status(201).json(obligation);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar obrigação fiscal.",
      });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const ctx = req.tenantContext;

      if (!ctx) {
        res.status(401).json({
          error: "Contexto de autenticação não encontrado.",
        });
        return;
      }

      const companyId =
        typeof req.query.companyId === "string"
          ? req.query.companyId
          : undefined;

      const obligations = companyId
        ? await taxObligationService.listByCompany(ctx, companyId)
        : await taxObligationService.listByFirm(ctx);

      res.json(obligations);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao listar obrigações fiscais.",
      });
    }
  }

  async findById(req: Request, res: Response): Promise<void> {
    try {
      const ctx = req.tenantContext;

      if (!ctx) {
        res.status(401).json({
          error: "Contexto de autenticação não encontrado.",
        });
        return;
      }

      const id = req.params.id;

      if (!id) {
        res.status(400).json({
          error: "ID da obrigação é obrigatório.",
        });
        return;
      }

      const obligation = await taxObligationService.findById(ctx, id);

      if (!obligation) {
        res.status(404).json({
          error: "Obrigação fiscal não encontrada.",
        });
        return;
      }

      res.json(obligation);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar obrigação fiscal.",
      });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const ctx = req.tenantContext;

      if (!ctx) {
        res.status(401).json({
          error: "Contexto de autenticação não encontrado.",
        });
        return;
      }

      const id = req.params.id;

      if (!id) {
        res.status(400).json({
          error: "ID da obrigação é obrigatório.",
        });
        return;
      }

      const obligation = await taxObligationService.update(
        ctx,
        id,
        req.body
      );

      if (!obligation) {
        res.status(404).json({
          error: "Obrigação fiscal não encontrada.",
        });
        return;
      }

      res.json(obligation);
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar obrigação fiscal.",
      });
    }
  }
}

export const taxObligationController = new TaxObligationController();