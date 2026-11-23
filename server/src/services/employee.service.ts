// ============================================================
// Service: Gestão de RH - Colaboradores
// ============================================================

import {
  TenantContext,
  withTenantContext,
} from "../db/withTenantContext.js";

import {
  employeeRepository,
  EmployeeFilters,
  EmployeeCreateRow,
  EmployeeUpdateRow,
} from "../repositories/employee.repository.js";

import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors.js";

export interface EmployeeListFilters {
  companyId?: string;
  status?: string;
  search?: string;
}

export interface EmployeeCreateInput {
  companyId: string;
  departmentId?: string | null;
  name: string;
  cpf: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  registration?: string | null;
  admissionDate: string;
  terminationDate?: string | null;
  salary?: number | null;
  employmentType?: string;
  status?: string;
}

export interface EmployeeUpdateInput {
  companyId?: string;
  departmentId?: string | null;
  name?: string;
  cpf?: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  registration?: string | null;
  admissionDate?: string;
  terminationDate?: string | null;
  salary?: number | null;
  employmentType?: string;
  status?: string;
}

export const employeeService = {
  async list(
    ctx: TenantContext,
    filters: EmployeeListFilters = {}
  ) {
    return withTenantContext(ctx, async (client) => {
      if (!isStaff(ctx) && !(await employeeRepository.hasAnyHrPermission(client, "employee.read"))) {
        throw new ForbiddenError("Permissão de leitura de RH necessária.");
      }

      const dbFilters: EmployeeFilters = {
        companyId: filters.companyId,
        status: filters.status,
        search: filters.search,
      };

      return employeeRepository.findAll(client, dbFilters);
    });
  },

  async listDepartments(
    ctx: TenantContext,
    companyId: string
  ) {
    return withTenantContext(ctx, async (client) => {
      if (!(await employeeRepository.hasHrPermission(client, companyId, "employee.read"))) {
        throw new ForbiddenError("Permissão de leitura de RH necessária para esta empresa.");
      }
      return employeeRepository.findDepartments(client, companyId);
    });
  },

  async getById(
    ctx: TenantContext,
    employeeId: string
  ) {
    return withTenantContext(ctx, async (client) => {
      const employee = await employeeRepository.findById(
        client,
        employeeId
      );

      if (!employee) {
        throw new NotFoundError(
          "Colaborador",
          employeeId
        );
      }

      return employee;
    });
  },

  async create(
    ctx: TenantContext,
    input: EmployeeCreateInput
  ) {
    const firmId = ctx.firmId;
    if (!firmId) {
      throw new ConflictError(
        "Usuário sem escritório associado não pode cadastrar colaboradores."
      );
    }

    return withTenantContext(ctx, async (client) => {
      if (!(await employeeRepository.hasHrPermission(client, input.companyId, "employee.manage"))) {
        throw new ForbiddenError("Permissão de gestão de RH necessária para esta empresa.");
      }
      const data: EmployeeCreateRow = {
        firmId,
        companyId: input.companyId,
        departmentId: input.departmentId ?? null,
        name: input.name,
        cpf: input.cpf,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        registration: input.registration ?? null,
        admissionDate: input.admissionDate,
        terminationDate: input.terminationDate ?? null,
        salary: input.salary ?? null,
        employmentType: input.employmentType ?? "clt",
        status: input.status ?? "active",
      };

      return employeeRepository.create(client, data);
    });
  },

  async update(
    ctx: TenantContext,
    employeeId: string,
    input: EmployeeUpdateInput
  ) {
    if (
      ctx.role !== "firm_owner"
      && (input.companyId !== undefined || input.departmentId !== undefined)
    ) {
      throw new ForbiddenError("Somente firm_owner pode alterar os vínculos do colaborador.");
    }

    return withTenantContext(ctx, async (client) => {
      const existing = await employeeRepository.findById(
        client,
        employeeId
      );

      if (!existing) {
        throw new NotFoundError(
          "Colaborador",
          employeeId
        );
      }

      if (!(await employeeRepository.hasHrPermission(client, existing.company_id, "employee.manage"))) {
        throw new ForbiddenError("Permissão de gestão de RH necessária para esta empresa.");
      }

      if (
        input.status !== undefined
        || input.terminationDate !== undefined
        || input.admissionDate !== undefined
      ) {
        const nextStatus = input.status ?? existing.status;
        const nextTerminationDate = input.terminationDate !== undefined
          ? input.terminationDate
          : existing.termination_date;
        const nextAdmissionDate = input.admissionDate ?? existing.admission_date;
        if (nextStatus === "terminated" && !nextTerminationDate) {
          throw new ValidationError("Informe a data de desligamento.");
        }
        if (nextStatus !== "terminated" && nextTerminationDate) {
          throw new ValidationError("Remova a data de desligamento para esta situação.");
        }
        if (nextTerminationDate && nextTerminationDate < nextAdmissionDate) {
          throw new ValidationError("A data de desligamento não pode ser anterior à admissão.");
        }
      }

      const data: EmployeeUpdateRow = {
        companyId: ctx.role === "firm_owner" ? input.companyId : undefined,
        departmentId: ctx.role === "firm_owner" ? input.departmentId : undefined,
        name: input.name,
        cpf: input.cpf,
        email: input.email,
        phone: input.phone,
        jobTitle: input.jobTitle,
        registration: input.registration,
        admissionDate: input.admissionDate,
        terminationDate: input.status && input.status !== "terminated"
          ? null
          : input.terminationDate,
        salary: input.salary,
        employmentType: input.employmentType,
        status: input.status,
      };

      const updated = await employeeRepository.update(
        client,
        employeeId,
        data
      );

      if (!updated) {
        throw new NotFoundError(
          "Colaborador",
          employeeId
        );
      }

      return updated;
    });
  },

  async remove(
    ctx: TenantContext,
    employeeId: string
  ) {
    if (ctx.role !== "firm_owner") {
      throw new ForbiddenError("Somente firm_owner pode remover um colaborador.");
    }

    return withTenantContext(ctx, async (client) => {
      const existing = await employeeRepository.findById(
        client,
        employeeId
      );

      if (!existing) {
        throw new NotFoundError(
          "Colaborador",
          employeeId
        );
      }

      await employeeRepository.softDelete(
        client,
        employeeId
      );

      return {
        success: true,
        message: "Colaborador removido com sucesso.",
      };
    });
  },
};

function isStaff(ctx: TenantContext): boolean {
  return ctx.role === "firm_owner" || ctx.role === "accountant";
}