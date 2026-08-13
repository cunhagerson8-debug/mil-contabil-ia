import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { AuthSession, AuthUser, LoginCredentials, RegisterInput, UserRole } from "./types";
import { realLogin, realRegister, realRequestPasswordReset, AuthError } from "./realAuth";
import { setApiAuthToken } from "../../services/apiClient";

// =============================================================================
// AuthContext
// -----------------------------------------------------------------------------
// Fonte única de verdade da sessão no frontend. Conectado à API real
// (server/) via realAuth.ts — POST /api/auth/login, /api/auth/forgot-password.
// O mock (mockAuth.ts) permanece no projeto apenas como referência histórica
// e para testes offline pontuais; não é mais importado pelo runtime da
// aplicação. A forma dos dados (AuthSession/AuthUser) é idêntica nos dois,
// então nenhum componente que consome useAuth() precisou mudar na troca.
//
// Persistência: sessionStorage (não localStorage) — a sessão sobrevive a
// reloads da aba, mas não é compartilhada entre abas/dispositivos e expira
// ao fechar o navegador, reduzindo a superfície de um token esquecido.
// =============================================================================

const SESSION_STORAGE_KEY = "mil_contabil_ia.session";

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;          // true durante a checagem inicial de sessão persistida
  isSubmitting: boolean;       // true durante login/forgot-password em andamento
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ sent: boolean }>;
  clearError: () => void;
  /** Permissão: o usuário atual pode acessar a seção/feature dada? Ver guards.tsx para a matriz completa. */
  hasRole: (...roles: UserRole[]) => boolean;
  /** O usuário atual pode acessar dados da empresa companyId? (espelha user_company_access) */
  canAccessCompany: (companyId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restaura sessão persistida ao montar (simula "lembrar login" entre reloads)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed: AuthSession = JSON.parse(raw);
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
          setApiAuthToken(parsed.token);
        } else {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newSession = await realLogin(credentials);
      setSession(newSession);
      setApiAuthToken(newSession.token);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Não foi possível entrar. Tente novamente.");
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newSession = await realRegister(input);
      setSession(newSession);
      setApiAuthToken(newSession.token);
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Não foi possível cadastrar. Tente novamente.");
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setApiAuthToken(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await realRequestPasswordReset(email);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => !!session?.user && roles.includes(session.user.role),
    [session]
  );

  const canAccessCompany = useCallback(
    (companyId: string) => {
      const user = session?.user;
      if (!user) return false;
      // firm_owner e accountant SEM carteira restrita (companyAccess vazio/undefined) veem tudo do firm
      if ((user.role === "firm_owner" || user.role === "accountant") && !user.companyAccess?.length) {
        return true;
      }
      return !!user.companyAccess?.includes(companyId);
    },
    [session]
  );

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading,
    isSubmitting,
    error,
    login,
    register,
    logout,
    requestPasswordReset,
    clearError,
    hasRole,
    canAccessCompany,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>.");
  }
  return ctx;
}
