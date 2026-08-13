import React, { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { RegisterInput } from "./types";

interface RegisterPageProps {
  onBackToLogin: () => void;
}

const initialForm: RegisterInput = {
  firm: {
    name: "",
    tradeName: "",
    cnpj: "",
    email: "",
    phone: "",
    timezone: "America/Sao_Paulo",
  },
  admin: {
    fullName: "",
    email: "",
    password: "",
    phone: "",
  },
};

export default function RegisterPage({ onBackToLogin }: RegisterPageProps) {
  const { register, isSubmitting, error, clearError } = useAuth();
  const [form, setForm] = useState<RegisterInput>(initialForm);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    clearError();
    try {
      await register(form);
    } catch {
      // o erro já fica disponível no context
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
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
            Cadastre seu escritório e crie o primeiro administrador.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <button
            onClick={onBackToLogin}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 mb-5"
          >
            <ArrowLeft size={14} /> Voltar para o login
          </button>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-3">Dados do escritório</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome do escritório</span>
                  <input
                    type="text"
                    required
                    value={form.firm.name}
                    onChange={(e) => setForm({ ...form, firm: { ...form.firm, name: e.target.value } })}
                    placeholder="Nome do escritório"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CNPJ</span>
                  <input
                    type="text"
                    required
                    value={form.firm.cnpj}
                    onChange={(e) => setForm({ ...form, firm: { ...form.firm, cnpj: e.target.value } })}
                    placeholder="00.000.000/0000-00"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail do escritório</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.firm.email}
                    onChange={(e) => setForm({ ...form, firm: { ...form.firm, email: e.target.value } })}
                    placeholder="contato@escritorio.com"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone</span>
                  <input
                    type="tel"
                    value={form.firm.phone}
                    onChange={(e) => setForm({ ...form, firm: { ...form.firm, phone: e.target.value } })}
                    placeholder="(11) 99999-9999"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-3">Dados do administrador</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome completo</span>
                  <input
                    type="text"
                    required
                    value={form.admin.fullName}
                    onChange={(e) => setForm({ ...form, admin: { ...form.admin, fullName: e.target.value } })}
                    placeholder="Nome do administrador"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.admin.email}
                    onChange={(e) => setForm({ ...form, admin: { ...form.admin, email: e.target.value } })}
                    placeholder="admin@escritorio.com"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha</span>
                  <div className="relative mt-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={form.admin.password}
                      onChange={(e) => setForm({ ...form, admin: { ...form.admin, password: e.target.value } })}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone</span>
                  <input
                    type="tel"
                    value={form.admin.phone}
                    onChange={(e) => setForm({ ...form, admin: { ...form.admin, phone: e.target.value } })}
                    placeholder="(11) 98888-8888"
                    className="mt-2 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Cadastrando...
                </>
              ) : (
                "Cadastrar meu escritório"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Após registrar, você será autenticado automaticamente e levado ao dashboard.
        </p>
      </div>
    </div>
  );
}
