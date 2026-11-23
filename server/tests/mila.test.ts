import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://admin-test:admin-test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RLS_CONTEXT_SECRET = "test-rls-context-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini-key-not-used";

const { createMilaService } = await import("../src/services/mila.service.js");

async function captureFailureMetadata(error: unknown): Promise<Record<string, unknown>> {
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  try {
    const service = createMilaService(async () => { throw error; });
    await assert.rejects(
      service.chat({ message: "Oi" }),
      (caught: unknown) => caught instanceof Error
        && caught.name === "ServiceUnavailableError"
        && caught.message === "A Mila está indisponível neste momento. Tente novamente mais tarde.",
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], "[mila] Falha ao gerar resposta");
  assert.ok(logs[0][1] && typeof logs[0][1] === "object");
  return logs[0][1] as Record<string, unknown>;
}

test("Mila service forwards bounded session context to its generator", async () => {
  let received: { message: string; historyLength: number } | undefined;
  const service = createMilaService(async (message, history) => {
    received = { message, historyLength: history.length };
    return "Olá! Posso ajudar com informações gerais.";
  });

  const response = await service.chat({
    message: " Conhecer os planos ",
    history: [{ role: "assistant", content: "Olá!" }],
  });

  assert.equal(response, "Olá! Posso ajudar com informações gerais.");
  assert.deepEqual(received, { message: "Conhecer os planos", historyLength: 1 });
});

test("Mila service rejects invalid messages before invoking its generator", async () => {
  let generatorCalled = false;
  const service = createMilaService(async () => {
    generatorCalled = true;
    return "Não deveria ser chamado.";
  });

  await assert.rejects(
    service.chat({ message: "   ", history: [] }),
    (error: unknown) => error instanceof Error && error.name === "ZodError",
  );
  await assert.rejects(
    service.chat({ message: "x".repeat(1201), history: [] }),
    (error: unknown) => error instanceof Error && error.name === "ZodError",
  );
  assert.equal(generatorCalled, false);
});

test("Mila service logs provider HTTP status and nested codes without response content", async () => {
  const error = Object.assign(new Error("private provider response body"), {
    status: 504,
    error: {
      error: {
        code: 504,
        status: "DEADLINE_EXCEEDED",
        message: "private conversation details",
      },
    },
  });
  const metadata = await captureFailureMetadata(error);

  assert.equal(metadata.failureType, "provider_http");
  assert.equal(metadata.providerHttpStatus, 504);
  assert.equal(metadata.providerErrorCode, 504);
  assert.equal(metadata.providerErrorStatus, "DEADLINE_EXCEEDED");
  assert.equal(typeof metadata.durationMs, "number");
  assert.equal(JSON.stringify(metadata).includes("private"), false);
});

test("Mila service distinguishes its local request timeout", async () => {
  const error = Object.assign(new Error("private timeout details"), {
    name: "AbortError",
    code: "ABORT_ERR",
  });
  const metadata = await captureFailureMetadata(error);

  assert.equal(metadata.failureType, "local_timeout");
  assert.equal(metadata.providerHttpStatus, undefined);
  assert.equal(typeof metadata.durationMs, "number");
});

test("Mila service distinguishes a network failure", async () => {
  const cause = Object.assign(new Error("private socket details"), { code: "ECONNRESET" });
  const error = Object.assign(new TypeError("private fetch details"), { cause });
  const metadata = await captureFailureMetadata(error);

  assert.equal(metadata.failureType, "network_failure");
  assert.equal(metadata.providerHttpStatus, undefined);
  assert.equal(typeof metadata.durationMs, "number");
});
