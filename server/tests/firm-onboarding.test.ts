// Testes do onboarding de escritório (POST /api/admin/firms/onboarding), sem banco
// real: client pg falso em memória com snapshot/rollback + fetch simulado do Resend.
// Execução: npm test (dentro de server/)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret";
process.env.GEMINI_API_KEY = "test-gemini";
process.env.RESEND_API_KEY = "re_test_key_not_real";

const { pool } = await import("../src/db/pool.js");
const { firmOnboardingService } = await import("../src/services/firm.onboarding.service.js");
const { onboardFirmSchema } = await import("../src/validators/firm.validators.js");

const ADMIN = { userId: "admin-1", firmId: null, role: "platform_admin" };
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

interface Firm { id: string; name: string; trade_name: string | null; cnpj: string; status: string; email: string; phone: string | null; timezone: string }
interface Usr { id: string; firm_id: string; email: string; full_name: string; role: string; status: string; password_hash: string | null; invited_by: string }
interface Inv { user_id: string; token_hash: string; expires_at: Date; used_at: Date | null; revoked_at: Date | null }

let firms: Firm[] = [];
let users: Usr[] = [];
let invs: Inv[] = [];
let seq = 0;
let lockKeys: unknown[] = [];
const allParams: unknown[] = [];

function makeClient() {
  let snapshot: [Firm[], Usr[], Inv[]] | null = null;
  return {
    release() {},
    async query(sql: string, params: unknown[] = []) {
      allParams.push(...params);
      const s = sql.replace(/\s+/g, " ").trim();
      if (s === "BEGIN") { snapshot = [structuredClone(firms), structuredClone(users), structuredClone(invs)]; return { rows: [], rowCount: 0 }; }
      if (s === "COMMIT") { snapshot = null; return { rows: [], rowCount: 0 }; }
      if (s === "ROLLBACK") { if (snapshot) [firms, users, invs] = snapshot; return { rows: [], rowCount: 0 }; }
      if (s.startsWith("SELECT pg_advisory_xact_lock")) { lockKeys.push(params[0]); return { rows: [], rowCount: 0 }; }
      if (s.startsWith("SELECT EXISTS")) return { rows: [{ allowed: params[0] === ADMIN.userId }], rowCount: 1 };
      if (s.includes("FROM users u") && s.includes("WHERE u.email = $1")) {
        const u = users.find((x) => x.email === params[0]);
        return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
      }
      if (s.includes("FROM firms") && s.includes("WHERE cnpj = $1")) {
        const f = firms.find((x) => x.cnpj === params[0]);
        return { rows: f ? [f] : [], rowCount: f ? 1 : 0 };
      }
      if (s.startsWith("INSERT INTO firms")) {
        if (firms.some((x) => x.cnpj === params[2])) throw Object.assign(new Error("dup"), { code: "23505" });
        const f: Firm = {
          id: `firm-${++seq}`, name: params[0] as string, trade_name: params[1] as string | null,
          cnpj: params[2] as string, status: params[3] as string, email: params[4] as string,
          phone: params[5] as string | null, timezone: params[8] as string,
        };
        firms.push(f);
        return { rows: [f], rowCount: 1 };
      }
      if (s.startsWith("INSERT INTO users")) {
        const u: Usr = {
          id: `user-${++seq}`, firm_id: params[0] as string, email: params[1] as string,
          full_name: params[2] as string, role: params[3] as string, status: "invited",
          password_hash: null, invited_by: params[4] as string,
        };
        users.push(u);
        return { rows: [{ id: u.id }], rowCount: 1 };
      }
      if (s.startsWith("UPDATE user_invitations")) return { rows: [], rowCount: 0 };
      if (s.startsWith("INSERT INTO user_invitations")) {
        invs.push({ user_id: params[0] as string, token_hash: params[1] as string, expires_at: params[2] as Date, used_at: null, revoked_at: null });
        return { rows: [], rowCount: 1 };
      }
      if (s.includes("FROM users u") && s.includes("WHERE u.id = $1")) {
        const u = users.find((x) => x.id === params[0])!;
        const f = firms.find((x) => x.id === u.firm_id);
        return {
          rowCount: 1,
          rows: [{
            ...u, phone: null, avatar_url: null, mfa_enabled: false, last_login_at: null,
            created_at: new Date(), invited_at: new Date(), firm_name: f?.name ?? null, invited_by: "Admin",
          }],
        };
      }
      throw new Error(`SQL inesperado no teste: ${s.slice(0, 70)}`);
    },
  };
}

(pool as unknown as { connect: () => Promise<unknown> }).connect = async () => makeClient();

let fetchBodies: string[] = [];
let fetchOk = true;
globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
  fetchBodies.push(init?.body ?? "");
  return fetchOk
    ? new Response(JSON.stringify({ id: "x" }), { status: 200 })
    : new Response(JSON.stringify({ name: "validation_error" }), { status: 500 });
}) as typeof fetch;

const input = {
  name: "Contabilidade Nova Ltda", cnpj: "11.222.333/0001-81", email: "dono@novo.com.br",
  adminFullName: "Dono Novo", timezone: "America/Sao_Paulo",
};

