// =============================================================================
// Controller: Clients
// =============================================================================
import { Request, Response, NextFunction } from "express";
import { clientService } from "../services/client.service.js";
import { createClientSchema, updateClientSchema, listClientsQuerySchema } from "../validators/client.validators.js";

export const clientsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = listClientsQuerySchema.parse(req.query);
      const clients = await clientService.list(req.tenantContext!, filters);
      res.json({ clients });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await clientService.getById(req.tenantContext!, req.params.id);
      res.json({ client });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createClientSchema.parse(req.body);
      const client = await clientService.create(req.tenantContext!, input);
      res.status(201).json({ client });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateClientSchema.parse(req.body);
      const client = await clientService.update(req.tenantContext!, req.params.id, input);
      res.json({ client });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clientService.remove(req.tenantContext!, req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
