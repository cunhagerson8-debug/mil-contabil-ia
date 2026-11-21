import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.DATABASE_URL = "postgres://tenant-test:tenant-test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://platform-test:platform-test@localhost:5432/test";
process.env.JWT_SECRET = "tenant-security-test-secret";
process.env.RLS_CONTEXT_SECRET = "rls-context-test-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini";

const { adminPool, pool } = await import("../src/db/pool.js");
const { withPlatformContext, withPublicLeadContext, withTenantContext } = await import("../src/db/withTenantContext.js");
const { signRlsContext } = await import("../src/db/rlsContext.js");
const { requireAuth } = await import("../src/middleware/requireAuth.js");
const { requireRole } = await import("../src/middleware/requireRole.js");

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const FIRM_ID = "223e4567-e89b-42d3-a456-426614174000";

type MockRole = {
  effective_role: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  owns_rls_tables?: boolean;
  has_privileged_membership?: boolean;
  effective_has_membership?: boolean;
  session_user_name?: string;
  session_can_login?: boolean;
  session_superuser?: boolean;
  session_bypassrls?: boolean;
  session_inherit?: boolean;
  session_has_privileged_membership?: boolean;
  session_has_unexpected_membership?: boolean;
  session_can_assume_platform_admin?: boolean;
  session_has_unexpected_privileged_membership?: boolean;
};

function makeClient(role: MockRole, userStatus = "active", userRole = "accountant") {
  const statements: string[] = [];
  const signedContexts: string[] = [];
  let transactionId = 100;
  let released = false;
  return {
    statements,
    signedContexts,
    get released() { return released; },
    release() { released = true; },
    async query(sql: string, params: unknown[] = []) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      statements.push(normalized);
      if (normalized.includes("AS effective_role")) {
        const isPlatform = role.effective_role === "mil_platform_admin";
        return {
          rows: [{
            session_user_name: role.session_user_name ?? (isPlatform ? "mil_platform_login" : "mil_app_login"),
            session_can_login: role.session_can_login ?? true,
            session_superuser: role.session_superuser ?? false,
            session_bypassrls: role.session_bypassrls ?? false,
            session_inherit: role.session_inherit ?? false,
            session_has_privileged_membership: role.session_has_privileged_membership ?? false,
            session_has_unexpected_membership: role.session_has_unexpected_membership ?? false,
            session_can_assume_platform_admin: role.session_can_assume_platform_admin ?? isPlatform,
            session_has_unexpected_privileged_membership: role.session_has_unexpected_privileged_membership ?? false,
            effective_has_membership: role.effective_has_membership ?? false,
            ...role,
          }],
          rowCount: 1,
        };
      }
      if (normalized.includes("txid_current()")) {
        return {
          rows: [{
            backend_pid: 1234,
            transaction_id: String(transactionId++),
            database_name: "test",
            session_user_name: "mil_app_login",
          }],
          rowCount: 1,
        };
      }
      if (normalized.includes("app_private.set_rls_context")) {
        signedContexts.push(String(params[0]));
        return { rows: [], rowCount: 1 };
      }
      if (normalized.includes("FROM users u") && normalized.includes("WHERE u.id = $1")) {
        return {
          rows: [{
            id: USER_ID,
            firm_id: FIRM_ID,
            role: userRole,
            status: userStatus,
        session_version: 0,
            full_name: "Test User",
            email: "test@example.invalid",
            password_hash: null,
            auth_provider: "password",
            mfa_enabled: false,
            avatar_url: null,
            last_login_at: null,
            created_at: new Date().toISOString(),
            firm_name: "Test Firm",
          }],
          rowCount: 1,
        };
      }
      if (normalized.startsWith("SELECT user_id, company_id, can_manage")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0, params };
    },
  };
}

function setConnect(target: typeof pool | typeof adminPool, connect: () => Promise<unknown>) {
  (target as unknown as { connect: () => Promise<unknown> }).connect = connect;
}

