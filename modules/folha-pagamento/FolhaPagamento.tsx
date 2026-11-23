import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { ApiError } from "../../services/apiClient";
import { companiesApi } from "../../services/companiesApi";
import type { Company } from "../empresas/types";
import { useAuth } from "../auth/AuthContext";
import { employeesApi, type Employee, type EmployeeStatus } from "../../services/employeesApi";
import EmployeeFormModal from "./EmployeeFormModal";
import PartnerAdministratorFormModal from "./PartnerAdministratorFormModal";
import {
  type PartnerAdministratorDraft,
  type PartnerPaymentStatus,
  type PartnerWithdrawalStatus,
} from "./partnerIntake";

type Tab = "employees" | "payroll" | "partners";

const months = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString("pt-BR", { month: "long" })
);

function getSalaryValue(salary: Employee["salary"]): number | null {
  if (salary === null || (typeof salary === "string" && !salary.trim())) return null;
  const value = typeof salary === "number" ? salary : Number(salary.trim());
  return Number.isFinite(value) ? value : null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatEmployeeStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "Ativo",
    vacation: "Férias",
    leave: "Afastado",
    terminated: "Desligado",
  };
  return labels[status.toLowerCase()] ?? status;
}

const withdrawalStatusLabels: Record<PartnerWithdrawalStatus, string> = {
  not_reported: "Pró-labore não informado",
  none_declared: "Sem retirada declarada",
  amount_reported: "Valor informado",
};

const paymentStatusLabels: Record<PartnerPaymentStatus, string> = {
  not_reported: "Não informado",
  pending: "Pendente (informação declarada)",
  paid: "Pago (informação declarada)",
  not_applicable: "Não aplicável",
};

function formatCompetence(competence: string): string {
  const [year, month] = competence.split("-");
  return month && year ? `${month}/${year}` : competence;
}