beforeEach(() => {
  firms = [{ id: "firm-old", name: "Antigo", trade_name: null, cnpj: "99999999000199", status: "active", email: "a@antigo.com", phone: null, timezone: "America/Sao_Paulo" }];
  users = [{ id: "user-old", firm_id: "firm-old", email: "existente@antigo.com", full_name: "Existente", role: "firm_owner", status: "active", password_hash: "h", invited_by: "x" }];
  invs = []; seq = 0; lockKeys = []; allParams.length = 0; fetchBodies = []; fetchOk = true;
});

async function errorOf(p: Promise<unknown>): Promise<Error> {
  try { await p; } catch (e) { return e as Error; }
  throw new Error("deveria ter falhado");
}

test("onboarding: cria escritório trial + firm_owner invited + convite e envia e-mail", async () => {
  const res = await firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse(input));
  assert.equal(res.emailSent, true);
  assert.equal(firms.length, 2);
  const firm = firms[1];
  assert.equal(firm.status, "trial");
  assert.equal(firm.cnpj, "11222333000181");
  assert.equal(firm.email, "dono@novo.com.br");
  const user = users[1];
  assert.equal(user.role, "firm_owner");
  assert.equal(user.status, "invited");
  assert.equal(user.firm_id, firm.id);
  assert.equal(user.password_hash, null);
  assert.equal(invs.length, 1);
  assert.equal(invs[0].user_id, user.id);
  assert.match(invs[0].token_hash, /^[0-9a-f]{64}$/);
  assert.equal(lockKeys.length, 1);
  assert.equal(fetchBodies.length, 1);
});

test("onboarding: token puro nunca é persistido e resposta não vaza token/hash/senha", async () => {
  const res = await firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse(input));
  const sent = JSON.parse(fetchBodies[0]) as { html: string };
  const token = /invite=([A-Za-z0-9_-]{43})/.exec(sent.html)![1];
  assert.equal(invs[0].token_hash, sha(token));
  assert.ok(!allParams.includes(token));
  const json = JSON.stringify(res);
  assert.ok(!json.includes(token) && !json.includes(invs[0].token_hash));
  assert.ok(!/password|token|re_test_key/i.test(json));
});

test("onboarding: falha no Resend preserva registros e retorna emailSent:false", async () => {
  fetchOk = false;
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { logged.push(a.map((x) => JSON.stringify(x)).join(" ")); };
  let res;
  try { res = await firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse(input)); } finally { console.error = orig; }
  assert.equal(res.emailSent, false);
  assert.equal(firms.length, 2);
  assert.equal(users.length, 2);
  assert.equal(invs.length, 1);
  assert.ok(!logged.join("").includes("re_test_key"));
});

test("onboarding: e-mail já existente em qualquer escritório é bloqueado sem criar nada", async () => {
  const err = await errorOf(firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse({ ...input, email: "Existente@Antigo.com" })));
  assert.equal(err.name, "ConflictError");
  assert.equal(firms.length, 1);
  assert.equal(users.length, 1);
  assert.equal(fetchBodies.length, 0);
});

test("onboarding: CNPJ duplicado é bloqueado sem criar usuário/convite", async () => {
  const err = await errorOf(firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse({ ...input, cnpj: "99.999.999/0001-99" })));
  assert.equal(err.name, "ConflictError");
  assert.equal(firms.length, 1);
  assert.equal(invs.length, 0);
});

test("onboarding: falha após criar o escritório faz rollback de tudo", async () => {
  const realConnect = (pool as unknown as { connect: () => Promise<{ query: (s: string, p?: unknown[]) => Promise<unknown> }> }).connect;
  (pool as unknown as { connect: () => Promise<unknown> }).connect = async () => {
    const c = await realConnect();
    const q = c.query.bind(c);
    c.query = async (s: string, p?: unknown[]) => {
      if (s.includes("INSERT INTO user_invitations")) throw new Error("falha simulada");
      return q(s, p);
    };
    return c;
  };
  try {
    await errorOf(firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse(input)));
  } finally {
    (pool as unknown as { connect: () => Promise<unknown> }).connect = realConnect;
  }
  assert.equal(firms.length, 1);
  assert.equal(users.length, 1);
  assert.equal(invs.length, 0);
  assert.equal(fetchBodies.length, 0);
});

test("onboarding: somente platform_admin", async () => {
  for (const role of ["firm_owner", "accountant", "company_user"]) {
    const err = await errorOf(firmOnboardingService.onboard({ userId: "u", firmId: "firm-old", role }, onboardFirmSchema.parse(input)));
    assert.equal(err.name, "ForbiddenError");
  }
  // contexto diz platform_admin mas o banco não confirma
  const err = await errorOf(firmOnboardingService.onboard({ ...ADMIN, userId: "impostor" }, onboardFirmSchema.parse(input)));
  assert.equal(err.name, "ForbiddenError");
  assert.equal(firms.length, 1);
});

test("schema: role, firmId e status enviados pelo cliente são descartados", () => {
  const parsed = onboardFirmSchema.parse({ ...input, role: "platform_admin", firmId: "firm-old", status: "active" });
  assert.deepEqual(Object.keys(parsed).sort(), ["adminFullName", "cnpj", "email", "name", "timezone"]);
});

test("onboarding: CNPJ sem 14 dígitos é rejeitado", async () => {
  const err = await errorOf(firmOnboardingService.onboard(ADMIN, onboardFirmSchema.parse({ ...input, cnpj: "123456789012ab" })));
  assert.equal(err.name, "ValidationError");
  assert.equal(firms.length, 1);
});
