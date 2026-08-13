// =============================================================================
// Erros de domínio — services lançam estes erros; o middleware de erro
// (middleware/errorHandler.ts) os traduz para status HTTP corretos. Isso
// mantém a service layer livre de qualquer conhecimento de HTTP/Express.
// =============================================================================

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} com id "${id}" não encontrado(a).`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Não autorizado.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Acesso negado para este recurso.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