test("tenant transaction sets only a signed, transaction-bound context after role validation", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
  });
  setConnect(pool, async () => client);

  const result = await withTenantContext(
    { userId: USER_ID, firmId: FIRM_ID, role: "accountant" },
    async (connection) => {
      await connection.query("SELECT business_data");
      return "ok";
    }
  );

  assert.equal(result, "ok");
  assert.ok(client.statements.indexOf("SET LOCAL ROLE mil_app") < client.statements.findIndex((s) => s.includes("app_private.set_rls_context")));
  assert.ok(client.statements.some((s) =>
    s.includes("set_config('app.current_user_id', '', true)")
    && s.includes("set_config('app.current_firm_id', '', true)")
    && s.includes("set_config('app.current_role', '', true)")
  ));
  assert.equal(client.signedContexts.length, 1);
  const [encodedPayload, signature] = client.signedContexts[0].split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64").toString("utf8"));
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", process.env.RLS_CONTEXT_SECRET!).update(encodedPayload).digest();
  assert.equal(timingSafeEqual(Buffer.from(signature, "hex"), expected), true);
  assert.equal(payload.userId, USER_ID);
  assert.equal(payload.firmId, FIRM_ID);
  assert.equal(payload.role, "accountant");
  assert.equal(payload.backendPid, 1234);
  assert.equal(payload.transactionId, "100");
  assert.equal(payload.databaseName, "test");
  assert.equal(payload.sessionUser, "mil_app_login");
  assert.equal(client.statements[client.statements.length - 1], "COMMIT");
  assert.equal(client.released, true);
});

test("public lead transaction uses the checked operational role without a tenant context", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
  });
  setConnect(pool, async () => client);

  const result = await withPublicLeadContext(async (connection) => {
    await connection.query("INSERT INTO commercial_leads");
    return "accepted";
  });

  assert.equal(result, "accepted");
  assert.ok(client.statements.includes("SET LOCAL ROLE mil_app"));
  assert.equal(client.signedContexts.length, 0);
  assert.equal(client.statements[client.statements.length - 1], "COMMIT");
  assert.equal(client.released, true);
});

test("public lead transaction refuses a privileged operational role", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: true,
    owns_rls_tables: false,
  });
  setConnect(pool, async () => client);
  let callbackRan = false;

  await assert.rejects(
    withPublicLeadContext(async () => { callbackRan = true; }),
    /sujeita a RLS/
  );
  assert.equal(callbackRan, false);
  assert.equal(client.statements[client.statements.length - 1], "ROLLBACK");
  assert.equal(client.released, true);
});

test("tenant transaction refuses BYPASSRLS and never runs the query callback", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: true,
    owns_rls_tables: false,
  });
  setConnect(pool, async () => client);
  let callbackRan = false;

  await assert.rejects(
    withTenantContext(
      { userId: USER_ID, firmId: FIRM_ID, role: "accountant" },
      async () => { callbackRan = true; }
    ),
    /sujeita a RLS/
  );

  assert.equal(callbackRan, false);
  assert.equal(client.statements[client.statements.length - 1], "ROLLBACK");
});

test("tenant transaction refuses a role owning RLS-protected tables", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: true,
  });
  setConnect(pool, async () => client);

  await assert.rejects(
    withTenantContext(
      { userId: USER_ID, firmId: FIRM_ID, role: "accountant" },
      async () => "should not run"
    ),
    /sujeita a RLS/
  );
});

test("tenant transaction refuses inherited superuser or BYPASSRLS membership", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
    has_privileged_membership: true,
  });
  setConnect(pool, async () => client);

  await assert.rejects(
    withTenantContext(
      { userId: USER_ID, firmId: FIRM_ID, role: "accountant" },
      async () => "should not run"
    ),
    /sujeita a RLS/
  );
});

test("tenant transaction refuses a privileged session login even after SET ROLE", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
    session_user_name: "neondb_owner",
  });
  setConnect(pool, async () => client);

  await assert.rejects(
    withTenantContext(
      { userId: USER_ID, firmId: FIRM_ID, role: "accountant" },
      async () => "must not run"
    ),
    /sujeita a RLS/
  );
  assert.equal(client.statements.some((statement) => statement.includes("txid_current()")), false);
});

test("reused tenant connections receive distinct signed contexts for each transaction", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
  });
  setConnect(pool, async () => client);

  await withTenantContext(
    { userId: USER_ID, firmId: FIRM_ID, role: "accountant" },
    async () => "firm A"
  );
  const secondFirmId = "323e4567-e89b-42d3-a456-426614174000";
  await withTenantContext(
    { userId: USER_ID, firmId: secondFirmId, role: "accountant" },
    async () => "firm B"
  );

  assert.equal(client.signedContexts.length, 2);
  const firstPayload = JSON.parse(Buffer.from(client.signedContexts[0].split(".")[0], "base64").toString("utf8"));
  const secondPayload = JSON.parse(Buffer.from(client.signedContexts[1].split(".")[0], "base64").toString("utf8"));
  assert.equal(firstPayload.firmId, FIRM_ID);
  assert.equal(secondPayload.firmId, secondFirmId);
  assert.notEqual(firstPayload.transactionId, secondPayload.transactionId);
  assert.notEqual(client.signedContexts[0], client.signedContexts[1]);
  assert.equal(client.statements.filter((s) => s === "COMMIT").length, 2);
});

