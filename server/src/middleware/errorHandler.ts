// =============================================================================
// Middleware: errorHandler
// -----------------------------------------------------------------------------
// Único lugar que traduz erros de domínio (utils/errors.ts) para status
// HTTP. Rotas e services nunca chamam res.status() diretamente para casos
// de erro — apenas lançam o erro de domínio apropriado e deixam isto aqui
// decidir o código HTTP, garantindo consistência em toda a API.
// =============================================================================
import { Request, Response, NextFunction } from "express";
import {
  NotFoundError, ConflictError, ValidationError, UnauthorizedError, ForbiddenError,
} from "../utils/errors.js";
import { env } from "../config/env.js";

const STATUS_BY_ERROR_NAME: Record<string, number> = {
  NotFoundError: 404,
  ConflictError: 409,
  ValidationError: 400,
  UnauthorizedError: 401,
  ForbiddenError: 403,
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const error = err as Error & { code?: string };

  // Erros de constraint do Postgres que escaparam da validação da service
  // (ex: corrida entre duas requisições simultâneas criando o mesmo CNPJ)
  // — traduzidos para 409 em vez de virar um 500 genérico.
  if (error.code === "23505") {
    res.status(409).json({ error: "Já existe um registro com esses dados (violação de unicidade)." });
    return;
  }

  const status = STATUS_BY_ERROR_NAME[error.name] ?? 500;

  if (status === 500) {
    // eslint-disable-next-line no-console
    if (error instanceof Error) {
  console.error(
    `[erro não tratado] ${req.method} ${req.path}: ${error.message}`
  );
  console.error(error.stack);
} else {
  console.error(
    `[erro não tratado] ${req.method} ${req.path}:`,
    String(error)
  );
}
  }

  res.status(status).json({
    error: status === 500 ? "Erro interno do servidor." : error.message,
    // stack trace só em desenvolvimento — nunca expor detalhes internos em produção
    ...(env.nodeEnv === "development" && status === 500 ? { stack: error.stack } : {}),
  });
}
