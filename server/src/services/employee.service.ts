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
      const dbFilters: EmployeeFilters = {
        companyId: filters.companyId,
        status: filters.status,
        search: filters.search,
      };

      return employeeRepository.findAll(client, dbFilters);
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
    if (!ctx.firmId) {
      throw new ConflictError(
        "Usuário sem escritório associado não pode cadastrar colaboradores."
      );
    }

    return withTenantContext(ctx, async (client) => {
      const data: EmployeeCreateRow = {
        firmId: ctx.firmId!,
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

      const data: EmployeeUpdateRow = {
        companyId: input.companyId,
        departmentId: input.departmentId,
        name: input.name,
        cpf: input.cpf,
        email: input.email,
        phone: input.phone,
        jobTitle: input.jobTitle,
        registration: input.registration,
        admissionDate: input.admissionDate,
        terminationDate: input.terminationDate,
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