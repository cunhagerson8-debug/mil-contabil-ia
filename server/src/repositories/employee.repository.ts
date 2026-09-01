// ============================================================
// Repository: Gestão de RH - Colaboradores
// ============================================================

import { PoolClient } from "pg";

export interface EmployeeRow {
  id: string;
  firm_id: string;
  company_id: string;
  department_id: string | null;
  name: string;
  cpf: string;
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

export const employeeRepository = {
  async findAll(
    client: PoolClient,
    filters: EmployeeFilters = {}
  ): Promise<EmployeeRow[]> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters.companyId) {
      params.push(filters.companyId);
      conditions.push(`company_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(name ILIKE $${params.length} OR cpf ILIKE $${params.length} OR job_title ILIKE $${params.length})`
      );
    }

    const sql = `
      SELECT *
      FROM hr_employees
      WHERE ${conditions.join(" AND ")}
      ORDER BY name ASC
    `;

    const result = await client.query<EmployeeRow>(sql, params);
    return result.rows;
  },

  async findById(
    client: PoolClient,
    employeeId: string
  ): Promise<EmployeeRow | null> {
    const result = await client.query<EmployeeRow>(
      `
        SELECT *
        FROM hr_employees
        WHERE id = $1
          AND deleted_at IS NULL
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
    const result = await client.query<EmployeeRow>(
      `
        INSERT INTO hr_employees (
          firm_id,
          company_id,
          department_id,
          name,
          cpf,
          email,
          phone,
          job_title,
          registration,
          admission_date,
          termination_date,
          salary,
          employment_type,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING *
      `,
      [
        data.firmId,
        data.companyId,
        data.departmentId ?? null,
        data.name,
        data.cpf,
        data.email ?? null,
        data.phone ?? null,
        data.jobTitle ?? null,
        data.registration ?? null,
        data.admissionDate,
        data.terminationDate ?? null,
        data.salary ?? null,
        data.employmentType ?? "clt",
        data.status ?? "active",
      ]
    );

    return result.rows[0];
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
    if (data.cpf !== undefined) addField("cpf", data.cpf);
    if (data.email !== undefined) addField("email", data.email);
    if (data.phone !== undefined) addField("phone", data.phone);
    if (data.jobTitle !== undefined) addField("job_title", data.jobTitle);
    if (data.registration !== undefined) addField("registration", data.registration);
    if (data.admissionDate !== undefined) addField("admission_date", data.admissionDate);
    if (data.terminationDate !== undefined) addField("termination_date", data.terminationDate);
    if (data.salary !== undefined) addField("salary", data.salary);
    if (data.employmentType !== undefined) addField("employment_type", data.employmentType);
    if (data.status !== undefined) addField("status", data.status);

    if (fields.length === 0) {
      return this.findById(client, employeeId);
    }

    fields.push("updated_at = now()");
    params.push(employeeId);

    const result = await client.query<EmployeeRow>(
      `
        UPDATE hr_employees
        SET ${fields.join(", ")}
        WHERE id = $${params.length}
          AND deleted_at IS NULL
        RETURNING *
      `,
      params
    );

    return result.rows[0] ?? null;
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