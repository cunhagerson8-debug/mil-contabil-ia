// =============================================================================
// Routes: /api/companies
// -----------------------------------------------------------------------------
// Apenas mapeamento método HTTP + path -> controller, com os middlewares de
// autenticação/autorização aplicados. Nenhuma lógica de validação, negócio
// ou acesso a dados mora aqui — ver controllers/company.controller.ts,
// services/company.service.ts e repositories/company.repository.ts.
// =============================================================================
import { Router } from "express";
import { companiesController } from "../controllers/company.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const companiesRouter = Router();
companiesRouter.use(requireAuth);

// Leitura: qualquer role autenticado pode chamar — RLS já filtra o que cada
// um efetivamente vê (companies_select_firm_scoped em 011_row_level_security.sql).
companiesRouter.get("/", companiesController.list);
companiesRouter.get("/:id", companiesController.getById);

// Escrita: firm_owner ou accountant (espelha companies_insert_firm_scoped /
// companies_update_firm_scoped).
companiesRouter.post("/", requireRole("platform_admin", "firm_owner", "accountant"), companiesController.create);
companiesRouter.put("/:id", requireRole("platform_admin", "firm_owner", "accountant"), companiesController.update);

// Exclusão: apenas firm_owner (espelha companies_delete_firm_owner_only).
companiesRouter.delete("/:id", requireRole("platform_admin", "firm_owner"), companiesController.remove);
