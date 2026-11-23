
import { apiRequest } from "./apiClient";

export type EmployeeStatus = "active" | "vacation" | "leave" | "terminated";

export interface Employee {
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
  salary: string | number | null;
  employment_type: string;
  status: EmployeeStatus;
}

export interface EmployeeDepartment {
  id: string;
  firm_id: string;
  company_id: string;
  name: string;
  description: string | null;
  active: boolean;
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
  status?: EmployeeStatus;
}

export type EmployeeUpdateInput = Partial<EmployeeCreateInput>;

export const employeesApi = {
  async list(filters: {
    companyId?: string;
    status?: string;
    search?: string;
  } = {}): Promise<Employee[]> {
    const { employees } = await apiRequest<{ employees: Employee[] }>(
      "/api/employees",
      { query: filters }
    );
    return employees;
  },

  async listDepartments(companyId: string): Promise<EmployeeDepartment[]> {
    const { departments } = await apiRequest<{ departments: EmployeeDepartment[] }>(
      "/api/employees/departments",
      { query: { companyId } }
    );
    return departments;
  },

  async getById(id: string): Promise<Employee> {
    const { employee } = await apiRequest<{ employee: Employee }>(
      `/api/employees/${id}`
    );
    return employee;
  },

  async create(input: EmployeeCreateInput): Promise<Employee> {
    const { employee } = await apiRequest<{ employee: Employee }>(
      "/api/employees",
      { method: "POST", body: input }
    );
    return employee;
  },

  async update(
    id: string,
    input: EmployeeUpdateInput
  ): Promise<Employee> {
    const { employee } = await apiRequest<{ employee: Employee }>(
      `/api/employees/${id}`,
      { method: "PUT", body: input }
    );
    return employee;
  },

  async remove(id: string): Promise<void> {
    await apiRequest(`/api/employees/${id}`, {
      method: "DELETE"
    });
  }
};
