import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCpf, isValidCpf } from "../../modules/folha-pagamento/employeeValidation.ts";
import { parsePartnerInstruction } from "../../modules/folha-pagamento/partnerIntake.ts";

test("keeps the sole administrator and unreported withdrawal explicit without inventing payroll values", () => {
  const result = parsePartnerInstruction(
    "Empresa: MIL Gestão & Tecnologia; Perfil: sócio único e administrador; Pró-labore: nenhuma retirada informada atualmente"
  );

  assert.deepEqual(result.values, {
    companyName: "MIL Gestão & Tecnologia",
    isAdministrator: true,
    isSoleShareholder: true,
    withdrawalStatus: "not_reported",
  });
  assert.equal(result.values.proLaboreAmount, undefined);
  assert.equal(result.values.competence, undefined);
  assert.deepEqual(result.warnings, []);
});

test("accepts an explicit no-withdrawal declaration only with the stated competence", () => {
  const result = parsePartnerInstruction(
    "Competência: 11/2026; Pró-labore: sem retirada declarada"
  );

  assert.equal(result.values.competence, "2026-11");
  assert.equal(result.values.withdrawalStatus, "none_declared");
  assert.equal(result.values.proLaboreAmount, undefined);
});

test("parses an informed pro-labore amount and payment status without calculating either", () => {
  const result = parsePartnerInstruction(
    "Competência do pró-labore: 2026-10; Pró-labore: R$ 2.450,00; Pagamento: pendente"
  );

  assert.equal(result.values.competence, "2026-10");
  assert.equal(result.values.proLaboreAmount, 2450);
  assert.equal(result.values.withdrawalStatus, "amount_reported");
  assert.equal(result.values.paymentStatus, "pending");
});

test("rejects malformed competence and ambiguous duplicate values", () => {
  const invalid = parsePartnerInstruction("Competência: 13/2026; Participação: 101%");
  assert.deepEqual(invalid.values, {});
  assert.equal(invalid.warnings.length, 2);

  const duplicate = parsePartnerInstruction("Empresa: Uma; Empresa: Outra");
  assert.equal(duplicate.values.companyName, undefined);
  assert.match(duplicate.warnings.join(" "), /informado mais de uma vez/i);
});

test("shares CPF formatting and validation with the employee form", () => {
  assert.equal(formatCpf("52998224725"), "529.982.247-25");
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("123.456.789-00"), false);
});
