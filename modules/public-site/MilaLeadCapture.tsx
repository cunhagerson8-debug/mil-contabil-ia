import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { submitPublicCommercialLead } from "../../services/publicCommercialLeadApi";

type CommercialLeadInterest = "software_subscription" | "accounting_services" | "both" | "undecided";

const interestOptions: Array<{ value: CommercialLeadInterest; label: string }> = [
  { value: "software_subscription", label: "Assinatura da plataforma" },
  { value: "accounting_services", label: "Serviços contábeis" },
  { value: "both", label: "Plataforma e serviços contábeis" },
  { value: "undecided", label: "Ainda não sei" },
];

interface LeadFormState {
  name: string;
  whatsapp: string;
  email: string;
  serviceInterest: CommercialLeadInterest | "";
  voluntaryDetails: string;
  consent: boolean;
  website: string;
}

const initialForm: LeadFormState = {
  name: "",
  whatsapp: "",
  email: "",
  serviceInterest: "",
  voluntaryDetails: "",
  consent: false,
  website: "",
};

export default function MilaLeadCapture({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof LeadFormState>(
    key: K,
    value: LeadFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.consent || !form.serviceInterest || loading) return;

    setLoading(true);
    setError(null);
    try {
      await submitPublicCommercialLead({
        name: form.name,
        whatsapp: form.whatsapp,
        email: form.email || undefined,
        serviceInterest: form.serviceInterest,
        voluntaryDetails: form.voluntaryDetails || undefined,
        consent: true,
        website: form.website,
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível enviar agora. Tente novamente mais tarde.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <section className="ml-10 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700" aria-live="polite">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-slate-900">Solicitação recebida</p>
            <p className="mt-1 leading-5">
              O servidor confirmou o recebimento. Nossa equipe poderá entrar em contato pelo WhatsApp.
            </p>
            <button type="button" onClick={onClose} className="mt-3 font-bold text-blue-800 hover:underline">
              Concluir
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ml-10 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-[#0b2340]">Solicitar contato</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Informe como podemos falar com você e o assunto do seu interesse.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar formulário de contato"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label>
            Deixe este campo vazio
            <input
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => update("website", event.target.value)}
            />
          </label>
        </div>

        <label className="block text-xs font-bold text-slate-700">
          Nome
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          WhatsApp
          <input
            name="whatsapp"
            type="tel"
            autoComplete="tel"
            required
            maxLength={24}
            value={form.whatsapp}
            onChange={(event) => update("whatsapp", event.target.value)}
            placeholder="(11) 99999-9999"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          E-mail <span className="font-normal text-slate-400">(opcional)</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Interesse
          <select
            name="serviceInterest"
            required
            value={form.serviceInterest}
            onChange={(event) => {
              const selected = interestOptions.find((option) => option.value === event.target.value);
              update("serviceInterest", selected?.value ?? "");
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="" disabled>Selecione uma opção</option>
            {interestOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="block text-xs font-bold text-slate-700">
          Informações adicionais <span className="font-normal text-slate-400">(opcional)</span>
          <textarea
            name="voluntaryDetails"
            rows={3}
            maxLength={500}
            value={form.voluntaryDetails}
            onChange={(event) => update("voluntaryDetails", event.target.value)}
            placeholder="Compartilhe apenas informações comerciais que considerar necessárias."
            className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="flex items-start gap-2 text-xs leading-5 text-slate-600">
          <input
            type="checkbox"
            required
            checked={form.consent}
            onChange={(event) => update("consent", event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
          />
          <span>
            Autorizo o armazenamento destes dados pela MIL Contábil IA e o contato pelo WhatsApp sobre o interesse informado.
          </span>
        </label>

        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">{error}</p>}

        <p className="text-[11px] leading-4 text-slate-500">
          Não informe senhas, documentos, dados bancários ou informações contábeis sigilosas.
        </p>

        <button
          type="submit"
          disabled={loading || !form.consent}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b2340] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#12345a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Enviando..." : "Autorizar e solicitar contato"}
        </button>
      </form>
    </section>
  );
}