test("RLS signer rejects client-controlled platform and malformed tenant contexts", () => {
  assert.throws(
    () => signRlsContext({ userId: USER_ID, firmId: null, role: "platform_admin" }, {
      backendPid: 1234,
      transactionId: "100",
    }),
    /Contexto RLS inválido/
  );
  assert.throws(
    () => signRlsContext({ userId: "not-a-uuid", firmId: FIRM_ID, role: "firm_owner" }, {
      backendPid: 1234,
      transactionId: "100",
    }),
    /Contexto RLS inválido/
  );
});

test("missing tenant context is rejected before checking out a connection", async () => {
  let connectCount = 0;
  setConnect(pool, async () => {
    connectCount += 1;
    throw new Error("should not connect");
  });

  await assert.rejects(
    withTenantContext(
      { userId: USER_ID, firmId: null, role: "company_user" },
      async () => "should not run"
    ),
    /Contexto de tenant inválido/
  );
  assert.equal(connectCount, 0);
});

test("admin transaction exclusively checks out the admin pool", async () => {
  const client = makeClient({
    effective_role: "mil_platform_admin",
    rolsuper: false,
    rolbypassrls: true,
  });
  let operationalConnectCount = 0;
  setConnect(pool, async () => {
    operationalConnectCount += 1;
    throw new Error("operational pool must not be used");
  });
  setConnect(adminPool, async () => client);

  await withPlatformContext(async () => "global");

  assert.equal(operationalConnectCount, 0);
  assert.ok(client.statements.includes("SET LOCAL ROLE mil_platform_admin"));
  assert.equal(client.statements[client.statements.length - 1], "COMMIT");
});

test("requests revalidate current user status and role from the database", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
  }, "deactivated");
  setConnect(pool, async () => client);
  const token = jwt.sign(
    { sub: USER_ID, firmId: FIRM_ID, role: "accountant" },
    process.env.JWT_SECRET!
  );

  const error = await new Promise<unknown>((resolve) => {
    requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as never,
      {} as never,
      resolve
    );
  });

  assert.equal((error as Error).name, "UnauthorizedError");
});

test("a stale role claim is rejected after the user's role changes", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
  }, "active", "company_user");
  setConnect(pool, async () => client);
  const token = jwt.sign(
    { sub: USER_ID, firmId: FIRM_ID, role: "accountant" },
    process.env.JWT_SECRET!
  );

  const error = await new Promise<unknown>((resolve) => {
    requireAuth(
      { headers: { authorization: `Bearer ${token}` } } as never,
      {} as never,
      resolve
    );
  });

  assert.equal((error as Error).name, "UnauthorizedError");
});

test("request-supplied firm and role do not override the database-validated JWT identity", async () => {
  const client = makeClient({
    effective_role: "mil_app",
    rolsuper: false,
    rolbypassrls: false,
    owns_rls_tables: false,
  });
  setConnect(pool, async () => client);
  const token = jwt.sign(
    { sub: USER_ID, firmId: FIRM_ID, role: "accountant" },
    process.env.JWT_SECRET!
  );
  const request = {
    headers: { authorization: `Bearer ${token}` },
    body: { userId: "323e4567-e89b-42d3-a456-426614174000", firmId: "323e4567-e89b-42d3-a456-426614174000", role: "firm_owner" },
    query: { firmId: "323e4567-e89b-42d3-a456-426614174000" },
  };

  const error = await new Promise<unknown>((resolve) => {
    requireAuth(
      request as never,
      {} as never,
      (nextError?: unknown) => resolve(nextError ?? null)
    );
  });

  assert.equal(error, null);
  assert.deepEqual((request as typeof request & { tenantContext?: unknown }).tenantContext, {
    userId: USER_ID,
    firmId: FIRM_ID,
    role: "accountant",
    hrPermissions: [],
  });
  assert.ok(client.signedContexts.length === 1);
});

test("common tenant roles cannot pass platform-admin route authorization", () => {
  let error: unknown;
  requireRole("platform_admin")(
    { tenantContext: { userId: USER_ID, firmId: FIRM_ID, role: "accountant" } } as never,
    {} as never,
    (nextError?: unknown) => { error = nextError; }
  );
  assert.equal((error as Error).name, "ForbiddenError");
});
