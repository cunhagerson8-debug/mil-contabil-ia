import assert from "node:assert/strict";
import { test } from "node:test";
import type { Company } from "../../modules/empresas/types.ts";
import { analyzeCertificate } from "../../modules/empresas/services/CertificateAnalyzer.ts";

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "company-1",
    razaoSocial: "Empresa de teste",
    nomeFantasia: "Teste",
    cnpj: "12345678000190",
    cnae: "0000-0/00",
    cnaeDescricao: "",
    regime: "Simples Nacional",
    responsavel: "Responsável",
    contadorResponsavel: "Contador",
    status: "Ativa",
    dataAbertura: "2020-01-01",
    socios: [],
    email: "",
    telefone: "",
    endereco: "",
    ...overrides,
  };
}

const now = new Date("2026-05-01T12:00:00.000Z");

test("classifies an empty certificate as not registered and has no day count", () => {
  const analysis = analyzeCertificate(makeCompany(), now);

  assert.equal(analysis.status, "Não cadastrado");
  assert.equal(analysis.daysRemaining, null);
  assert.equal(analysis.validUntil, null);
});

test("classifies partial or malformed certificate data as incomplete", () => {
  const partial = analyzeCertificate(makeCompany({
    certificadoDigitalTipo: "A1",
    certificadoDigitalCadastrado: true,
  }), now);
  const malformed = analyzeCertificate(makeCompany({
    certificadoDigitalValidade: "2026-02-30",
  }), now);

  assert.equal(partial.status, "Dados incompletos");
  assert.equal(partial.daysRemaining, null);
  assert.equal(malformed.status, "Dados incompletos");
  assert.equal(malformed.daysRemaining, null);
});

test("calculates remaining days from a valid date-only value", () => {
  const valid = analyzeCertificate(makeCompany({
    certificadoDigitalValidade: "2026-06-01",
  }), now);
  const nearingExpiry = analyzeCertificate(makeCompany({
    certificadoDigitalValidade: "2026-05-31",
  }), now);

  assert.equal(valid.status, "Válido");
  assert.equal(valid.daysRemaining, 31);
  assert.equal(nearingExpiry.status, "Próximo do vencimento");
  assert.equal(nearingExpiry.daysRemaining, 30);
});

test("classifies expired and revoked certificates without reporting remaining days", () => {
  const expired = analyzeCertificate(makeCompany({
    certificadoDigitalValidade: "2026-04-30",
  }), now);
  const revoked = analyzeCertificate(makeCompany({
    certificadoDigitalValidade: "2026-06-01",
    certificadoDigitalRevogado: true,
  }), now);

  assert.equal(expired.status, "Vencido");
  assert.equal(expired.daysRemaining, null);
  assert.equal(expired.daysExpired, 1);
  assert.equal(revoked.status, "Revogado");
  assert.equal(revoked.daysRemaining, null);
});
