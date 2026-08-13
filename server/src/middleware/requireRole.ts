// =============================================================================
// Middleware: requireRole
// -----------------------------------------------------------------------------
// Defesa em profundidade no lado do servidor: o frontend já filtra navegação
// via architecture/access-control.tsx (SECTION_ACCESS), e o banco já filtra
// dados via RLS. Este middleware é a CAMADA DO MEIO — impede que uma
// requisição HTTP a uma rota administrativa (ex: DELETE /companies/:id)
// sequer chegue na service layer se o role não for permitido, mesmo que
// RLS também bloquearia a query. Três camadas independentes, cada uma
// suficiente por si só.
// =============================================================================
import { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenantContext) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowedRoles.includes(req.tenantContext.role)) {
      next(new ForbiddenError(`Esta ação requer um dos papéis: ${allowedRoles.join(", ")}.`));
      return;
    }
    next();
  };
}
