// Testes do fluxo de aceite de convite, sem banco real e sem novas dependências:
// usa node:test (nativo) + tsx e um client pg falso em memória que reproduz a
// semântica dos UPDATEs condicionais e do ROLLBACK usados pelo repositório.
// Execução: npm test (dentro de server/)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret";
process.env.GEMINI_API_KEY = "test-gemini";

const { pool } = await import("../src/db/pool.js");
const { invitationService } = await import("../src/services/invitation.service.js");
const { acceptInvitationSchema } = await import("../src/validators/auth.validators.js");
const { errorHandler } = await import("../src/middleware/errorHandler.js");

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const HOUR = 3_600_000;

interface Inv { id: string; user_id: string; token_hash: string; expires_at: Date; used_at: Date | null; revoked_at: Date | null }
interface Usr { id: string; status: string; deleted_at: Date | null; password_hash: string | null; full_name: string; email: string; firm_name: string; role: string }

let invitations: Inv[] = [];
let users: Usr[] = [];
let failActivation = false;
const executedParams: unknown[][] = [];

function makeClient() {
  const undo: Array<() => void> = [];
  return {
    release() {},
    async query(sql: string, params: unknown[] = []) {
      executedParams.push(params);
      const s = sql.replace(/\s+/g, " ").trim();
      if (s === "BEGIN") { undo.length = 0; return { rows: [], rowCount: 0 }; }
      if (s === "COMMIT") { undo.length = 0; return { rows: [], rowCount: 0 }; }
      if (s === "ROLLBACK") { while (undo.length) undo.pop()!(); return { rows: [], rowCount: 0 }; }

      if (s.startsWith("SELECT i.id AS invitation_id")) {
        const inv = invitations.find((i) => i.token_hash === params[0]);
        if (!inv) return { rows: [], rowCount: 0 };
        const u = users.find((x) => x.id === inv.user_id)!;
        return {
          rowCount: 1,
          rows: [{
            invitation_id: inv.id, user_id: inv.user_id, expires_at: inv.expires_at,
            used_at: inv.used_at, revoked_at: inv.revoked_at, user_status: u.status,
            user_deleted_at: u.deleted_at, has_password: u.password_hash !== null,
            full_name: u.full_name, email: u.email, firm_name: u.firm_name,
          }],
        };
      }
      if (s.startsWith("UPDATE user_invitations SET used_at")) {
        const inv = invitations.find((i) =>
          i.token_hash === params[0] && !i.used_at && !i.revoked_at && i.expires_at.getTime() > Date.now());
        if (!inv) return { rows: [], rowCount: 0 };
        inv.used_at = new Date();
        undo.push(() => { inv.used_at = null; });
        return { rows: [{ user_id: inv.user_id }], rowCount: 1 };
      }
      if (s.startsWith("UPDATE users SET password_hash")) {
        const u = users.find((x) => x.id === params[0]);
        if (failActivation || !u || u.status !== "invited" || u.deleted_at || u.password_hash) {
          return { rows: [], rowCount: 0 };
        }
        const before = { ...u };
        u.password_hash = params[1] as string;
        u.status = "active";
        undo.push(() => Object.assign(u, before));
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`SQL inesperado no teste: ${s.slice(0, 60)}`);
    },
  };
}

(pool as unknown as { connect: () => Promise<unknown> }).connect = async () => makeClient();

let token = "";
function seed(overrides: Partial<Inv> = {}) {
  token = "A".repeat(43);
  users = [{
    id: "u1", status: "invited", deleted_at: null, password_hash: null,
    full_name: "Maria Teste", email: "maria@example.com", firm_name: "Escritório X", role: "accountant",
  }];
  invitations = [{
    id: "i1", user_id: "u1", token_hash: sha(token),
    expires_at: new Date(Date.now() + HOUR), used_at: null, revoked_at: null, ...overrides,
  }];
}

beforeEach(() => { seed(); failActivation = false; executedParams.length = 0; });

async function messageOf(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return (e as Error).message; }
  return "";
}

test("validate: token válido retorna só dados mínimos", async () => {
  const info = await invitationService.validate(token);
  assert.deepEqual(Object.keys(info).sort(), ["email", "expiresAt", "firmName", "fullName"]);
  assert.equal(info.email, "maria@example.com");
  assert.ok(!JSON.stringify(info).includes("password"));
});

test("validate: busca somente pelo hash; token puro nunca vai ao banco", async () => {
  await invitationService.validate(token);
  const flat = executedParams.flat();
  assert.ok(flat.includes(sha(token)));
  assert.ok(!flat.includes(token));
});

test("validate: token inexistente é recusado", async () => {
  assert.match(await messageOf(invitationService.validate("B".repeat(43))), /inválido/);
});

