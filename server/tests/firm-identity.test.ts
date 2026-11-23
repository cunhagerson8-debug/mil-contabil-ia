import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://admin-test:admin-test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret";
process.env.RLS_CONTEXT_SECRET = "rls-context-test-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini";

const { pool } = await import("../src/db/pool.js");
const { firmService } = await import("../src/services/firm.service.js");
const {
  safeFirmLogoPath,
  safeFirmPrimaryColor,
} = await import("../src/utils/firm-identity.js");

const FIRM_A = "11111111-1111-4111-8111-111111111111";
const FIRM_B = "22222222-2222-4222-8222-222222222222";

const firms = new Map([
  [FIRM_A, {
    id: FIRM_A,
    name: "Escritório A Ltda",
    trade_name: "Escritório A",
    logo_url: `/uploads/firms/${FIRM_A}/logo.png`,
    primary_color: "#123abc",
  }],
  [FIRM_B, {
    id: FIRM_B,
    name: "Escritório B Ltda",
    trade_name: "Escritório B",
    logo_url: `/uploads/firms/${FIRM_B}/logo.png`,
    primary_color: "#abcdef",
  }],
]);

let queriedFirmIds: unknown[] = [];

function mockTenantClient() {
  return {
    release() {},
    async query(sql: string, params: unknown[] = []) {
      const statement = sql.replace(/\s+/g, " ").trim();
      if (statement === "BEGIN" || statement === "SET LOCAL ROLE mil_app" || statement === "COMMIT" || statement === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }
      if (statement.startsWith("SELECT set_config")) return { rows: [], rowCount: 1 };
      if (statement.startsWith("SELECT session_user AS session_user_name")) {
        return {
          rows: [{
            session_user_name: "mil_app_login",
            session_can_login: true,
            session_superuser: false,
            session_bypassrls: false,
            session_inherit: false,
            session_has_privileged_membership: false,
            session_has_unexpected_membership: false,
            session_can_assume_platform_admin: false,
            effective_role: "mil_app",
            rolsuper: false,
            rolbypassrls: false,
            owns_rls_tables: false,
            has_privileged_membership: false,
            effective_has_membership: false,
          }],
          rowCount: 1,
        };
      }
      if (statement.startsWith("SELECT pg_backend_pid()")) {
        return {
          rows: [{
            backend_pid: 123,
            transaction_id: "456",
            database_name: "test",
            session_user_name: "mil_app_login",
          }],
          rowCount: 1,
        };
      }
      if (statement.startsWith("SELECT app_private.set_rls_context")) {
        return { rows: [], rowCount: 1 };
      }
      if (statement.includes("FROM firms") && statement.includes("WHERE id = $1")) {
        queriedFirmIds.push(params[0]);
        const row = firms.get(String(params[0]));
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      throw new Error(`Consulta inesperada no teste: ${statement}`);
    },
  };
}

beforeEach(() => {
  queriedFirmIds = [];
  (pool as unknown as { connect: () => Promise<unknown> }).connect = async () => mockTenantClient();
});

test("retorna somente a identidade do escritório do contexto autenticado", async () => {
  const identity = await firmService.getMyIdentity({
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    firmId: FIRM_A,
    role: "firm_owner",
  });

  assert.equal(identity.name, "Escritório A Ltda");
  assert.equal(identity.tradeName, "Escritório A");
  assert.deepEqual(queriedFirmIds, [FIRM_A]);
  assert.ok(!JSON.stringify(identity).includes("Escritório B"));
});

test("usuários comuns recebem a identidade do próprio tenant sem escolher firmId", async () => {
  const identity = await firmService.getMyIdentity({
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    firmId: FIRM_B,
    role: "company_user",
  });

  assert.equal(identity.tradeName, "Escritório B");
  assert.deepEqual(queriedFirmIds, [FIRM_B]);
});

test("platform_admin não consulta identidade de tenant via endpoint de escritório", async () => {
  await assert.rejects(
    firmService.getMyIdentity({
      userId: "platform-admin",
      firmId: null,
      role: "platform_admin",
    }),
    { name: "ForbiddenError" },
  );
  assert.deepEqual(queriedFirmIds, []);
});

test("rejeita URLs externas, caminhos de outro tenant e formatos não raster", () => {
  assert.equal(safeFirmLogoPath(`https://evil.example/${FIRM_A}/logo.png`, FIRM_A), null);
  assert.equal(safeFirmLogoPath(`/uploads/firms/${FIRM_B}/logo.png`, FIRM_A), null);
  assert.equal(safeFirmLogoPath(`/uploads/firms/${FIRM_A}/logo.svg`, FIRM_A), null);
  assert.equal(safeFirmLogoPath(`/uploads/firms/${FIRM_A}/../other/logo.png`, FIRM_A), null);
  assert.equal(safeFirmLogoPath(`/uploads/firms/${FIRM_A}/logo.png`, FIRM_A), `/uploads/firms/${FIRM_A}/logo.png`);
});

test("aceita somente cores hexadecimais de seis dígitos", () => {
  assert.equal(safeFirmPrimaryColor("#123abc"), "#123abc");
  assert.equal(safeFirmPrimaryColor("red; background:url(https://evil.example)"), null);
});
