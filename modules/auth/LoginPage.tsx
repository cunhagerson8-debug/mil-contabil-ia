import React, { useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "./AuthContext";
import { mockUsers, MOCK_PASSWORD } from "./mockUsers";
import { ROLE_LABELS } from "./types";

interface LoginPageProps {
  onForgotPassword: () => void;
  onRegister: () => void;
}

export default function LoginPage({ onForgotPassword, onRegister }: LoginPageProps) {
  const { login, isSubmitting, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login({ email, password });
    } catch {
      // erro já fica disponível via context (error) — sem necessidade de tratamento aqui
    }
  }

  function fillDemoUser(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(MOCK_PASSWORD);
    setShowDemoPanel(false);
  }

  return (
   <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
  <div className="w-full max-w-md">

    {/* Logo */}
    <div className="flex flex-col items-center mb-8">

      <img
  src="/images/logo-mil-contabil-ia.png"
  alt="MIL Contábil IA"
  style={{
    width: "180px",
    marginBottom: "20px",
    display: "block",
  }}
/>

      <h1 className="font-black text-slate-900 tracking-tight text-2xl text-center">
        MIL <span className="text-blue-600">Contábil</span>{" "}
        <span className="text-amber-500">IA</span>
      </h1>

      <p className="text-sm text-slate-500 font-medium tracking-wide text-center mt-2">
        Contabilidade Inteligente impulsionada por Inteligência Artificial
      </p>

    </div>

    {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Entrar na plataforma</h2>
          <p className="text-sm text-slate-500 mb-6">Acesse sua conta para continuar</p>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@escritorio.com.br"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={onRegister}
              className="text-sm font-bold text-blue-600 hover:text-blue-800"
            >
              Criar conta e iniciar cadastro do escritório
            </button>
          </div>

          {/* Demo / mock auth helper panel */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDemoPanel((s) => !s)}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              <ShieldCheck size={14} />
              {showDemoPanel ? "Ocultar contas de demonstração" : "Ver contas de demonstração (mock)"}
            </button>

            {showDemoPanel && (
              <div className="mt-4 space-y-2">
                {mockUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => fillDemoUser(u.email)}
                    className="w-full text-left flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-700">{u.fullName}</p>
                      <p className="text-[10px] text-slate-400">{u.email}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-blue-50 text-blue-700 shrink-0 ml-2">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </button>
                ))}
                <p className="text-[10px] text-slate-400 text-center pt-1">
                  Senha de demonstração para todas as contas: <code className="font-mono font-bold">{MOCK_PASSWORD}</code>
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Ambiente de demonstração — autenticação mock, sem dados reais.
        </p>
      </div>
    </div>
  );
}
