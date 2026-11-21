import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { Pool } from "pg";

const operationalUrl = process.env.RLS_TEST_DATABASE_URL;
const administrativeUrl = process.env.RLS_TEST_ADMIN_DATABASE_URL;
const contextSecret = process.env.RLS_TEST_CONTEXT_SECRET;
const enabled = Boolean(operationalUrl || administrativeUrl || contextSecret);

function assertIsolatedTestUrl(value: string | undefined, expectedUser: string): asserts value is string {
  if (!value) throw new Error("Ambas URLs do teste RLS são obrigatórias.");
  const parsed = new URL(value);
  if (
    !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
    || parsed.port !== "5434"
    || parsed.pathname !== "/mil_contabil_teste"
    || decodeURIComponent(parsed.username) !== expectedUser
  ) {
    throw new Error("Testes RLS aceitam somente o banco local mil_contabil_teste na porta 5434.");
  }
}

if (enabled) {
  assertIsolatedTestUrl(operationalUrl, "mil_app_login");
  assertIsolatedTestUrl(administrativeUrl, "mil_platform_login");
  if (!contextSecret || Buffer.byteLength(contextSecret, "utf8") < 32) {
    throw new Error("RLS_TEST_CONTEXT_SECRET deve conter pelo menos 32 bytes.");
  }

  process.env.DATABASE_URL = operationalUrl;
  process.env.ADMIN_DATABASE_URL = administrativeUrl;
  process.env.RLS_CONTEXT_SECRET = contextSecret;
  process.env.JWT_SECRET = "rls-integration-test-jwt-secret";
  process.env.GEMINI_API_KEY = "rls-integration-test";
  process.env.PG_POOL_MAX = "1";
}

