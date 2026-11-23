import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://admin-test:admin-test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RLS_CONTEXT_SECRET = "test-rls-context-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini-key-not-used";

const { createAiChatService } = await import("../src/services/ai-chat.service.js");
const { errorHandler } = await import("../src/middleware/errorHandler.js");
const { ServiceUnavailableError } = await import("../src/utils/errors.js");

const tenantContext = {
  userId: "test-user",
  firmId: "test-firm",
  role: "accountant",
};

test("AI chat retries 429 and 503 with progressive delays and falls back to a supported model", async () => {
  const models: string[] = [];
  const delays: number[] = [];
  const service = createAiChatService({
    buildContext: async () => ({ scope: "test-tenant" }),
    generateContent: async ({ model }) => {
      models.push(model);
      if (models.length === 1) {
        throw Object.assign(new Error("private provider response"), {
          status: 429,
          code: "RESOURCE_EXHAUSTED",
        });
      }
      if (models.length === 2) {
        throw Object.assign(new Error("private provider response"), {
          status: 503,
          code: "UNAVAILABLE",
        });
      }
      return { text: "Resposta disponível." };
    },
    wait: async (milliseconds) => { delays.push(milliseconds); },
    random: () => 0.5,
    logError: () => {},
  });

  const response = await service.chat(tenantContext, "Pergunta de teste");

  assert.equal(response, "Resposta disponível.");
  assert.deepEqual(models, [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.6-flash",
  ]);
  assert.deepEqual(delays, [500, 1000]);
});

test("AI chat returns ServiceUnavailableError after the bounded transient attempts and logs no provider message", async () => {
  const delays: number[] = [];
  const logs: unknown[] = [];
  let calls = 0;
  const service = createAiChatService({
    buildContext: async () => ({ scope: "test-tenant" }),
    generateContent: async () => {
      calls += 1;
      throw Object.assign(new Error("private provider body and credential"), {
        status: 503,
        code: "UNAVAILABLE",
      });
    },
    wait: async (milliseconds) => { delays.push(milliseconds); },
    random: () => 0.5,
    logError: (event, details) => { logs.push({ event, details }); },
  });

  await assert.rejects(
    service.chat(tenantContext, "Pergunta de teste"),
    (error: unknown) => error instanceof Error
      && error.name === "ServiceUnavailableError"
      && error.message === "A MIL IA está temporariamente indisponível. Tente novamente em alguns instantes.",
  );

  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1000]);
  assert.equal(JSON.stringify(logs).includes("private provider body"), false);
  assert.equal(JSON.stringify(logs).includes("credential"), false);
});

test("the API error handler maps Gemini unavailability to HTTP 503", () => {
  let responseStatus: number | undefined;
  let responseBody: unknown;
  const response = {
    status(status: number) {
      responseStatus = status;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  };

  errorHandler(
    new ServiceUnavailableError("A MIL IA está temporariamente indisponível."),
    { method: "POST", path: "/api/ai/chat" } as never,
    response as never,
    (() => {}) as never,
  );

  assert.equal(responseStatus, 503);
  assert.deepEqual(responseBody, { error: "A MIL IA está temporariamente indisponível." });
});

test("AI chat does not retry non-transient provider errors or expose their message", async () => {
  let calls = 0;
  const delays: number[] = [];
  const logs: unknown[] = [];
  const service = createAiChatService({
    buildContext: async () => ({ scope: "test-tenant" }),
    generateContent: async () => {
      calls += 1;
      throw Object.assign(new Error("private invalid request details"), { status: 400 });
    },
    wait: async (milliseconds) => { delays.push(milliseconds); },
    logError: (event, details) => { logs.push({ event, details }); },
  });

  await assert.rejects(
    service.chat(tenantContext, "Pergunta de teste"),
    (error: unknown) => error instanceof Error
      && error.message === "Não foi possível consultar a IA no momento.",
  );

  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
  assert.equal(JSON.stringify(logs).includes("private invalid request details"), false);
});
