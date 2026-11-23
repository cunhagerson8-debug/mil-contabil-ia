import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, Sparkles, X } from "lucide-react";
import type { Company } from "../empresas/types";
import { ApiError } from "../../services/apiClient";
import {
  employeesApi,
  type Employee,
  type EmployeeCreateInput,
  type EmployeeDepartment,
  type EmployeeStatus,
  type EmployeeUpdateInput,
} from "../../services/employeesApi";
import {
  normalizeEmployeeIntakeText,
  parseEmployeeInstruction,
} from "./employeeIntake";
import { formatCpf, isValidCpf } from "./employeeValidation";

interface FormState {
  companyId: string;
  departmentId: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  jobTitle: string;
  registration: string;
  admissionDate: string;
  terminationDate: string;
  salary: string;
  employmentType: string;
  status: EmployeeStatus | "";
}

interface EmployeeFormModalProps {
  companies: Company[];
  initialEmployee?: Employee;
  defaultCompanyId?: string;
  canChangeAssignment: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const employmentTypes = [
  { value: "clt", label: "CLT" },
  { value: "internship", label: "Estágio" },
  { value: "apprentice", label: "Aprendiz" },
  { value: "temporary", label: "Temporário" },
  { value: "contractor", label: "Pessoa jurídica" },
];

const statusOptions: Array<{ value: Employee["status"]; label: string }> = [
  { value: "active", label: "Ativo" },
  { value: "leave", label: "Afastado" },
  { value: "vacation", label: "Férias" },
  { value: "terminated", label: "Desligado" },
];

const employmentTypeLabels: Record<string, string> = Object.fromEntries(
  employmentTypes.map((option) => [option.value, option.label])
);

const statusLabels: Record<EmployeeStatus, string> = {
  active: "Ativo",
  leave: "Afastado",
  vacation: "Férias",
  terminated: "Desligado",
};

function initialForm(employee?: Employee, defaultCompanyId = ""): FormState {
  return {
    companyId: employee?.company_id ?? defaultCompanyId,
    departmentId: employee?.department_id ?? "",
    name: employee?.name ?? "",
    cpf: employee?.cpf ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    jobTitle: employee?.job_title ?? "",
    registration: employee?.registration ?? "",
    admissionDate: employee?.admission_date?.slice(0, 10) ?? "",
    terminationDate: employee?.termination_date?.slice(0, 10) ?? "",
    salary: employee?.salary == null ? "" : String(employee.salary),
    employmentType: employee?.employment_type ?? "clt",
    status: employee?.status ?? "active",
  };
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-slate-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}

const inputClass = "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function EmployeeFormModal({
  companies,
  initialEmployee,
  defaultCompanyId,
  canChangeAssignment,
  onClose,
  onSaved,
}: EmployeeFormModalProps) {
  const editing = !!initialEmployee;
  const [form, setForm] = useState(() => initialForm(initialEmployee, defaultCompanyId));
  const [departments, setDepartments] = useState<EmployeeDepartment[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantMode, setAssistantMode] = useState(false);
  const [assistantInstruction, setAssistantInstruction] = useState("");
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [assistantWarnings, setAssistantWarnings] = useState<string[]>([]);
  const [previewStep, setPreviewStep] = useState(false);

  useEffect(() => {
    if (!form.companyId) {
      setDepartments([]);
      return;
    }

    let active = true;
    setDepartmentsLoading(true);
    setDepartmentError(null);
    employeesApi.listDepartments(form.companyId)
      .then((result) => {
        if (active) setDepartments(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setDepartmentError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar os departamentos desta empresa."
          );
        }
      })
      .finally(() => {
        if (active) setDepartmentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.companyId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleCompanyChange(companyId: string) {
    setForm((current) => ({ ...current, companyId, departmentId: "" }));
  }

  function enableLocalAssistant() {
    setAssistantMode(true);
    setPreviewStep(false);
    setAssistantMessage(null);
    setAssistantWarnings([]);
    setForm((current) => ({ ...current, employmentType: "", status: "" }));
  }

  function prepareFromInstruction() {
    if (!assistantInstruction.trim()) {
      setAssistantMessage("Escreva uma instrução antes de preparar o rascunho.");
      return;
    }

    const extraction = parseEmployeeInstruction(assistantInstruction);
    const extractedValues = { ...extraction.values };
    const nextForm: Partial<FormState> = {
      departmentId: "",
      name: "",
      cpf: "",
      email: "",
      phone: "",
      jobTitle: "",
      registration: "",
      admissionDate: "",
      terminationDate: "",
      salary: "",
      employmentType: "",
      status: "",
    };
    const warnings = [...extraction.warnings];

    if (extractedValues.companyName !== undefined) {
      const requestedCompany = normalizeEmployeeIntakeText(extractedValues.companyName);
      const matchesById = new Map(
        companies
          .filter((company) =>
            normalizeEmployeeIntakeText(company.nomeFantasia) === requestedCompany
            || normalizeEmployeeIntakeText(company.razaoSocial) === requestedCompany
          )
          .map((company) => [company.id, company])
      );
      const matches = Array.from(matchesById.values());
      if (matches.length === 1) nextForm.companyId = matches[0].id;
      else {
        nextForm.companyId = "";
        warnings.push(matches.length
          ? "Empresa ambígua; escolha uma das empresas autorizadas no formulário."
          : "Empresa não localizada entre as empresas autorizadas; escolha uma empresa no formulário.");
      }
      delete extractedValues.companyName;
    }

    if (extractedValues.departmentName !== undefined) {
      const requestedDepartment = normalizeEmployeeIntakeText(extractedValues.departmentName);
      const targetCompanyId = nextForm.companyId ?? form.companyId;
      const matches = departments.filter((department) =>
        department.company_id === targetCompanyId
        && department.active
        && normalizeEmployeeIntakeText(department.name) === requestedDepartment
      );
      if (matches.length === 1) nextForm.departmentId = matches[0].id;
      else {
        nextForm.departmentId = "";
        warnings.push(matches.length
          ? "Departamento ambíguo; selecione-o manualmente."
          : "Departamento não localizado para a empresa selecionada; selecione-o manualmente.");
      }
      delete extractedValues.departmentName;
    }

    if (extractedValues.name !== undefined) nextForm.name = extractedValues.name;
    if (extractedValues.cpf !== undefined) nextForm.cpf = formatCpf(extractedValues.cpf);
    if (extractedValues.email !== undefined) nextForm.email = extractedValues.email;
    if (extractedValues.phone !== undefined) nextForm.phone = extractedValues.phone;
    if (extractedValues.registration !== undefined) nextForm.registration = extractedValues.registration;
    if (extractedValues.jobTitle !== undefined) nextForm.jobTitle = extractedValues.jobTitle;
    if (extractedValues.admissionDate !== undefined) nextForm.admissionDate = extractedValues.admissionDate;
    if (extractedValues.terminationDate !== undefined) nextForm.terminationDate = extractedValues.terminationDate;
    if (extractedValues.salary !== undefined) nextForm.salary = String(extractedValues.salary);
    if (extractedValues.employmentType !== undefined) nextForm.employmentType = extractedValues.employmentType;
    if (extractedValues.status !== undefined) nextForm.status = extractedValues.status;

    setForm((current) => ({ ...current, ...nextForm }));
    setAssistantWarnings(warnings);
    setAssistantMessage(
      `${Object.keys(extraction.values).length} campo(s) reconhecido(s) localmente. Confira e complete os obrigatórios.`
    );
  }

  function getFormValidationMessage(): string | null {
    if (!form.companyId) return "Selecione uma empresa empregadora autorizada.";
    if (form.name.trim().length < 2) return "Informe o nome completo.";
    if (!isValidCpf(form.cpf)) return "Informe um CPF válido.";
    if (!form.admissionDate) return "Informe a data de admissão.";
    if (assistantMode && !form.employmentType) return "Informe o tipo de vínculo.";
    if (assistantMode && !form.status) return "Informe a situação do colaborador.";
    if (form.status === "terminated" && !form.terminationDate) return "Informe a data de desligamento.";
    if (form.status === "terminated" && form.terminationDate < form.admissionDate) {
      return "A data de desligamento não pode ser anterior à admissão.";
    }
    if (form.salary && (!Number.isFinite(Number(form.salary)) || Number(form.salary) < 0)) {
      return "Informe um salário válido, igual ou maior que zero.";
    }
    return null;
  }

  function getMissingFields(): string[] {
    const missing: string[] = [];
    if (!form.companyId) missing.push("Empresa empregadora");
    if (form.name.trim().length < 2) missing.push("Nome completo");
    if (!isValidCpf(form.cpf)) missing.push("CPF válido");
    if (!form.admissionDate) missing.push("Data de admissão");
    if (!form.employmentType) missing.push("Tipo de vínculo");
    if (!form.status) missing.push("Situação");
    if (form.status === "terminated" && !form.terminationDate) missing.push("Data de desligamento");
    return missing;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (previewStep) {
      await saveEmployee();
      return;
    }

    const validationMessage = getFormValidationMessage();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    if (assistantMode) {
      setPreviewStep(true);
      return;
    }
    await saveEmployee();
  }

  async function saveEmployee() {
    if (!form.companyId || !form.name.trim() || !form.admissionDate || !form.status) {
      setError("Complete os campos obrigatórios antes de salvar.");
      setPreviewStep(false);
      return;
    }
    const employeeFields: Omit<EmployeeCreateInput, "companyId" | "departmentId"> = {
      name: form.name.trim(),
      cpf: form.cpf.replace(/\D/g, ""),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      jobTitle: form.jobTitle.trim() || null,
      registration: form.registration.trim() || null,
      admissionDate: form.admissionDate,
      terminationDate: form.status === "terminated" ? form.terminationDate : null,
      salary: form.salary ? Number(form.salary) : null,
      employmentType: form.employmentType,
      status: form.status,
    };

    setSaving(true);
    try {
      if (initialEmployee) {
        const input: EmployeeUpdateInput = {
          ...employeeFields,
          ...(canChangeAssignment
            ? { companyId: form.companyId, departmentId: form.departmentId || null }
            : {}),
        };
        await employeesApi.update(initialEmployee.id, input);
      } else {
        const input: EmployeeCreateInput = {
          ...employeeFields,
          companyId: form.companyId,
          departmentId: form.departmentId || null,
        };
        await employeesApi.create(input);
      }
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : `Não foi possível ${editing ? "atualizar" : "cadastrar"} o colaborador. Tente novamente.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-5"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        aria-labelledby="employee-form-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-7">
          <div>
            <h2 id="employee-form-title" className="text-lg font-bold text-slate-900">
              {editing ? "Editar colaborador" : "Novo colaborador"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Os dados são salvos no cadastro da empresa selecionada.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar formulário" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {previewStep ? (
            <section aria-labelledby="employee-preview-title" className="space-y-4">
              <div>
                <h3 id="employee-preview-title" className="text-base font-bold text-slate-800">Prévia para aprovação</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Nada foi salvo. Confira os dados e confirme explicitamente para gravar no cadastro.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <PreviewRow label="Nome" value={form.name} />
                <PreviewRow label="CPF" value={formatCpf(form.cpf)} />
                <PreviewRow label="E-mail" value={form.email || "Não informado"} />
                <PreviewRow label="Telefone" value={form.phone || "Não informado"} />
                <PreviewRow label="Empresa" value={companies.find((company) => company.id === form.companyId)?.nomeFantasia || companies.find((company) => company.id === form.companyId)?.razaoSocial || "Não selecionada"} />
                <PreviewRow label="Matrícula" value={form.registration || "Não informada"} />
                <PreviewRow label="Cargo" value={form.jobTitle || "Não informado"} />
                <PreviewRow label="Departamento" value={departments.find((department) => department.id === form.departmentId)?.name || "Não informado"} />
                <PreviewRow label="Admissão" value={form.admissionDate} />
                <PreviewRow label="Tipo de vínculo" value={employmentTypeLabels[form.employmentType] || form.employmentType} />
                <PreviewRow label="Situação" value={form.status ? statusLabels[form.status] : "Não selecionada"} />
                {form.status === "terminated" && <PreviewRow label="Desligamento" value={form.terminationDate} />}
                <PreviewRow label="Salário-base cadastrado" value={form.salary ? formatCurrency(Number(form.salary)) : "Não informado"} />
              </div>
              <p className="text-xs text-slate-500">
                A prévia contém somente campos aceitos pelo backend atual. A IA generativa, cálculos, eSocial, pagamentos e documentos oficiais não são acionados.
              </p>
            </section>
          ) : (
            <>
          {!editing && !assistantMode && (
            <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-blue-900">Assistente MIL IA — preparo local</h3>
                  <p className="mt-1 text-xs text-blue-800">
                    Organiza instruções sem enviar dados a modelos externos.
                  </p>
                </div>
                <button type="button" onClick={enableLocalAssistant} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                  <Sparkles size={16} /> Preparar por instrução
                </button>
              </div>
            </section>
          )}

          {!editing && assistantMode && (
            <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4" aria-labelledby="local-assistant-title">
              <div>
                <h3 id="local-assistant-title" className="text-sm font-bold text-blue-900">Assistente de cadastro — processamento local</h3>
                <p className="mt-1 text-xs text-blue-800">
                  A instrução é interpretada neste navegador por rótulos explícitos; não é enviada ao chat MIL IA/Gemini.
                  Apenas campos reconhecidos e suportados são preenchidos.
                </p>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Instrução
                <textarea
                  value={assistantInstruction}
                  onChange={(event) => setAssistantInstruction(event.target.value)}
                  maxLength={3000}
                  rows={4}
                  placeholder="Nome: [nome]; CPF: [CPF]; empresa: [empresa autorizada]; admissão: [DD/MM/AAAA]; tipo de vínculo: CLT; situação: ativo"
                  className={inputClass}
                />
              </label>
              <button type="button" onClick={prepareFromInstruction} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                <Sparkles size={15} /> Preparar rascunho local
              </button>
              {assistantMessage && <p role="status" className="text-xs font-semibold text-blue-900">{assistantMessage}</p>}
              {assistantWarnings.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">
                  {assistantWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              )}
              {assistantMessage && (
                <div className="rounded-lg border border-blue-200 bg-white/70 p-3 text-xs text-slate-700">
                  <strong>Dados obrigatórios ainda ausentes:</strong>{" "}
                  {getMissingFields().length ? getMissingFields().join(", ") : "nenhum. Revise todos os campos antes da prévia."}
                </div>
              )}
            </section>
          )}

          <FormSection title="Dados pessoais">
            <Field label="Nome completo">
              <input autoFocus required minLength={2} maxLength={160} value={form.name} onChange={(event) => update("name", event.target.value)} className={inputClass} />
            </Field>
            <Field label="CPF">
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                value={formatCpf(form.cpf)}
                onChange={(event) => update("cpf", formatCpf(event.target.value))}
                className={inputClass}
                aria-describedby="cpf-storage-note"
              />
            </Field>
            <Field label="E-mail">
              <input type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Telefone">
              <input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} />
            </Field>
            <p id="cpf-storage-note" className="text-xs text-slate-500 sm:col-span-2">
              Nascimento, endereço, CEP, município e UF ainda não possuem campos no banco e não são coletados.
            </p>
          </FormSection>

          <FormSection title="Dados trabalhistas">
            <Field label="Empresa empregadora">
              <select
                required
                value={form.companyId}
                onChange={(event) => handleCompanyChange(event.target.value)}
                disabled={editing && !canChangeAssignment}
                className={inputClass}
              >
                <option value="">Selecione uma empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.nomeFantasia || company.razaoSocial}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Matrícula">
              <input maxLength={50} value={form.registration} onChange={(event) => update("registration", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Cargo">
              <input maxLength={120} value={form.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Departamento">
              <select
                value={form.departmentId}
                onChange={(event) => update("departmentId", event.target.value)}
                disabled={!form.companyId || departmentsLoading || !!departmentError || (editing && !canChangeAssignment)}
                className={inputClass}
              >
                <option value="">{departmentsLoading ? "Carregando…" : "Sem departamento"}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id} disabled={!department.active}>
                    {department.name}{department.active ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
              {departmentError && <span role="alert" className="mt-1 block text-xs text-red-700">{departmentError}</span>}
            </Field>
            <Field label="Data de admissão">
              <input required type="date" value={form.admissionDate} onChange={(event) => update("admissionDate", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Tipo de vínculo">
              <select required value={form.employmentType} onChange={(event) => update("employmentType", event.target.value)} className={inputClass}>
                <option value="">Selecione o tipo de vínculo</option>
                {employmentTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Situação">
              <select required value={form.status} onChange={(event) => update("status", event.target.value as EmployeeStatus | "")} className={inputClass}>
                <option value="">Selecione a situação</option>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            {form.status === "terminated" && (
              <Field label="Data de desligamento">
                <input required type="date" min={form.admissionDate} value={form.terminationDate} onChange={(event) => update("terminationDate", event.target.value)} className={inputClass} />
              </Field>
            )}
            <Field label="Salário-base cadastrado">
              <input
                type="number"
                min="0"
                max="999999999999.99"
                step="0.01"
                inputMode="decimal"
                value={form.salary}
                onChange={(event) => update("salary", event.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">Informativo; não gera cálculo de folha.</span>
            </Field>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Tipo de contrato, jornada semanal e forma de remuneração ainda não possuem campos persistidos. A seleção do departamento usa a tabela existente.
              {editing && !canChangeAssignment && " A alteração de empresa e departamento é restrita ao perfil proprietário do escritório."}
            </p>
          </FormSection>

          <FormSection title="Informações complementares">
            <p className="text-sm text-slate-600 sm:col-span-2">
              PIS/PASEP, dados de eSocial, dependentes e observações administrativas não são coletados porque ainda não existem campos persistidos para esses dados.
            </p>
          </FormSection>
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
          {previewStep ? (
            <button type="button" onClick={() => setPreviewStep(false)} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Voltar para edição
            </button>
          ) : (
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
          )}
          <button type="submit" disabled={saving || companies.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving
              ? "Salvando…"
              : previewStep
                ? "Confirmar e salvar cadastro"
                : assistantMode
                  ? "Revisar prévia"
                  : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
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
