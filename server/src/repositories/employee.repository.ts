// ============================================================
// Repository: Gestão de RH - Colaboradores
// ============================================================

import { PoolClient } from "pg";
import type { HrPermission } from "../types/hr-permissions.js";

export interface EmployeeRow {
  id: string;
  firm_id: string;
  company_id: string;
  department_id: string | null;
  department_name?: string | null;
  name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  registration: string | null;
  admission_date: string;
  termination_date: string | null;
  salary: string | null;
  employment_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeDepartmentRow {
  id: string;
  firm_id: string;
  company_id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface EmployeeFilters {
  companyId?: string;
  status?: string;
  search?: string;
}

export interface EmployeeCreateRow {
  firmId: string;
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

export interface EmployeeUpdateRow {
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

const EMPLOYEE_SELECT = `
  SELECT e.id, e.firm_id, e.company_id, e.department_id,
         e.name, e.email, e.phone, e.job_title, e.registration,
         e.admission_date, e.termination_date, e.employment_type,
         e.status, e.created_at, e.updated_at, e.deleted_at,
         sensitive.cpf, sensitive.salary,
         d.name AS department_name
  FROM hr_employees e
  LEFT JOIN hr_departments d ON d.id = e.department_id
  LEFT JOIN hr_employee_sensitive_data sensitive ON sensitive.employee_id = e.id
`;

export const employeeRepository = {
  async hasHrPermission(
    client: PoolClient,
    companyId: string,
    permission: HrPermission,
  ): Promise<boolean> {
    const result = await client.query<{ allowed: boolean }>(
      `SELECT public.app_user_has_hr_permission($1, $2) AS allowed`,
      [companyId, permission],
    );
    return result.rows[0]?.allowed === true;
  },

  async hasAnyHrPermission(
    client: PoolClient,
    permission: HrPermission,
  ): Promise<boolean> {
    const result = await client.query<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM user_company_hr_permissions p
         WHERE p.user_id = public.app_current_user_id()
           AND public.app_user_has_hr_permission(p.company_id, $1)
       ) AS allowed`,
      [permission],
    );
    return result.rows[0]?.allowed === true;
  },

  async findAll(
    client: PoolClient,
    filters: EmployeeFilters = {}
  ): Promise<EmployeeRow[]> {
    const conditions: string[] = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`e.company_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`e.status = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(e.name ILIKE $${params.length} OR sensitive.cpf ILIKE $${params.length} OR e.job_title ILIKE $${params.length} OR e.registration ILIKE $${params.length})`
      );
    }

    const sql = `
      ${EMPLOYEE_SELECT}
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.name ASC
    `;

    const result = await client.query<EmployeeRow>(sql, params);
    return result.rows;
  },

  async findDepartments(
    client: PoolClient,
    companyId: string
  ): Promise<EmployeeDepartmentRow[]> {
    const result = await client.query<EmployeeDepartmentRow>(
      `
        SELECT id, firm_id, company_id, name, description, active
        FROM hr_departments
        WHERE company_id = $1
        ORDER BY active DESC, name ASC
      `,
      [companyId]
    );
    return result.rows;
  },

  async findById(
    client: PoolClient,
    employeeId: string
  ): Promise<EmployeeRow | null> {
    const result = await client.query<EmployeeRow>(
      `
        ${EMPLOYEE_SELECT}
        WHERE e.id = $1
          AND e.deleted_at IS NULL
        LIMIT 1
      `,
      [employeeId]
    );

    return result.rows[0] ?? null;
  },

  async create(
    client: PoolClient,
    data: EmployeeCreateRow
  ): Promise<EmployeeRow> {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO hr_employees (
          firm_id,
          company_id,
          department_id,
          name,
          email,
          phone,
          job_title,
          registration,
          admission_date,
          termination_date,
          employment_type,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12
        )
        RETURNING id
      `,
      [
        data.firmId,
        data.companyId,
        data.departmentId ?? null,
        data.name,
        data.email ?? null,
        data.phone ?? null,
        data.jobTitle ?? null,
        data.registration ?? null,
        data.admissionDate,
        data.terminationDate ?? null,
        data.employmentType ?? "clt",
        data.status ?? "active",
      ]
    );

    const employeeId = result.rows[0]?.id;
    if (!employeeId) throw new Error("Falha ao criar colaborador.");

    await client.query(
      `INSERT INTO hr_employee_sensitive_data (employee_id, firm_id, company_id, cpf, salary)
       VALUES ($1, $2, $3, $4, $5)`,
      [employeeId, data.firmId, data.companyId, data.cpf, data.salary ?? null],
    );

    const employee = await this.findById(client, employeeId);
    if (!employee) throw new Error("Falha ao consultar colaborador recém-criado.");
    return employee;
  },

  async update(
    client: PoolClient,
    employeeId: string,
    data: EmployeeUpdateRow
  ): Promise<EmployeeRow | null> {
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (column: string, value: unknown) => {
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    };

    if (data.companyId !== undefined) addField("company_id", data.companyId);
    if (data.departmentId !== undefined) addField("department_id", data.departmentId);
    if (data.name !== undefined) addField("name", data.name);
    if (data.email !== undefined) addField("email", data.email);
    if (data.phone !== undefined) addField("phone", data.phone);
    if (data.jobTitle !== undefined) addField("job_title", data.jobTitle);
    if (data.registration !== undefined) addField("registration", data.registration);
    if (data.admissionDate !== undefined) addField("admission_date", data.admissionDate);
    if (data.terminationDate !== undefined) addField("termination_date", data.terminationDate);
    if (data.employmentType !== undefined) addField("employment_type", data.employmentType);
    if (data.status !== undefined) addField("status", data.status);

    if (fields.length > 0) {
      fields.push("updated_at = now()");
      params.push(employeeId);
      const result = await client.query<{ id: string }>(
        `UPDATE hr_employees
         SET ${fields.join(", ")}
         WHERE id = $${params.length}
           AND deleted_at IS NULL
         RETURNING id`,
        params
      );
      if (!result.rows[0]) return null;
    }

    const sensitiveFields: string[] = [];
    const sensitiveParams: unknown[] = [];
    if (data.cpf !== undefined) {
      sensitiveParams.push(data.cpf);
      sensitiveFields.push(`cpf = $${sensitiveParams.length}`);
    }
    if (data.salary !== undefined) {
      sensitiveParams.push(data.salary);
      sensitiveFields.push(`salary = $${sensitiveParams.length}`);
    }
    if (sensitiveFields.length > 0) {
      sensitiveFields.push("updated_at = now()");
      sensitiveParams.push(employeeId);
      const result = await client.query(
        `UPDATE hr_employee_sensitive_data
         SET ${sensitiveFields.join(", ")}
         WHERE employee_id = $${sensitiveParams.length}`,
        sensitiveParams,
      );
      if (result.rowCount !== 1) return null;
    }

    return this.findById(client, employeeId);
  },

  async softDelete(
    client: PoolClient,
    employeeId: string
  ): Promise<boolean> {
    const result = await client.query(
      `
        UPDATE hr_employees
        SET deleted_at = now(),
            updated_at = now()
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [employeeId]
    );

    return (result.rowCount ?? 0) > 0;
  },
};