function maskCpf(cpf: string | null): string {
  if (cpf === null) return "Restrito";
  const digits = cpf.replace(/\D/g, "");
  return digits.length === 11
    ? `***.***.***-${digits.slice(-2)}`
    : "Não informado";
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === "active";
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
      isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
    }`}>
      {formatEmployeeStatus(status)}
    </span>
  );
}

function formatEmployeeSalary(employee: Employee, canReadSensitiveData: boolean): string {
  if (!canReadSensitiveData || employee.cpf === null) return "Restrito";
  const value = getSalaryValue(employee.salary);
  return value === null ? "Não cadastrado" : formatCurrency(value);
}

export default function FolhaPagamento() {
  const now = new Date();
  const { user } = useAuth();
  const isHrStaff = user?.role === "firm_owner" || user?.role === "accountant";
  const canManageCompanyEmployees = (companyId: string) => isHrStaff
    || user?.hrPermissions?.some((grant) =>
      grant.companyId === companyId && grant.permissions.includes("employee.manage")
    ) === true;
  const canReadSensitiveCompany = (companyId: string) => isHrStaff
    || user?.hrPermissions?.some((grant) =>
      grant.companyId === companyId && grant.permissions.includes("employee.sensitive.read")
    ) === true;
  const canManageEmployees = isHrStaff
    || user?.hrPermissions?.some((grant) => grant.permissions.includes("employee.manage")) === true;
  const [activeTab, setActiveTab] = useState<Tab>("employees");
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formEmployee, setFormEmployee] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const [partnerDrafts, setPartnerDrafts] = useState<PartnerAdministratorDraft[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [partnerCompanyFilter, setPartnerCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [competenceMonth, setCompetenceMonth] = useState(now.getMonth());
  const [competenceYear, setCompetenceYear] = useState(now.getFullYear());
  const employeeRequestId = useRef(0);

  const loadEmployees = useCallback(async () => {
    const requestId = ++employeeRequestId.current;
    setLoading(true);
    setEmployees([]);
    setLoadError(null);
    try {
      const data = await employeesApi.list(companyFilter ? { companyId: companyFilter } : {});
      if (requestId === employeeRequestId.current) setEmployees(data);
    } catch (error: unknown) {
      if (requestId === employeeRequestId.current) {
        setLoadError(
          error instanceof ApiError
            ? error.message
            : "Não foi possível carregar os colaboradores. Tente novamente mais tarde."
        );
      }
    } finally {
      if (requestId === employeeRequestId.current) setLoading(false);
    }
  }, [companyFilter]);

  useEffect(() => {
    loadEmployees();
    return () => { employeeRequestId.current += 1; };
  }, [loadEmployees]);

  useEffect(() => {
    let active = true;
    setCompaniesLoading(true);
    companiesApi.list()
      .then((data) => {
        if (active) setCompanies(data);
      })
      .catch((error: unknown) => {
        if (active) {
          setCompaniesError(
            error instanceof ApiError
              ? error.message
              : "Não foi possível carregar as empresas permitidas para este usuário."
          );
        }
      })
      .finally(() => {
        if (active) setCompaniesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return employees.filter((employee) => {
      const matchesSearch = !query
        || employee.name.toLocaleLowerCase("pt-BR").includes(query)
        || (employee.registration ?? "").toLocaleLowerCase("pt-BR").includes(query);
      return matchesSearch && (statusFilter === "all" || employee.status === statusFilter);
    });
  }, [employees, search, statusFilter]);

  const companyNames = useMemo(
    () => new Map(companies.map((company) => [company.id, company.nomeFantasia || company.razaoSocial])),
    [companies]
  );
  const manageableCompanies = isHrStaff
    ? companies
    : companies.filter((company) => canManageCompanyEmployees(company.id));

  const employeesWithSalary = employees
    .filter((employee) => canReadSensitiveCompany(employee.company_id))
    .map((employee) => getSalaryValue(employee.salary))
    .filter((salary): salary is number => salary !== null);
  const totalRegisteredSalaries = employeesWithSalary.reduce((sum, salary) => sum + salary, 0);
  const canReadAnySensitiveData = isHrStaff
    || user?.hrPermissions?.some((grant) => grant.permissions.includes("employee.sensitive.read")) === true;

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de RH</h1>
        <p className="text-slate-500 text-sm mt-1">
          Colaboradores e acompanhamento da folha de pagamento.
        </p>
        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-widest mt-2 inline-block">
          Em migração para MIL RH IA
        </span>
      </div>

      <div className="flex gap-2 border-b border-slate-200 mb-6" role="tablist" aria-label="Seções de Gestão de RH">
        <button
          id="employees-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "employees"}
          aria-controls="employees-panel"
          onClick={() => setActiveTab("employees")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "employees"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Colaboradores
        </button>
        <button
          id="payroll-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "payroll"}
          aria-controls="payroll-panel"
          onClick={() => setActiveTab("payroll")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "payroll"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Folha de Pagamento
        </button>
        <button
          id="partners-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === "partners"}
          aria-controls="partners-panel"
          onClick={() => setActiveTab("partners")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "partners"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Sócios-administradores
        </button>
      </div>

      {activeTab === "employees" ? (
        <section id="employees-panel" role="tabpanel" aria-labelledby="employees-tab">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <p className="text-sm text-slate-500">
              {companyFilter
                ? `Empresa: ${companyNames.get(companyFilter) ?? "selecionada"}`
                : "Colaboradores das empresas disponíveis para seu perfil"}
            </p>
            {canManageEmployees && (
              <button
                type="button"
                disabled={companiesLoading || !!companiesError || manageableCompanies.length === 0}
                onClick={() => {
                  setFormEmployee(null);
                  setFormOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Novo Colaborador
              </button>
            )}
          </div>
          {companiesError && <ErrorBanner message={companiesError} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              icon={<Users size={18} className="text-blue-600" />}
              iconClass="bg-blue-50"
              label="Colaboradores"
              value={loading ? "…" : loadError ? "Indisponível" : String(employees.length)}
            />
            <SummaryCard
              icon={<DollarSign size={18} className="text-emerald-600" />}
              iconClass="bg-emerald-50"
              label="Salários cadastrados"
              value={loading ? "…" : loadError ? "Indisponível" : !canReadAnySensitiveData ? "Restrito" : employeesWithSalary.length ? formatCurrency(totalRegisteredSalaries) : "—"}
              note={canReadAnySensitiveData ? "Soma dos salários visíveis para seu perfil" : "CPF e salário exigem permissão específica"}
            />
            <SummaryCard
              icon={<Building2 size={18} className="text-amber-600" />}
              iconClass="bg-amber-50"
              label="Encargos estimados"
              value="Indisponíveis"
              note="Aguardando cálculo trabalhista validado"
            />
            <SummaryCard
              icon={<DollarSign size={18} className="text-violet-600" />}
              iconClass="bg-violet-50"
              label="Custo total"
              value="Indisponível"
              note="Não calculado nesta versão"
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou matrícula..."
                aria-label="Buscar colaborador por nome ou matrícula"
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              aria-label="Filtrar por empresa"
              disabled={companiesLoading || !!companiesError}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:opacity-60"
            >
              <option value="">Todas as empresas</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.nomeFantasia || company.razaoSocial}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as EmployeeStatus | "all")}
              aria-label="Filtrar por situação"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
            >
              <option value="all">Todas as situações</option>
              <option value="active">Ativo</option>
              <option value="leave">Afastado</option>
              <option value="vacation">Férias</option>
              <option value="terminated">Desligado</option>
            </select>
          </div>

          {loadError && <ErrorBanner message={loadError} />}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>Colaborador</TableHeader>
                    <TableHeader>Empresa</TableHeader>
                    <TableHeader>Cargo</TableHeader>
                    <TableHeader align="right">Salário cadastrado</TableHeader>
                    <TableHeader align="center">Vínculo</TableHeader>
                    {canManageEmployees && <TableHeader align="center">Ações</TableHeader>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <TableMessage colSpan={canManageEmployees ? 6 : 5}>Carregando colaboradores…</TableMessage>
                  ) : loadError ? (
                    <TableMessage colSpan={canManageEmployees ? 6 : 5}>Os dados não estão disponíveis enquanto a API estiver inacessível.</TableMessage>
                  ) : filteredEmployees.length === 0 ? (
                    <TableMessage colSpan={canManageEmployees ? 6 : 5}>
                      {employees.length ? "Nenhum colaborador corresponde aos filtros." : "Nenhum colaborador cadastrado."}
                    </TableMessage>
                  ) : filteredEmployees.map((employee) => {
                    const canManageEmployee = canManageCompanyEmployees(employee.company_id);
                    const canReadSensitive = canReadSensitiveCompany(employee.company_id);
                    const salary = getSalaryValue(employee.salary);
                    return (
                      <tr
                        key={employee.id}
                        onClick={() => setSelectedEmployee(employee)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedEmployee(employee);
                          }
                        }}
                        tabIndex={0}
                        className="hover:bg-slate-50 focus:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 font-bold text-xs">
                              {employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                            </div>
                            <span>
                              <span className="block font-semibold text-slate-700">{employee.name}</span>
                              {employee.registration && <span className="block text-xs text-slate-400">Matrícula {employee.registration}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{companyNames.get(employee.company_id) ?? "Empresa indisponível"}</td>
                        <td className="px-5 py-3 text-slate-500">{employee.job_title || "Não informado"}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800">
                          {!canReadSensitive || employee.cpf === null ? "Restrito" : salary === null ? "Não cadastrado" : formatCurrency(salary)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <StatusBadge status={employee.status || "Não informado"} />
                        </td>
                        {canManageEmployees && (
                          <td className="px-5 py-3 text-center">
                            {canManageEmployee && (
                              <button
                                type="button"
                                aria-label={`Editar cadastro de ${employee.name}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setFormEmployee(employee);
                                  setFormOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil size={14} /> Editar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : activeTab === "payroll" ? (
        <section id="payroll-panel" role="tabpanel" aria-labelledby="payroll-tab">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 mb-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays size={18} className="text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-800">Competência</h2>
                </div>
                <p className="text-sm text-slate-500">Selecione o período para consultar a folha.</p>
                <div className="flex gap-3 mt-4">
                  <label className="text-xs font-semibold text-slate-600">
                    Mês
                    <select
                      value={competenceMonth}
                      onChange={(event) => setCompetenceMonth(Number(event.target.value))}
                      className="block mt-1 w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {months.map((month, index) => (
                        <option key={month} value={index}>{month[0].toLocaleUpperCase("pt-BR") + month.slice(1)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Ano
                    <select
                      value={competenceYear}
                      onChange={(event) => setCompetenceYear(Number(event.target.value))}
                      className="block mt-1 w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      {Array.from({ length: 6 }, (_, index) => now.getFullYear() - 4 + index).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="lg:text-right">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Rascunho — não persistido
                </span>
                <p className="text-xs text-slate-500 mt-2">
                  {loading
                    ? "Carregando colaboradores…"
                    : loadError
                      ? "Lista de colaboradores indisponível"
                      : `${employees.length} colaborador${employees.length === 1 ? "" : "es"} na competência selecionada`}
                </p>
                {companyFilter && (
                  <p className="text-xs text-slate-500 mt-1">
                    Empresa: {companyNames.get(companyFilter) ?? "selecionada"}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              A folha ainda não possui cálculos ou operações oficiais. Proventos, descontos, INSS, FGTS, IRRF e salário
              líquido serão disponibilizados quando houver backend validado e regras legais vigentes implementadas.
              Os salários exibidos abaixo vêm do cadastro atual e não são históricos por competência.
            </div>
          </div>

          {loadError && <ErrorBanner message={loadError} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <SummaryCard
              icon={<DollarSign size={18} className="text-blue-600" />}
              iconClass="bg-blue-50"
              label={`Total bruto — ${months[competenceMonth]} ${competenceYear}`}
              value="Não calculado"
            />
            <SummaryCard
              icon={<DollarSign size={18} className="text-violet-600" />}
              iconClass="bg-violet-50"
              label={`Total líquido — ${months[competenceMonth]} ${competenceYear}`}
              value="Não calculado"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Colaboradores da folha</h3>
              <p className="text-xs text-slate-500 mt-1">Valores sem cálculo aparecem como indisponíveis, nunca como zero.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>Colaborador</TableHeader>
                    <TableHeader align="right">Salário-base cadastrado</TableHeader>
                    <TableHeader align="right">Proventos</TableHeader>
                    <TableHeader align="right">Descontos</TableHeader>
                    <TableHeader align="right">INSS</TableHeader>
                    <TableHeader align="right">FGTS</TableHeader>
                    <TableHeader align="right">IRRF</TableHeader>
                    <TableHeader align="right">Salário líquido</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <TableMessage colSpan={8}>Carregando colaboradores…</TableMessage>
                  ) : loadError ? (
                    <TableMessage colSpan={8}>Os dados não estão disponíveis enquanto a API estiver inacessível.</TableMessage>
                  ) : employees.length === 0 ? (
                    <TableMessage colSpan={8}>Nenhum colaborador cadastrado.</TableMessage>
                  ) : employees.map((employee) => {
                    const canReadSensitive = canReadSensitiveCompany(employee.company_id);
                    const salary = getSalaryValue(employee.salary);
                    return (
                      <tr key={employee.id}>
                        <td className="px-5 py-3 font-semibold text-slate-700">{employee.name}</td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {!canReadSensitive || employee.cpf === null ? "Restrito" : salary === null ? "Não cadastrado" : formatCurrency(salary)}
                        </td>
                        <UnavailableCell />
                        <UnavailableCell />
                        <UnavailableCell />
                        <UnavailableCell />
                        <UnavailableCell />
                        <UnavailableCell />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 inline-flex items-center gap-2">
                <LockKeyhole size={14} />
                Calcular e fechar folha dependem de backend validado. Pagamentos e documentos oficiais não estão disponíveis.
              </p>
              <div className="flex gap-2 shrink-0">
                <button type="button" disabled className="px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">
                  Calcular folha
                </button>
                <button type="button" disabled className="px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">
                  Fechar folha
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 font-semibold">
              <AlertCircle size={14} /> Rascunho
            </span>
            <span className="text-slate-300">→</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 font-semibold">
              <CheckCircle2 size={14} /> Calculada (indisponível)
            </span>
            <span className="text-slate-300">→</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 font-semibold">
              <LockKeyhole size={14} /> Fechada (indisponível)
            </span>
          </div>
        </section>
      ) : (
        <section id="partners-panel" role="tabpanel" aria-labelledby="partners-tab">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Quadro societário e pró-labore</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cadastro separado de empregados e contratos de trabalho.
              </p>
            </div>
            {canManageEmployees && (
              <button
                type="button"
                disabled={companiesLoading || !!companiesError || companies.length === 0}
                onClick={() => setPartnerFormOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Novo sócio-administrador
              </button>
            )}
          </div>

          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-xs font-semibold text-slate-600">
              Empresa autorizada
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                disabled={companiesLoading || !!companiesError}
                className="mt-1 block w-full min-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 disabled:opacity-60"
              >
                <option value="">Todas as empresas disponíveis</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.nomeFantasia || company.razaoSocial}</option>
                ))}
              </select>
            </label>
            <p className="max-w-2xl text-xs text-slate-500">
              Os dados existentes abaixo vêm da API autorizada de empresas. O indicador de administrador e os dados de pró-labore ainda não são fornecidos pelo backend.
            </p>
          </div>

          {companiesError && <ErrorBanner message={companiesError} />}

          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="font-bold text-slate-800">Sócios atualmente cadastrados</h3>
              <p className="mt-1 text-xs text-slate-500">Apenas leitura nesta etapa; administração não é inferida para registros existentes.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>Sócio</TableHeader>
                    <TableHeader>Empresa</TableHeader>
                    <TableHeader align="right">Participação</TableHeader>
                    <TableHeader align="center">Administração</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {companiesLoading ? (
                    <TableMessage colSpan={4}>Carregando empresas autorizadas…</TableMessage>
                  ) : companiesError ? (
                    <TableMessage colSpan={4}>Os dados não estão disponíveis enquanto a API estiver inacessível.</TableMessage>
                  ) : companies
                    .filter((company) => !partnerCompanyFilter || company.id === partnerCompanyFilter)
                    .flatMap((company) => (company.socios ?? []).map((partner) => ({ company, partner })))
                    .length === 0 ? (
                    <TableMessage colSpan={4}>Nenhum sócio consta nas empresas selecionadas.</TableMessage>
                  ) : companies
                    .filter((company) => !partnerCompanyFilter || company.id === partnerCompanyFilter)
                    .flatMap((company) => (company.socios ?? []).map((partner) => ({ company, partner })))
                    .map(({ company, partner }) => (
                      <tr key={`${company.id}-${partner.id}`}>
                        <td className="px-5 py-3">
                          <span className="block font-semibold text-slate-700">{partner.nome}</span>
                          <span className="text-xs text-slate-400">{maskCpf(partner.cpf)}</span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">{company.nomeFantasia || company.razaoSocial}</td>
                        <td className="px-5 py-3 text-right text-slate-700">{partner.participacao}%</td>
                        <td className="px-5 py-3 text-center text-xs text-slate-500">Não informado</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
            <div className="border-b border-amber-200 px-5 py-4">
              <h3 className="font-bold text-amber-950">Rascunhos desta sessão — não persistidos</h3>
              <p className="mt-1 text-xs text-amber-900">Não são registros oficiais e serão descartados ao recarregar ou sair desta tela.</p>
            </div>
            {partnerDrafts.filter((draft) => !partnerCompanyFilter || draft.companyId === partnerCompanyFilter).length === 0 ? (
              <p className="px-5 py-6 text-sm text-amber-900">Nenhum rascunho local preparado.</p>
            ) : (
              <ul className="divide-y divide-amber-200">
                {partnerDrafts
                  .filter((draft) => !partnerCompanyFilter || draft.companyId === partnerCompanyFilter)
                  .map((draft, index) => (
                    <li key={`${draft.companyId}-${draft.cpf}-${index}`} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-amber-950">{draft.name} — {draft.companyName}</p>
                        <p className="mt-1 text-xs text-amber-900">
                          {draft.isAdministrator ? "Administrador" : "Não administrador"}
                          {" · "}
                          {draft.isSoleShareholder ? "Sócio único" : "Composição não única"}
                          {" · "}
                          {draft.withdrawalStatus === "not_reported"
                            ? "Pró-labore não informado"
                            : withdrawalStatusLabels[draft.withdrawalStatus]}
                          {draft.competence ? ` · Competência ${formatCompetence(draft.competence)}` : ""}
                          {draft.proLaboreAmount !== null ? ` · ${formatCurrency(draft.proLaboreAmount)}` : ""}
                          {draft.withdrawalStatus === "amount_reported" ? ` · Pagamento: ${paymentStatusLabels[draft.paymentStatus]}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-amber-800">{maskCpf(draft.cpf)} · Participação informada: {draft.participation}%</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPartnerDrafts((current) => current.filter((item) => item !== draft))}
                        className="self-start rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 sm:self-auto"
                      >
                        Descartar rascunho
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">
            Não há API autorizada para salvar sócios-administradores ou pró-labore nesta etapa. Não ocorre gravação, cálculo, recolhimento, pagamento ou transmissão ao eSocial.
          </div>
        </section>
      )}

      {formOpen && (
        <EmployeeFormModal
          companies={manageableCompanies}
          initialEmployee={formEmployee ?? undefined}
          defaultCompanyId={companyFilter}
          canChangeAssignment={user?.role === "firm_owner"}
          onClose={() => {
            setFormOpen(false);
            setFormEmployee(null);
          }}
          onSaved={() => {
            setFormOpen(false);
            setFormEmployee(null);
            loadEmployees();
          }}
        />
      )}

      {partnerFormOpen && (
        <PartnerAdministratorFormModal
          companies={companies}
          defaultCompanyId={companyFilter}
          onClose={() => setPartnerFormOpen(false)}
          onDraftCreated={(draft) => {
            setPartnerDrafts((current) => [...current, draft]);
            setPartnerFormOpen(false);
          }}
        />
      )}

      {selectedEmployee && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEmployee(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-details-title"
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="employee-details-title" className="font-bold text-lg text-slate-800">Detalhes do Colaborador</h3>
              <button
                type="button"
                aria-label="Fechar detalhes"
                onClick={() => setSelectedEmployee(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <DetailRow label="Nome" value={selectedEmployee.name} />
              <DetailRow
                label="CPF"
                value={canReadSensitiveCompany(selectedEmployee.company_id) ? maskCpf(selectedEmployee.cpf) : "Restrito"}
              />
              <DetailRow label="E-mail" value={selectedEmployee.email || "Não informado"} />
              <DetailRow label="Telefone" value={selectedEmployee.phone || "Não informado"} />
              <DetailRow label="Matrícula" value={selectedEmployee.registration || "Não informada"} />
              <DetailRow label="Empresa" value={companyNames.get(selectedEmployee.company_id) ?? "Empresa indisponível"} />
              <DetailRow label="Cargo" value={selectedEmployee.job_title || "Não informado"} />
              <DetailRow label="Departamento" value={selectedEmployee.department_name || "Não informado"} />
              <DetailRow
                label="Admissão"
                value={selectedEmployee.admission_date
                  ? new Date(`${selectedEmployee.admission_date.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")
                  : "Não informado"}
              />
              <DetailRow
                label="Salário cadastrado"
                value={formatEmployeeSalary(
                  selectedEmployee,
                  canReadSensitiveCompany(selectedEmployee.company_id),
                )}
              />
              <DetailRow label="Vínculo" value={formatEmployeeStatus(selectedEmployee.status || "Não informado")} />
              {selectedEmployee.termination_date && (
                <DetailRow
                  label="Desligamento"
                  value={new Date(`${selectedEmployee.termination_date.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR")}
                />
              )}
              <p className="text-xs text-slate-500 pt-2">
                Encargos e salário líquido não são calculados nesta tela.
              </p>
              {canManageEmployees && (
                <button
                  type="button"
                  onClick={() => {
                    setFormEmployee(selectedEmployee);
                    setSelectedEmployee(null);
                    setFormOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                >
                  <Pencil size={15} /> Editar cadastro
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  iconClass,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-xl ${iconClass}`}>{icon}</div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-black text-slate-800">{value}</p>
      {note && <p className="text-[11px] text-slate-400 mt-1">{note}</p>}
    </div>
  );
}

function TableHeader({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  const alignmentClass = { left: "text-left", right: "text-right", center: "text-center" }[align];
  return (
    <th className={`${alignmentClass} px-5 py-3 text-xs font-bold text-slate-500 uppercase`}>
      {children}
    </th>
  );
}

function TableMessage({ children, colSpan }: { children: React.ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-slate-500">{children}</td>
    </tr>
  );
}

function UnavailableCell() {
  return <td className="px-5 py-3 text-right text-slate-400">—</td>;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 mb-4 text-sm text-red-800">
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-right">{value}</span>
    </div>
  );
}
