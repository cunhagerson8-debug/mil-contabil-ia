import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://admin-test:admin-test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RLS_CONTEXT_SECRET = "test-rls-context-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini-key-not-used";

const {
  createPublicCommercialLeadService,
} = await import("../src/services/commercialLead.service.js");
const {
  normalizeBrazilianWhatsApp,
  publicCommercialLeadSchema,
} = await import("../src/validators/commercialLead.validators.js");

const validInput = {
  name: "Ana Exemplo",
  whatsapp: "(11) 99999-1234",
  email: "ana@example.com",
  serviceInterest: "accounting_services",
  voluntaryDetails: "Empresa em abertura",
  consent: true,
};

test("commercial lead requires explicit consent before repository access", async () => {
  let called = false;
  const service = createPublicCommercialLeadService({
    async insertIfNew() { called = true; },
  });

  await assert.rejects(
    service.submit({ ...validInput, consent: false }),
    (error: unknown) => error instanceof Error && error.name === "ZodError",
  );
  assert.equal(called, false);
});

test("commercial lead normalizes Brazilian WhatsApp numbers", async () => {
  assert.equal(normalizeBrazilianWhatsApp("(11) 99999-1234"), "+5511999991234");
  assert.equal(normalizeBrazilianWhatsApp("+55 11 99999-1234"), "+5511999991234");
  assert.equal(normalizeBrazilianWhatsApp("11 ABC 9999"), null);

  const saved = new Map<string, { whatsappE164: string; consentVersion: string }>();
  const service = createPublicCommercialLeadService({
    async insertIfNew(input) {
      if (!saved.has(input.whatsappE164)) {
        saved.set(input.whatsappE164, {
          whatsappE164: input.whatsappE164,
          consentVersion: input.consentVersion,
        });
      }
    },
  });
  const result = await service.submit(validInput);
  await service.submit({ ...validInput, whatsapp: "+55 11 99999-1234" });

  assert.deepEqual(result, { accepted: true });
  assert.deepEqual([...saved.values()], [{ whatsappE164: "+5511999991234", consentVersion: "mila-lead-v1" }]);
});

test("commercial lead honeypot does not persist submitted contact details", async () => {
  let called = false;
  const service = createPublicCommercialLeadService({
    async insertIfNew() { called = true; },
  });

  assert.deepEqual(await service.submit({ ...validInput, website: "bot-filled" }), { accepted: true });
  assert.equal(called, false);
});

test("commercial lead database errors log no contact data", async () => {
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };

  try {
    const service = createPublicCommercialLeadService({
      async insertIfNew() {
        throw Object.assign(new Error("failure containing Ana Exemplo +5511999991234"), { code: "08006" });
      },
    });

    await assert.rejects(
      service.submit(validInput),
      (error: unknown) => error instanceof Error
        && error.name === "ServiceUnavailableError"
        && !error.message.includes("Ana Exemplo"),
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes("Ana Exemplo"), false);
  assert.equal(JSON.stringify(logs).includes("+5511999991234"), false);
  assert.equal(JSON.stringify(logs).includes("08006"), true);
});

test("commercial lead form rejects unconsented, malformed, or unexpected fields", () => {
  assert.equal(publicCommercialLeadSchema.safeParse(validInput).success, true);
  assert.equal(publicCommercialLeadSchema.safeParse({ ...validInput, consent: undefined }).success, false);
  assert.equal(publicCommercialLeadSchema.safeParse({ ...validInput, extra: "unexpected" }).success, false);
  assert.equal(publicCommercialLeadSchema.safeParse({ ...validInput, email: "not-an-email" }).success, false);
});
