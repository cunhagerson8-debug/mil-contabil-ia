// =============================================================================
// Middleware: requireAuth
// -----------------------------------------------------------------------------
// Valida o JWT do header Authorization e popula req.tenantContext — usado
// por TODAS as rotas autenticadas para montar o TenantContext que
// withTenantContext() exige. Sem este middleware, nenhuma rota de negócio
// tem como saber app.current_firm_id / app.current_user_id / app.current_role.
// =============================================================================
import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/errors.js";
import { TenantContext } from "../db/withTenantContext.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(new UnauthorizedError("Token de autenticação ausente."));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = authService.verifyToken(token);
    req.tenantContext = {
      userId: payload.sub,
      firmId: payload.firmId,
      role: payload.role,
    };
    next();
  } catch {
    next(new UnauthorizedError("Token inválido ou expirado."));
  }
}
