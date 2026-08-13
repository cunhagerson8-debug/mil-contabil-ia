import { AuthSession, AuthUser, LoginCredentials, RegisterInput } from "./types";
import { apiRequest, ApiError } from "../../services/apiClient";

// =============================================================================
// Serviço de autenticação REAL — substitui mockAuth.ts.
// -----------------------------------------------------------------------------
// Mantém EXATAMENTE a mesma assinatura de funções que mockAuth.ts (mesmos
// nomes exportados teriam sido possíveis, mas optamos por nomes próprios —
// realLogin, realRequestPasswordReset — para deixar explícito no import de
// AuthContext.tsx qual implementação está em uso; ver o comentário lá).
// O formato de retorno (AuthSession) é idêntico, então nenhum componente
// que consome useAuth() precisa mudar.
// =============================================================================

export class AuthError extends Error {}

export async function realLogin({ email, password }: LoginCredentials): Promise<AuthSession> {
  try {
    return await apiRequest<AuthSession>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new AuthError(err.message);
    }
    throw new AuthError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }
}

export async function realRegister(payload: RegisterInput): Promise<AuthSession> {
  try {
    return await apiRequest<AuthSession>("/api/auth/register", {
      method: "POST",
      body: payload,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new AuthError(err.message);
    }
    throw new AuthError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }
}

export async function realRequestPasswordReset(email: string): Promise<{ sent: boolean }> {
  try {
    return await apiRequest<{ sent: boolean }>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new AuthError(err.message);
    }
    throw new AuthError("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }
}

export async function realGetCurrentUser(): Promise<AuthUser | null> {
  try {
    const { user } = await apiRequest<{ user: AuthUser }>("/api/auth/me");
    return user;
  } catch {
    return null;
  }
}
