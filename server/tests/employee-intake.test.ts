import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEmployeeInstruction } from "../../modules/folha-pagamento/employeeIntake.ts";

test("parses explicitly labeled supported employee fields locally", () => {
  const result = parseEmployeeInstruction(
    "Nome completo: Alice Silva; CPF: 529.982.247-25; empresa empregadora: Acme; e-mail: alice@example.com; admissão: 15/01/2024; salário-base: R$ 3.500,00; tipo de vínculo: CLT; situação: ativo"
  );

  assert.deepEqual(result.values, {
    name: "Alice Silva",
    cpf: "529.982.247-25",
    companyName: "Acme",
    email: "alice@example.com",
    admissionDate: "2024-01-15",
    salary: 3500,
    employmentType: "clt",
    status: "active",
  });
  assert.deepEqual(result.warnings, []);
});

test("does not import unsupported fields or let them contaminate adjacent values", () => {
  const result = parseEmployeeInstruction(
    "Nome: Alice Silva; data de nascimento: 05/05/1990; CPF: 123"
  );

  assert.equal(result.values.name, "Alice Silva");
  assert.equal(result.values.cpf, "123");
  assert.equal("birthDate" in result.values, false);
  assert.match(result.warnings.join(" "), /data de nascimento.*não é suportado/i);
});

test("drops repeated fields as ambiguous instead of silently choosing a value", () => {
  const result = parseEmployeeInstruction("Nome: Alice; Nome: Beatriz");

  assert.equal(result.values.name, undefined);
  assert.match(result.warnings.join(" "), /informado mais de uma vez/i);
});

test("rejects malformed dates, salaries, employment types, and statuses", () => {
  const result = parseEmployeeInstruction(
    "Admissão: 31/02/2024; salário: 1.234,567; tipo de vínculo: desconhecido; situação: talvez"
  );

  assert.deepEqual(result.values, {});
  assert.equal(result.warnings.length, 4);
});
