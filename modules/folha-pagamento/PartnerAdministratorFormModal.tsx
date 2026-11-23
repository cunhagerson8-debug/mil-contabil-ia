import React, { useState } from "react";
import { AlertCircle, Sparkles, X } from "lucide-react";
import type { Company } from "../empresas/types";
import {
  normalizePartnerName,
  parsePartnerInstruction,
  type PartnerAdministratorDraft,
  type PartnerPaymentStatus,
  type PartnerWithdrawalStatus,
} from "./partnerIntake";
import { formatCpf, isValidCpf } from "./employeeValidation";

interface PartnerAdministratorFormModalProps {
  companies: Company[];
  defaultCompanyId?: string;
  onClose: () => void;
  onDraftCreated: (draft: PartnerAdministratorDraft) => void;
}

interface PartnerFormState {
  companyId: string;
  name: string;
  cpf: string;
  participation: string;
  isAdministrator: boolean | null;
  isSoleShareholder: boolean | null;
  competence: string;
  withdrawalStatus: PartnerWithdrawalStatus;
  proLaboreAmount: string;
  paymentStatus: PartnerPaymentStatus;
}

const inputClass = "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

function initialForm(companyId = ""): PartnerFormState {
  return {
    companyId,
    name: "",
    cpf: "",
    participation: "",
    isAdministrator: null,
    isSoleShareholder: null,
    competence: "",
    withdrawalStatus: "not_reported",
    proLaboreAmount: "",
    paymentStatus: "not_reported",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

export default function PartnerAdministratorFormModal({
  companies,
  defaultCompanyId,
  onClose,
  onDraftCreated,
}: PartnerAdministratorFormModalProps) {
  const [form, setForm] = useState(() => initialForm(defaultCompanyId));
  const [instruction, setInstruction] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [previewStep, setPreviewStep] = useState(false);

  function update<K extends keyof PartnerFormState>(key: K, value: PartnerFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function prepareFromInstruction() {
    if (!instruction.trim()) {
      setMessage("Escreva uma instrução antes de preparar o rascunho.");
      return;
    }

    const extraction = parsePartnerInstruction(instruction);
    const values = extraction.values;
    const nextForm = initialForm(form.companyId);
    const nextWarnings = [...extraction.warnings];

    if (values.companyName !== undefined) {
      const requestedCompany = normalizePartnerName(values.companyName);
      const matchesById = new Map(
        companies
          .filter((company) =>
            normalizePartnerName(company.nomeFantasia) === requestedCompany
            || normalizePartnerName(company.razaoSocial) === requestedCompany
          )
          .map((company) => [company.id, company])
      );
      const matches = Array.from(matchesById.values());
      if (matches.length === 1) nextForm.companyId = matches[0].id;
      else {
        nextForm.companyId = "";
        nextWarnings.push(matches.length
          ? "Empresa ambígua; selecione uma das empresas autorizadas."
          : "Empresa não localizada nas empresas autorizadas; selecione-a manualmente.");
      }
    }

    if (values.name !== undefined) nextForm.name = values.name;
    if (values.cpf !== undefined) nextForm.cpf = formatCpf(values.cpf);
    if (values.participation !== undefined) nextForm.participation = String(values.participation);
    if (values.isAdministrator !== undefined) nextForm.isAdministrator = values.isAdministrator;
    if (values.isSoleShareholder !== undefined) nextForm.isSoleShareholder = values.isSoleShareholder;
    if (values.competence !== undefined) nextForm.competence = values.competence;
    if (values.withdrawalStatus !== undefined) nextForm.withdrawalStatus = values.withdrawalStatus;
    if (values.proLaboreAmount !== undefined) nextForm.proLaboreAmount = String(values.proLaboreAmount);
    if (values.paymentStatus !== undefined) nextForm.paymentStatus = values.paymentStatus;

    setForm(nextForm);
    setWarnings(nextWarnings);
    setMessage(
      `${Object.keys(values).length} campo(s) reconhecido(s) localmente. Confira e complete os dados ausentes.`
    );
    setPreviewStep(false);
    setError(null);
  }

  function getMissingFields(): string[] {
    const missing: string[] = [];
    if (!form.companyId) missing.push("Empresa autorizada");
    if (form.name.trim().length < 2) missing.push("Nome completo");
    if (!isValidCpf(form.cpf)) missing.push("CPF válido");
    if (form.isAdministrator !== true) missing.push("Confirmação de administrador da empresa");
    if (form.isSoleShareholder === null) missing.push("Indicação se é sócio único");
    const participation = Number(form.participation.replace(",", "."));
    if (!form.participation || !Number.isFinite(participation) || participation < 0 || participation > 100) {
      missing.push("Participação societária entre 0 e 100%");
    }
    if (form.withdrawalStatus !== "not_reported" && !form.competence) {
      missing.push("Competência do pró-labore");
    }
    if (form.withdrawalStatus === "amount_reported") {
      const amount = Number(form.proLaboreAmount.replace(",", "."));
      if (!form.proLaboreAmount || !Number.isFinite(amount) || amount <= 0) {
        missing.push("Valor de pró-labore informado");
      }
      if (form.paymentStatus === "not_applicable") missing.push("Situação de pagamento aplicável");
    }
    return missing;
  }

  function validate(): string | null {
    const missing = getMissingFields();
    if (missing.length) return `Complete ou revise: ${missing.join(", ")}.`;
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      setPreviewStep(false);
      return;
    }

    if (!previewStep) {
      setPreviewStep(true);
      return;
    }

    const company = companies.find((item) => item.id === form.companyId);
    if (!company) {
      setError("A empresa selecionada não está mais disponível nas empresas autorizadas.");
      setPreviewStep(false);
      return;
    }

    const amount = form.proLaboreAmount
      ? Number(form.proLaboreAmount.replace(",", "."))
      : null;
    onDraftCreated({
      companyId: form.companyId,
      companyName: company.nomeFantasia || company.razaoSocial,
      name: form.name.trim(),
      cpf: form.cpf.replace(/\D/g, ""),
      isAdministrator: true,
      isSoleShareholder: form.isSoleShareholder === true,
      participation: Number(form.participation.replace(",", ".")),
      competence: form.competence || null,
      withdrawalStatus: form.withdrawalStatus,
      proLaboreAmount: form.withdrawalStatus === "amount_reported" ? amount : null,
      paymentStatus: form.withdrawalStatus === "none_declared"
        ? "not_applicable"
        : form.paymentStatus,
    });
  }

  const selectedCompany = companies.find((company) => company.id === form.companyId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-form-title"
        onSubmit={handleSubmit}
        className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-7">
          <div>
            <h2 id="partner-form-title" className="text-lg font-bold text-slate-900">
              {previewStep ? "Revisar sócio-administrador" : "Novo sócio-administrador"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Rascunho local; ainda não será enviado nem salvo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar formulário" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {previewStep ? (
            <section className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800">Prévia para aprovação humana</h3>
                <p className="mt-1 text-sm text-slate-500">A confirmação manterá este rascunho apenas na memória desta sessão.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <PreviewRow label="Empresa" value={selectedCompany?.nomeFantasia || selectedCompany?.razaoSocial || ""} />
                <PreviewRow label="Nome" value={form.name} />
                <PreviewRow label="CPF" value={formatCpf(form.cpf)} />
                <PreviewRow label="Administrador da empresa" value={form.isAdministrator ? "Sim" : "Não"} />
                <PreviewRow label="Sócio único" value={form.isSoleShareholder === null ? "Não informado" : form.isSoleShareholder ? "Sim" : "Não"} />
                <PreviewRow label="Participação informada" value={`${form.participation}%`} />
                <PreviewRow label="Competência do pró-labore" value={form.competence || "Não informada"} />
                <PreviewRow label="Situação da retirada" value={withdrawalStatusLabels[form.withdrawalStatus]} />
                <PreviewRow label="Valor informado" value={form.withdrawalStatus === "amount_reported" ? formatCurrency(Number(form.proLaboreAmount.replace(",", "."))) : "Não informado"} />
                <PreviewRow label="Situação de pagamento" value={paymentStatusLabels[form.withdrawalStatus === "none_declared" ? "not_applicable" : form.paymentStatus]} />
              </div>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                “Não informado” não significa ausência de retirada nem ausência de obrigação previdenciária. Esta tela não calcula obrigações, não transmite eventos e não executa pagamentos.
              </p>
            </section>
          ) : (
            <>
              <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div>
                  <h3 className="text-sm font-bold text-blue-900">Assistente de cadastro — processamento local</h3>
                  <p className="mt-1 text-xs text-blue-800">
                    Reconhece rótulos explícitos neste navegador. Não envia a instrução ao chat MIL IA/Gemini.
                  </p>
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  Instrução
                  <textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    maxLength={3000}
                    rows={4}
                    placeholder="Empresa: [empresa autorizada]; perfil: sócio único e administrador; nome: [nome]; CPF: [CPF]; participação: [percentual]; competência: MM/AAAA; pró-labore: não informado"
                    className={inputClass}
                  />
                </label>
                <button type="button" onClick={prepareFromInstruction} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                  <Sparkles size={15} /> Preparar rascunho local
                </button>
                {message && <p role="status" className="text-xs font-semibold text-blue-900">{message}</p>}
                {warnings.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">
                    {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                )}
                {message && (
                  <p className="rounded-lg border border-blue-200 bg-white/70 p-3 text-xs text-slate-700">
                    <strong>Dados necessários ainda ausentes:</strong>{" "}
                    {getMissingFields().length ? getMissingFields().join(", ") : "nenhum. Revise todos os campos antes da prévia."}
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Dados societários</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Empresa autorizada">
                    <select required value={form.companyId} onChange={(event) => update("companyId", event.target.value)} className={inputClass}>
                      <option value="">Selecione uma empresa</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.nomeFantasia || company.razaoSocial}</option>)}
                    </select>
                  </Field>
                  <Field label="Nome completo">
                    <input required minLength={2} maxLength={160} value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="CPF">
                    <input required inputMode="numeric" autoComplete="off" value={formatCpf(form.cpf)} onChange={(event) => update("cpf", formatCpf(event.target.value))} className={inputClass} />
                  </Field>
                  <Field label="Participação societária (%)">
                    <input required type="number" min="0" max="100" step="0.01" value={form.participation} onChange={(event) => update("participation", event.target.value)} className={inputClass} />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Informe o percentual confirmado; “sócio único” não preenche automaticamente 100%.</span>
                  </Field>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold text-slate-700">Administrador da empresa?</legend>
                    <RadioChoice name="administrator" value="yes" checked={form.isAdministrator === true} onChange={() => update("isAdministrator", true)} label="Sim, administrador" />
                    <RadioChoice name="administrator" value="no" checked={form.isAdministrator === false} onChange={() => update("isAdministrator", false)} label="Não" />
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold text-slate-700">É sócio único?</legend>
                    <RadioChoice name="sole-shareholder" value="yes" checked={form.isSoleShareholder === true} onChange={() => update("isSoleShareholder", true)} label="Sim" />
                    <RadioChoice name="sole-shareholder" value="no" checked={form.isSoleShareholder === false} onChange={() => update("isSoleShareholder", false)} label="Não" />
                  </fieldset>
                </div>
              </section>

              <section>
                <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Pró-labore — informação declarada</h3>
                <p className="mb-3 text-xs text-slate-600">
                  Nenhum valor ou competência é presumido. Registrar ausência de retirada não conclui ausência de obrigação previdenciária.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Situação da retirada">
                    <select value={form.withdrawalStatus} onChange={(event) => {
                      const status = event.target.value as PartnerWithdrawalStatus;
                      setForm((current) => ({
                        ...current,
                        withdrawalStatus: status,
                        proLaboreAmount: status === "amount_reported" ? current.proLaboreAmount : "",
                        paymentStatus: status === "none_declared" ? "not_applicable" : current.paymentStatus,
                      }));
                    }} className={inputClass}>
                      <option value="not_reported">Não informado</option>
                      <option value="none_declared">Sem retirada declarada</option>
                      <option value="amount_reported">Valor informado</option>
                    </select>
                  </Field>
                  <Field label="Competência">
                    <input type="month" value={form.competence} onChange={(event) => update("competence", event.target.value)} className={inputClass} />
                  </Field>
                  {form.withdrawalStatus === "amount_reported" && (
                    <>
                      <Field label="Valor de pró-labore informado">
                        <input required type="number" min="0.01" step="0.01" value={form.proLaboreAmount} onChange={(event) => update("proLaboreAmount", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Situação de pagamento">
                        <select value={form.paymentStatus} onChange={(event) => update("paymentStatus", event.target.value as PartnerPaymentStatus)} className={inputClass}>
                          <option value="not_reported">Não informado</option>
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago (informação declarada)</option>
                        </select>
                      </Field>
                    </>
                  )}
                  {form.withdrawalStatus === "none_declared" && (
                    <p className="self-end text-xs text-slate-500">Pagamento: não aplicável para retirada declarada como inexistente nesta competência.</p>
                  )}
                </div>
              </section>

              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Rascunho temporário apenas nesta sessão. Ainda não há API autorizada para persistir sócios ou pró-labore; recarregar ou fechar descarta os dados.
              </p>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
          {previewStep && (
            <button type="button" onClick={() => setPreviewStep(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Voltar para edição
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
            {previewStep ? "Confirmar rascunho local" : "Revisar prévia"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RadioChoice({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-normal text-slate-700">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="break-words text-sm font-semibold text-slate-800">{value || "Não informado"}</p>
    </div>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const withdrawalStatusLabels: Record<PartnerWithdrawalStatus, string> = {
  not_reported: "Não informado",
  none_declared: "Sem retirada declarada",
  amount_reported: "Valor informado",
};

const paymentStatusLabels: Record<PartnerPaymentStatus, string> = {
  not_reported: "Não informado",
  pending: "Pendente (informação declarada)",
  paid: "Pago (informação declarada)",
  not_applicable: "Não aplicável",
};