test("validate: token expirado é recusado", async () => {
  seed({ expires_at: new Date(Date.now() - 1000) });
  assert.match(await messageOf(invitationService.validate(token)), /expirou/);
});

test("validate: token revogado é recusado", async () => {
  seed({ revoked_at: new Date() });
  assert.match(await messageOf(invitationService.validate(token)), /cancelado/);
});

test("validate: token já utilizado é recusado", async () => {
  seed({ used_at: new Date() });
  assert.match(await messageOf(invitationService.validate(token)), /já foi utilizado/);
});

test("validate: usuário que não está mais 'invited' é recusado", async () => {
  users[0].status = "suspended";
  assert.match(await messageOf(invitationService.validate(token)), /inválido/);
});

test("senha inválida é rejeitada pelo schema (curta, longa, token malformado)", () => {
  assert.equal(acceptInvitationSchema.safeParse({ token, password: "curta" }).success, false);
  assert.equal(acceptInvitationSchema.safeParse({ token, password: "x".repeat(73) }).success, false);
  assert.equal(acceptInvitationSchema.safeParse({ token: "abc", password: "SenhaForte123" }).success, false);
  assert.equal(acceptInvitationSchema.safeParse({ token, password: "SenhaForte123" }).success, true);
});

test("schema ignora role/firmId/companyId enviados pelo cliente", () => {
  const parsed = acceptInvitationSchema.parse({
    token, password: "SenhaForte123", role: "platform_admin", firmId: "x", companyId: "y",
  });
  assert.deepEqual(Object.keys(parsed).sort(), ["password", "token"]);
});

test("accept: aceite válido ativa usuário, grava bcrypt e marca used_at", async () => {
  await invitationService.accept(token, "SenhaForte123");
  assert.ok(invitations[0].used_at);
  assert.equal(users[0].status, "active");
  assert.equal(users[0].role, "accountant");
  assert.ok(users[0].password_hash && users[0].password_hash !== "SenhaForte123");
  assert.ok(await bcrypt.compare("SenhaForte123", users[0].password_hash!));
});

test("accept: reutilizar o convite após o aceite é recusado", async () => {
  await invitationService.accept(token, "SenhaForte123");
  const hashAfterFirst = users[0].password_hash;
  assert.match(await messageOf(invitationService.accept(token, "OutraSenha456")), /já foi utilizado/);
  assert.equal(users[0].password_hash, hashAfterFirst);
});

test("accept: dois aceites simultâneos — somente um vence", async () => {
  const results = await Promise.allSettled([
    invitationService.accept(token, "SenhaForte123"),
    invitationService.accept(token, "SenhaForte456"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
});

test("accept: expirado/revogado/inexistente não alteram o usuário", async () => {
  seed({ expires_at: new Date(Date.now() - 1000) });
  assert.match(await messageOf(invitationService.accept(token, "SenhaForte123")), /expirou/);
  seed({ revoked_at: new Date() });
  assert.match(await messageOf(invitationService.accept(token, "SenhaForte123")), /cancelado/);
  assert.match(await messageOf(invitationService.accept("C".repeat(43), "SenhaForte123")), /inválido/);
  assert.equal(users[0].status, "invited");
  assert.equal(users[0].password_hash, null);
});

test("accept: falha na ativação faz rollback e o convite continua utilizável", async () => {
  failActivation = true;
  await invitationService.accept(token, "SenhaForte123").then(
    () => assert.fail("deveria falhar"),
    () => {},
  );
  assert.equal(invitations[0].used_at, null);
  assert.equal(users[0].status, "invited");
  failActivation = false;
  await invitationService.accept(token, "SenhaForte123");
  assert.equal(users[0].status, "active");
});

test("accept/validate: nada sensível aparece em logs", async () => {
  const logged: string[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); };
  try {
    await invitationService.validate(token);
    await invitationService.accept(token, "SenhaForte123");
    await invitationService.accept(token, "SenhaForte123").catch(() => {});
  } finally {
    Object.assign(console, orig);
  }
  const all = logged.join("\n");
  assert.ok(!all.includes(token) && !all.includes("SenhaForte123"));
});

test("errorHandler: ZodError vira 400 com mensagem segura, sem ecoar valores", () => {
  const parsed = acceptInvitationSchema.safeParse({ token, password: "segredo" });
  assert.equal(parsed.success, false);
  let status = 0;
  let body: Record<string, unknown> = {};
  const res = {
    status(s: number) { status = s; return this; },
    json(b: Record<string, unknown>) { body = b; return this; },
  };
  errorHandler(parsed.success ? null : parsed.error, { method: "POST", path: "/x" } as never, res as never, (() => {}) as never);
  assert.equal(status, 400);
  assert.match(String(body.error), /pelo menos 8/);
  assert.ok(!JSON.stringify(body).includes("segredo"));
  assert.equal(body.stack, undefined);
});
