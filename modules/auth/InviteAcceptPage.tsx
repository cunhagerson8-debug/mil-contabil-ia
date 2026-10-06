import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { InvitationInfo, realAcceptInvitation, realValidateInvitation } from "./realAuth";

interface InviteAcceptPageProps {
  token: string;
  onAccepted: () => void;
  onCancel: () => void;
}

export default function InviteAcceptPage({ token, onAccepted, onCancel }: InviteAcceptPageProps) {
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    realValidateInvitation(token)
      .then((info) => { if (!cancelled) setInvitation(info); })
      .catch((err: Error) => { if (!cancelled) setLoadError(err.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password.length < 8) {
      setFormError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password.length > 72) {
      setFormError("A senha deve ter no máximo 72 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFormError("A confirmação de senha não confere.");
      return;
    }
    setIsSubmitting(true);
    try {
      await realAcceptInvitation(token, password);
      onAccepted();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400";
  const labelClass = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/images/logo-mil-contabil-ia.png" alt="MIL Contábil IA" style={{ width: "180px", marginBottom: "20px", display: "block" }} />
          <h1 className="font-black text-slate-900 tracking-tight text-2xl text-center">
            MIL <span className="text-blue-600">Contábil</span> <span className="text-amber-500">IA</span>
          </h1>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Validando convite...
            </div>
          )}

          {!isLoading && loadError && (
            <div>
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
              >
                Ir para o login
              </button>
            </div>
          )}

          {!isLoading && invitation && (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Aceitar convite</h2>
              <p className="text-sm text-slate-500 mb-5">
                Olá, <span className="font-bold text-slate-700">{invitation.fullName}</span>! Crie uma senha para ativar seu acesso
                {invitation.firmName ? <> ao escritório <span className="font-bold text-slate-700">{invitation.firmName}</span></> : null}.
              </p>
              <p className="text-xs text-slate-400 mb-5">Conta: {invitation.email}</p>

              {formError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{formError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Nova senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      className={inputClass}
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
                <div>
                  <label className={labelClass}>Confirmar senha</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (<><Loader2 size={16} className="animate-spin" /> Ativando...</>) : "Aceitar convite"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
