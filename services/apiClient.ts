// =============================================================================
// Cliente HTTP genérico para a API do MIL Contábil IA.
// -----------------------------------------------------------------------------
// Ponto único de integração com o backend (server/). Centraliza:
//   * Base URL (configurável via VITE_API_URL, default localhost:4000)
//   * Injeção do header Authorization a partir do token de sessão
//   * Normalização de erros: a API sempre responde { error: string } em
//     falhas — aqui isso é traduzido para um Error JS comum, que os
//     serviços de cada módulo (authApi.ts, companiesApi.ts etc.) só
//     precisam deixar propagar.
// =============================================================================

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL ?? window.location.origin;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let authToken: string | null = null;

/** Chamado pelo AuthContext sempre que a sessão muda (login/logout/restore). */
export function setApiAuthToken(token: string | null): void {
  authToken = token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? `Erro na requisição (HTTP ${response.status}).`, response.status);
  }

  return data as T;
}
