import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://admin-test:admin-test@localhost:5432/test";
process.env.JWT_SECRET = "password-reset-test-jwt-secret";
process.env.RLS_CONTEXT_SECRET = "password-reset-test-rls-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini-key-not-used";
process.env.RESEND_API_KEY = "re_test_key_not_real";
process.env.DISABLE_BACKGROUND_JOBS = "true";

const { createPasswordResetService } = await import("../src/services/passwordReset.service.js");
const { EmailDeliveryError, emailService } = await import("../src/services/email.service.js");
const { authService } = await import("../src/services/auth.service.js");

const TOKEN = "a".repeat(43);
const EMAIL = "ana@example.com";
const USER = { id: "user-1", email: EMAIL, full_name: "Ana Exemplo" };
const REQUEST = { id: "request-1", email: EMAIL, attempts: 1 };
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function makeRepository(overrides: Record<string, unknown> = {}) {
  const state = {
    enqueued: [] as Array<{ email: string; emailHash: string }>,
    issuedTokens: [] as Array<{ userId: string; tokenHash: string; expiresAt: Date }>,
    revokedTokens: [] as string[],
    completed: [] as string[],
    retries: [] as Array<{ id: string; attempts: number; availableAt: Date | null; errorCode: string }>,
    usableToken: true,
    resetTokenHash: "",
    resetPasswordHash: "",
    request: REQUEST as { id: string; email: string; attempts: number } | null,
    user: USER as { id: string; email: string; full_name: string } | null,
  };

  const repository = {
    async enqueueRequest(email: string, emailHash: string) {
      state.enqueued.push({ email, emailHash });
      return true;
    },
    async claimNextRequest() {
      const request = state.request;
      state.request = null;
      return request;
    },
    async findResettableUserByEmail() {
      return state.user;
    },
    async replaceActiveToken(userId: string, tokenHash: string, expiresAt: Date) {
      state.issuedTokens.push({ userId, tokenHash, expiresAt });
    },
    async revokeToken(tokenHash: string) {
      state.revokedTokens.push(tokenHash);
    },
    async completeRequest(requestId: string) {
      state.completed.push(requestId);
    },
    async retryRequest(id: string, attempts: number, availableAt: Date | null, errorCode: string) {
      state.retries.push({ id, attempts, availableAt, errorCode });
    },
    async cleanup() {},
    async hasUsableToken() {
      return state.usableToken;
    },
    async consumeTokenAndUpdatePassword(tokenHash: string, passwordHash: string) {
      if (!state.usableToken) return false;
      state.usableToken = false;
      state.resetTokenHash = tokenHash;
      state.resetPasswordHash = passwordHash;
      return true;
    },
    ...overrides,
  };

  return { repository, state };
}

function makeService(
  repository: ReturnType<typeof makeRepository>["repository"],
  options: {
    sendPasswordResetEmail?: (data: { to: string; fullName: string; token: string; expiresAt: Date }) => Promise<void>;
    workerEnabled?: boolean;
    logs?: Array<{ message: string; metadata: Record<string, string | number> }>;
  } = {},
) {
  const logs = options.logs ?? [];
  return createPasswordResetService({
    repository,
    sendPasswordResetEmail: options.sendPasswordResetEmail ?? (async () => {}),
    hashEmail: (email) => `email-hash:${email}`,
    createToken: () => TOKEN,
    hashToken,
    hashPassword: async (password) => `hashed:${password}`,
    now: () => 1_800_000_000_000,
    workerEnabled: options.workerEnabled ?? true,
    log: (message, metadata) => logs.push({ message, metadata }),
  });
}

test("password reset requests return the same accepted result without account lookup", async () => {
  const { repository, state } = makeRepository();
  const service = makeService(repository);

  assert.deepEqual(await service.requestPasswordReset(" Ana@Example.COM "), { accepted: true });
  assert.deepEqual(await service.requestPasswordReset("missing@example.com"), { accepted: true });
  assert.deepEqual(state.enqueued, [
    { email: EMAIL, emailHash: `email-hash:${EMAIL}` },
    { email: "missing@example.com", emailHash: "email-hash:missing@example.com" },
  ]);
});

test("password reset requests fail generically when the queue cannot accept work", async () => {
  const { repository } = makeRepository({
    async enqueueRequest() {
      throw new Error("database details");
    },
  });
  const service = makeService(repository);

  await assert.rejects(
    service.requestPasswordReset(EMAIL),
    (error: unknown) => error instanceof Error
      && error.name === "ServiceUnavailableError"
      && !error.message.includes(EMAIL),
  );
});

test("queued reset creates a single-use token hash and sends through the injected mailer", async () => {
  const { repository, state } = makeRepository();
  let email: { to: string; fullName: string; token: string; expiresAt: Date } | null = null;
  const service = makeService(repository, {
    sendPasswordResetEmail: async (data) => { email = data; },
  });

  assert.equal(await service.processNextRequest(), true);
  assert.equal(state.issuedTokens.length, 1);
  assert.equal(state.issuedTokens[0].userId, USER.id);
  assert.equal(state.issuedTokens[0].tokenHash, hashToken(TOKEN));
  assert.notEqual(state.issuedTokens[0].tokenHash, TOKEN);
  assert.equal(state.issuedTokens[0].expiresAt.getTime(), 1_800_000_000_000 + 30 * 60 * 1000);
  assert.deepEqual(email, {
    to: USER.email,
    fullName: USER.full_name,
    token: TOKEN,
    expiresAt: state.issuedTokens[0].expiresAt,
  });
  assert.deepEqual(state.completed, [REQUEST.id]);
});

