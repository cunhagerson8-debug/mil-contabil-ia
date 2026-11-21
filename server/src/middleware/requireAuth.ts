// =============================================================================
// Middleware: requireAuth
// -----------------------------------------------------------------------------
// Valida o JWT do header Authorization e popula req.tenantContext — usado
// por TODAS as rotas autenticadas para montar o TenantContext que
// withTenantContext() exige. Sem este middleware, nenhuma rota de negócio
// pode obter o contexto autenticado.
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
  let payload: ReturnType<typeof authService.verifyToken>;
  try {
    payload = authService.verifyToken(token);
  } catch {
    next(new UnauthorizedError("Token inválido ou expirado."));
    return;
  }

  void authService.getUserById(payload.sub, payload.firmId, payload.role, payload.sessionVersion).then((user) => {
    if (!user || user.status !== "active") {
      next(new UnauthorizedError("A sessão não é mais válida."));
      return;
    }

    req.tenantContext = {
      userId: user.id,
      firmId: user.firmId,
      role: user.role,
      hrPermissions: user.hrPermissions,
    };
    next();
  }).catch((error: unknown) => next(error));
}
