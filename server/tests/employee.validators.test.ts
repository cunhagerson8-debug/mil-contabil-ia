import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmployeeSchema,
  listEmployeesQuerySchema,
  updateEmployeeSchema,
} from "../src/validators/employee.validators.js";

const companyId = "123e4567-e89b-12d3-a456-426614174000";

const validEmployee = {
  companyId,
  name: "Colaborador de teste",
  cpf: "123.456.789-09",
  admissionDate: "2025-01-15",
};

test("employee create validation normalizes CPF and accepts the existing schema fields", () => {
  const result = createEmployeeSchema.safeParse(validEmployee);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.cpf, "12345678909");
});

test("employee validation rejects invalid CPF and impossible dates", () => {
  assert.equal(createEmployeeSchema.safeParse({ ...validEmployee, cpf: "111.111.111-11" }).success, false);
  assert.equal(createEmployeeSchema.safeParse({ ...validEmployee, cpf: "abc12345678909" }).success, false);
  assert.equal(createEmployeeSchema.safeParse({ ...validEmployee, admissionDate: "2025-02-30" }).success, false);
  assert.equal(
    createEmployeeSchema.safeParse({
      ...validEmployee,
      terminationDate: "2025-02-01",
      status: "active",
    }).success,
    false
  );
});

test("employee termination requires a date on or after admission", () => {
  assert.equal(
    createEmployeeSchema.safeParse({ ...validEmployee, status: "terminated" }).success,
    false
  );
  assert.equal(
    updateEmployeeSchema.safeParse({ status: "terminated", terminationDate: "2025-01-14", admissionDate: "2025-01-15" }).success,
    false
  );
  assert.equal(
    updateEmployeeSchema.safeParse({ status: "terminated", terminationDate: "2025-01-15" }).success,
    true
  );
});

test("employee list filters accept only supported status values and UUIDs", () => {
  assert.equal(listEmployeesQuerySchema.safeParse({ companyId, status: "vacation", search: "M-001" }).success, true);
  assert.equal(listEmployeesQuerySchema.safeParse({ status: "paid" }).success, false);
  assert.equal(listEmployeesQuerySchema.safeParse({ companyId: "another-office" }).success, false);
});