test("unknown and non-password accounts are completed without sending a message", async () => {
  const { repository, state } = makeRepository();
  state.user = null;
  let sends = 0;
  const service = makeService(repository, {
    sendPasswordResetEmail: async () => { sends += 1; },
  });

  assert.equal(await service.processNextRequest(), true);
  assert.equal(sends, 0);
  assert.deepEqual(state.completed, [REQUEST.id]);
  assert.equal(state.issuedTokens.length, 0);
});

test("Resend failure revokes the token, schedules retry, and logs no sensitive values", async () => {
  const { repository, state } = makeRepository();
  const logs: Array<{ message: string; metadata: Record<string, string | number> }> = [];
  const service = makeService(repository, {
    sendPasswordResetEmail: async () => {
      throw new EmailDeliveryError(`failed for ${EMAIL} ${TOKEN}`, 503);
    },
    logs,
  });

  assert.equal(await service.processNextRequest(), true);
  assert.deepEqual(state.revokedTokens, [hashToken(TOKEN)]);
  assert.equal(state.retries[0].id, REQUEST.id);
  assert.equal(state.retries[0].attempts, REQUEST.attempts);
  assert.equal(state.retries[0].errorCode, "email_delivery");
  assert.equal(JSON.stringify(logs).includes(EMAIL), false);
  assert.equal(JSON.stringify(logs).includes(TOKEN), false);
});

test("password reset consumes the token and stores only a password hash", async () => {
  const { repository, state } = makeRepository();
  const service = makeService(repository);

  await service.resetPassword(TOKEN, "new-secure-password");

  assert.equal(state.resetTokenHash, hashToken(TOKEN));
  assert.notEqual(state.resetTokenHash, TOKEN);
  assert.equal(state.resetPasswordHash, "hashed:new-secure-password");
  await assert.rejects(
    service.resetPassword(TOKEN, "another-secure-password"),
    (error: unknown) => error instanceof Error && error.name === "ValidationError",
  );
});

test("invalid reset tokens use a generic error and do not hash the password", async () => {
  const { repository, state } = makeRepository();
  state.usableToken = false;
  let hashedPassword = false;
  const service = createPasswordResetService({
    repository,
    sendPasswordResetEmail: async () => {},
    hashEmail: (email) => email,
    createToken: () => TOKEN,
    hashToken,
    hashPassword: async () => { hashedPassword = true; return "hash"; },
    now: () => Date.now(),
    workerEnabled: true,
    log: () => {},
  });

  await assert.rejects(
    service.resetPassword(TOKEN, "new-secure-password"),
    (error: unknown) => error instanceof Error
      && error.name === "ValidationError"
      && error.message.includes("inválido ou expirou"),
  );
  assert.equal(hashedPassword, false);
});

test("password recovery refuses requests when its worker is disabled", async () => {
  const { repository, state } = makeRepository();
  const service = makeService(repository, { workerEnabled: false });

  await assert.rejects(
    service.requestPasswordReset(EMAIL),
    (error: unknown) => error instanceof Error && error.name === "ServiceUnavailableError",
  );
  assert.equal(state.enqueued.length, 0);
});

test("reset links use the existing Resend transport without a real network call", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody = "";
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body);
    return new Response(null, { status: 200 });
  };

  try {
    await emailService.sendPasswordResetEmail({
      to: EMAIL,
      fullName: USER.full_name,
      token: TOKEN,
      expiresAt: new Date(1_800_000_000_000 + 30 * 60 * 1000),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const payload = JSON.parse(requestBody) as { html: string; text: string; to: string[] };
  assert.equal(requestUrl, "https://api.resend.com/emails");
  assert.deepEqual(payload.to, [EMAIL]);
  assert.ok(payload.html.includes(`#/redefinir-senha?token=${TOKEN}`));
  assert.ok(payload.text.includes(`#/redefinir-senha?token=${TOKEN}`));
});

test("Resend rejection is surfaced without including recipient or token", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ name: "rate_limit" }), { status: 503 });

  try {
    await assert.rejects(
      emailService.sendPasswordResetEmail({
        to: EMAIL,
        fullName: USER.full_name,
        token: TOKEN,
        expiresAt: new Date(1_800_000_000_000 + 30 * 60 * 1000),
      }),
      (error: unknown) => error instanceof Error
        && error.name === "EmailDeliveryError"
        && !error.message.includes(EMAIL)
        && !error.message.includes(TOKEN),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy JWTs remain valid at session version zero and carry the version after reset", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const firmId = "22222222-2222-4222-8222-222222222222";
  const legacyToken = jwt.sign({ sub: userId, firmId, role: "firm_owner" }, process.env.JWT_SECRET!);
  const currentToken = jwt.sign(
    { sub: userId, firmId, role: "firm_owner", sessionVersion: 3 },
    process.env.JWT_SECRET!,
  );

  assert.equal(authService.verifyToken(legacyToken).sessionVersion, 0);
  assert.equal(authService.verifyToken(currentToken).sessionVersion, 3);
});
