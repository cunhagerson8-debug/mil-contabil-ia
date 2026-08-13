// =============================================================================
// Controller: Companies
// -----------------------------------------------------------------------------
// Responsabilidade do controller: ler request, validar input (zod),
// delegar para a service, formatar a resposta HTTP. Nenhuma regra de
// negócio mora aqui — isso é exclusivo de services/company.service.ts.
// =============================================================================
import { Request, Response, NextFunction } from "express";
import { companyService } from "../services/company.service.js";
import { createCompanySchema, updateCompanySchema, listCompaniesQuerySchema } from "../validators/company.validators.js";

export const companiesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = listCompaniesQuerySchema.parse(req.query);
      const companies = await companyService.list(req.tenantContext!, filters);
      res.json({ companies });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.getById(req.tenantContext!, req.params.id);
      res.json({ company });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCompanySchema.parse(req.body);
      const company = await companyService.create(req.tenantContext!, input);
      res.status(201).json({ company });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateCompanySchema.parse(req.body);
      const company = await companyService.update(req.tenantContext!, req.params.id, input);
      res.json({ company });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await companyService.remove(req.tenantContext!, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
