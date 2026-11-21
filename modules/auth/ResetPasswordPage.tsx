import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";

interface ResetPasswordPageProps {
  token: string;
  onResetComplete: () => void;
  onBackToLogin: () => void;
}

export default function ResetPasswordPage({
  token,
  onResetComplete,
  onBackToLogin,
}: ResetPasswordPageProps) {
  const { logout, resetPassword, isSubmitting } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      await resetPassword(token, password);
      logout();
      setCompleted(true);
      onResetComplete();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível redefinir a senha. Tente novamente mais tarde.",
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/images/logo-mil-contabil-ia.png"
            alt="MIL Contábil IA"
            className="mb-6 h-32 w-32 drop-shadow-2xl"
          />
          <h1 className="text-center text-2xl font-black tracking-tight text-slate-900">
            MIL <span className="text-blue-600">Contábil</span>{" "}
            <span className="text-amber-500">IA</span>
          </h1>
          <p className="mt-2 text-center text-sm font-medium text-slate-500">
            Redefinição segura de senha
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <button
            type="button"
            onClick={onBackToLogin}
            disabled={isSubmitting}
            className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowLeft size={14} /> Voltar para o login
          </button>

          {completed ? (
            <div className="py-4 text-center" role="status" aria-live="polite">
              <CheckCircle2 size={32} className="mx-auto mb-4 text-emerald-600" />
              <h2 className="mb-2 text-lg font-bold text-slate-800">Senha redefinida</h2>
              <p className="mb-6 text-sm leading-6 text-slate-500">
                Sua senha foi atualizada e as sessões anteriores foram invalidadas. Entre novamente com a nova senha.
              </p>
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Ir para o login
              </button>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-lg font-bold text-slate-800">Cadastre uma nova senha</h2>
              <p className="mb-6 text-sm leading-6 text-slate-500">
                Use uma senha com pelo menos 8 caracteres. O link de recuperação é válido por 30 minutos e só pode ser usado uma vez.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-xs font-bold text-slate-600">
                  Nova senha
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <label className="block text-xs font-bold text-slate-600">
                  Confirmar nova senha
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={confirmation}
                    onChange={(event) => {
                      setConfirmation(event.target.value);
                      setError(null);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                {error && (
                  <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isSubmitting ? "Atualizando senha..." : "Redefinir senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
