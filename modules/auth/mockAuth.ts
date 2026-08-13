import { AuthSession, AuthUser, LoginCredentials } from "./types";
import { mockUsers, MOCK_PASSWORD } from "./mockUsers";

// =============================================================================
// Serviço de autenticação mock.
// -----------------------------------------------------------------------------
// Simula latência de rede e os mesmos formatos de erro que a API real
// devolveria, para que a troca por chamadas HTTP reais (fetch/axios para
// /auth/login, /auth/forgot-password etc.) não exija mudar a forma dos dados
// consumidos pelos componentes — apenas a implementação destas funções.
// =============================================================================

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeToken(userId: string) {
  return `mock.${userId}.${Date.now()}`;
}

export class AuthError extends Error {}

export async function mockLogin({ email, password }: LoginCredentials): Promise<AuthSession> {
  await delay(700);

  const user = mockUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    throw new AuthError("E-mail ou senha incorretos.");
  }
  if (user.status === "suspended") {
    throw new AuthError("Esta conta está suspensa. Contate o administrador do escritório.");
  }
  if (user.status === "deactivated") {
    throw new AuthError("Esta conta foi desativada.");
  }
  if (password !== MOCK_PASSWORD) {
    throw new AuthError("E-mail ou senha incorretos.");
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(); // 8h
  return {
    user: { ...user, lastLoginAt: new Date().toISOString() },
    token: makeToken(user.id),
    expiresAt,
  };
}

export async function mockRequestPasswordReset(email: string): Promise<{ sent: boolean }> {
  await delay(900);
  // Por segurança, não revelamos se o e-mail existe ou não — mesma resposta em ambos os casos.
  return { sent: true };
}

export async function mockGetUserByToken(token: string): Promise<AuthUser | null> {
  await delay(150);
  const userId = token.split(".")[1];
  return mockUsers.find((u) => u.id === userId) ?? null;
}
