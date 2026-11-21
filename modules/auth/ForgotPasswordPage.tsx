import React, { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export default function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const { requestPasswordReset, isSubmitting } = useAuth();
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await requestPasswordReset(email);
      if (result.accepted) setAccepted(true);
      else setError("Não foi possível registrar a solicitação. Tente novamente mais tarde.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível registrar a solicitação. Tente novamente mais tarde.",
      );
    }
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

          {!accepted ? (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Recuperar senha</h2>
              <p className="text-sm text-slate-500 mb-6">
                Informe o e-mail usado na plataforma. Se houver uma conta associada, um link poderá ser enviado após o processamento.
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="seu.email@escritorio.com.br"
                    maxLength={254}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-800">
                    {error}
                  </p>
                )}

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
            <div className="text-center py-4" role="status" aria-live="polite">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <CheckCircle2 size={26} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-2">Solicitação recebida</h2>
              <p className="text-sm text-slate-500 mb-6">
                Se houver uma conta associada a este endereço, um link poderá ser enviado após o processamento.
                Se não receber instruções, verifique a caixa de spam ou tente novamente mais tarde.
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
          Por segurança, não informamos se um e-mail possui cadastro na plataforma.
        </p>
      </div>
    </div>
  );
}
