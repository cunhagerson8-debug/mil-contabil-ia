import React, { useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "./AuthContext";

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const { requestPasswordReset, isSubmitting } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await requestPasswordReset(email);
    if (result.sent) setSent(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
       <div className="flex flex-col items-center mb-8">
  <img
    src="/images/logo-mil-contabil-ia.png"
    alt="MIL Contábil IA"
    className="w-32 h-32 mb-6 drop-shadow-2xl"
  />

  <h1 className="font-black text-slate-900 tracking-tight text-2xl text-center">
    MIL <span className="text-blue-600">Contábil</span>{" "}
    <span className="text-amber-500">IA</span>
  </h1>

  <p className="text-sm text-slate-500 font-medium text-center mt-2">
    Contabilidade Inteligente impulsionada por Inteligência Artificial
  </p>
</div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <button
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 mb-5"
          >
            <ArrowLeft size={14} /> Voltar para o login
          </button>

          {!sent ? (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Recuperar senha</h2>
              <p className="text-sm text-slate-500 mb-6">
                Informe o e-mail da sua conta. Enviaremos um link para redefinir sua senha.
              </p>

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

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Enviando...
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MailCheck size={26} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Verifique seu e-mail</h2>
              <p className="text-sm text-slate-500 mb-6">
                Se houver uma conta associada a <span className="font-bold text-slate-700">{email}</span>, enviamos
                um link de recuperação. Verifique também a caixa de spam.
              </p>
              <button
                onClick={onBackToLogin}
                className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Voltar para o login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Ambiente de demonstração — nenhum e-mail real é enviado.
        </p>
      </div>
    </div>
  );
}