test("signed RLS context resists tampering, cross-firm access, role reset, and pool reuse", {
  skip: !enabled,
}, async () => {
  const { pool, withTenantContext } = await import("../src/db/withTenantContext.js").then(async (module) => ({
    ...module,
    pool: (await import("../src/db/pool.js")).pool,
  }));
  const fixturePool = new Pool({ connectionString: administrativeUrl, max: 1 });
  const firmA = randomUUID();
  const firmB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const createdFirmIds: string[] = [];

  async function createFixtures(): Promise<void> {
    const client = await fixturePool.connect();
    try {
      const preflight = await client.query<{ database_name: string; login_name: string }>(
        "SELECT current_database() AS database_name, session_user AS login_name",
      );
      if (
        preflight.rows[0]?.database_name !== "mil_contabil_teste"
        || preflight.rows[0]?.login_name !== "mil_platform_login"
      ) {
        throw new Error("Conexão administrativa não corresponde ao banco local de teste.");
      }

      createdFirmIds.push(firmA, firmB);
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE mil_platform_admin");
      await client.query(
        `INSERT INTO firms (id, name, cnpj, email) VALUES
         ($1, 'RLS Integration A', $3, $5),
         ($2, 'RLS Integration B', $4, $6)`,
        [firmA, firmB, `${firmA.slice(0, 14)}`, `${firmB.slice(0, 14)}`, `${firmA}@example.invalid`, `${firmB}@example.invalid`],
      );
      await client.query(
        `INSERT INTO users (id, firm_id, role, status, full_name, email, auth_provider)
         VALUES
         ($1, $2, 'accountant', 'active', 'RLS Test A', $3, 'test'),
         ($4, $5, 'accountant', 'active', 'RLS Test B', $6, 'test')`,
        [userA, firmA, `${userA}@example.invalid`, userB, firmB, `${userB}@example.invalid`],
      );
      await client.query(
        `INSERT INTO companies
           (id, firm_id, razao_social, nome_fantasia, cnpj, cnae, regime, responsavel, data_abertura)
         VALUES
           ($1, $2, 'RLS Test Company A', 'RLS A', $3, '0000000', 'simples_nacional', 'RLS A', '2020-01-01'),
           ($4, $5, 'RLS Test Company B', 'RLS B', $6, '0000000', 'simples_nacional', 'RLS B', '2020-01-01')`,
        [companyA, firmA, `${firmA.slice(0, 14)}`, companyB, firmB, `${firmB.slice(0, 14)}`],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function cleanupFixtures(): Promise<void> {
    if (createdFirmIds.length === 0) return;
    const client = await fixturePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE mil_platform_admin");
      await client.query("DELETE FROM companies WHERE firm_id = ANY($1::uuid[])", [createdFirmIds]);
      await client.query("DELETE FROM users WHERE firm_id = ANY($1::uuid[])", [createdFirmIds]);
      await client.query("DELETE FROM audit_logs WHERE firm_id = ANY($1::uuid[])", [createdFirmIds]);
      await client.query("DELETE FROM firms WHERE id = ANY($1::uuid[])", [createdFirmIds]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  try {
    await createFixtures();
    const contextA = { userId: userA, firmId: firmA, role: "accountant" };
    const resultA = await withTenantContext(contextA, async (client) => {
      const visible = await client.query<{ id: string }>("SELECT id FROM companies ORDER BY id");
      const pid = await client.query<{ pid: number; xid: string }>(
        "SELECT pg_backend_pid() AS pid, txid_current()::text AS xid",
      );
      const tokenResult = await client.query<{ token: string }>(
        "SELECT current_setting('app.rls_context_token') AS token",
      );

      await client.query("SELECT set_config('app.current_user_id', $1, true)", [userB]);
      await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmB]);
      await client.query("SELECT set_config('app.current_role', 'firm_owner', true)");

      const verified = await client.query<{
        user_id: string | null;
        firm_id: string | null;
        role: string | null;
      }>(`
        SELECT app_current_user_id()::text AS user_id,
               app_current_firm_id()::text AS firm_id,
               app_current_role() AS role
      `);
      const crossFirm = await client.query("SELECT id FROM companies WHERE id = $1", [companyB]);
      const update = await client.query("UPDATE companies SET telefone = 'forbidden' WHERE id = $1", [companyB]);
      const deletion = await client.query("DELETE FROM companies WHERE id = $1", [companyB]);

      await client.query("SAVEPOINT forged_token");
      await assert.rejects(
        client.query("SELECT app_private.set_rls_context($1)", ["forged.token"]),
        (error: { code?: string }) => error.code === "42501",
      );
      await client.query("ROLLBACK TO SAVEPOINT forged_token");

      const afterForgery = await client.query<{ id: string }>("SELECT id FROM companies ORDER BY id");
      const [encodedPayload, signature] = tokenResult.rows[0].token.split(".");
      const forgedPayload = JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8"));
      forgedPayload.firmId = firmB;
      const forgedEncodedPayload = Buffer.from(JSON.stringify(forgedPayload), "utf8").toString("base64");
      await client.query("SAVEPOINT modified_signature");
      await assert.rejects(
        client.query(
          "SELECT app_private.set_rls_context($1)",
          [`${forgedEncodedPayload}.${signature}`],
        ),
        (error: { code?: string }) => error.code === "42501",
      );
      await client.query("ROLLBACK TO SAVEPOINT modified_signature");

      const expiredPayload = Buffer.from(JSON.stringify({
        ...JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8")),
        expiresAt: Math.floor(Date.now() / 1000) - 1,
      }), "utf8").toString("base64");
      const expiredSignature = createHmac("sha256", contextSecret!)
        .update(expiredPayload, "utf8")
        .digest("hex");
      await client.query("SAVEPOINT expired_context");
      await client.query(
        "SELECT set_config('app.rls_context_token', $1, true)",
        [`${expiredPayload}.${expiredSignature}`],
      );
      const expired = await client.query<{ user_id: string | null; visible_count: string }>(`
        SELECT app_current_user_id()::text AS user_id,
               (SELECT count(*)::text FROM companies) AS visible_count
      `);
      await client.query("ROLLBACK TO SAVEPOINT expired_context");

      await assert.rejects(
        client.query("SELECT secret FROM app_private.rls_context_secrets"),
        (error: { code?: string }) => error.code === "42501",
      );
      return {
        visible: visible.rows.map((row) => row.id),
        pid: pid.rows[0].pid,
        xid: pid.rows[0].xid,
        verified: verified.rows[0],
        crossFirmCount: crossFirm.rowCount,
        updateCount: update.rowCount,
        deleteCount: deletion.rowCount,
        afterForgery: afterForgery.rows.map((row) => row.id),
        expiredUserId: expired.rows[0].user_id,
        expiredVisibleCount: expired.rows[0].visible_count,
      };
    });

    const resultB = await withTenantContext(
      { userId: userB, firmId: firmB, role: "accountant" },
      async (client) => {
        const visible = await client.query<{ id: string }>("SELECT id FROM companies ORDER BY id");
        const binding = await client.query<{ pid: number; xid: string }>(
          "SELECT pg_backend_pid() AS pid, txid_current()::text AS xid",
        );
        return { visible: visible.rows.map((row) => row.id), ...binding.rows[0] };
      },
    );

    assert.deepEqual(resultA.visible, [companyA]);
    assert.equal(resultA.verified.user_id, userA);
    assert.equal(resultA.verified.firm_id, firmA);
    assert.equal(resultA.verified.role, "accountant");
    assert.equal(resultA.crossFirmCount, 0);
    assert.equal(resultA.updateCount, 0);
    assert.equal(resultA.deleteCount, 0);
    assert.deepEqual(resultA.afterForgery, [companyA]);
    assert.equal(resultA.expiredUserId, null);
    assert.equal(resultA.expiredVisibleCount, "0");
    assert.deepEqual(resultB.visible, [companyB]);
    assert.equal(resultB.pid, resultA.pid, "pool max=1 deve reutilizar a mesma conexão");
    assert.notEqual(resultB.xid, resultA.xid, "cada requisição deve receber outra transação");

    await withTenantContext(contextA, async (client) => {
      await client.query("SAVEPOINT reset_role_attempt");
      await client.query("RESET ROLE");
      const reverted = await client.query<{ role: string }>("SELECT current_user AS role");
      assert.equal(reverted.rows[0].role, "mil_app_login");
      await assert.rejects(client.query("SET LOCAL ROLE mil_platform_admin"));
      await client.query("ROLLBACK TO SAVEPOINT reset_role_attempt");
      const restored = await client.query<{ role: string }>("SELECT current_user AS role");
      assert.equal(restored.rows[0].role, "mil_app");
    });
  } finally {
    try {
      await cleanupFixtures();
    } finally {
      await fixturePool.end();
      await pool.end();
    }
  }
});
