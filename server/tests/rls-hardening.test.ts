import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.DATABASE_URL = "postgres://tenant-test:tenant-test@localhost:5432/test";
process.env.ADMIN_DATABASE_URL = "postgres://platform-test:platform-test@localhost:5432/test";
process.env.JWT_SECRET = "tenant-security-test-secret";
process.env.RLS_CONTEXT_SECRET = "rls-context-test-secret-0123456789abcdef";
process.env.GEMINI_API_KEY = "test-gemini";

const { pool } = await import("../src/db/pool.js");
const { clientService } = await import("../src/services/client.service.js");
const { companyService } = await import("../src/services/company.service.js");
const { employeeService } = await import("../src/services/employee.service.js");
const hardeningMigration = await readFile(
  new URL("../../database/migrations/018_rls_policy_hardening.sql", import.meta.url),
  "utf8",
);
const signedContextMigration = await readFile(
  new URL("../../database/migrations/019_signed_rls_context.sql", import.meta.url),
  "utf8",
);
const migrationRunner = await readFile(
  new URL("../scripts/run-migrations.mjs", import.meta.url),
  "utf8",
);

test("hardening migration replaces permissive policies and protects link/delete operations", () => {
  for (const [policy, table] of [
    ["clients_write_staff_only", "clients"],
    ["tax_obligations_write_staff_only", "tax_obligations"],
    ["invoices_write_staff_only", "invoices"],
    ["portal_guides_write_staff_only", "portal_guides"],
    ["alerts_update_mark_read", "alerts"],
    ["hr_employees_delete_staff", "hr_employees"],
  ]) {
    assert.ok(hardeningMigration.includes(`DROP POLICY IF EXISTS ${policy} ON ${table};`));
  }

  assert.match(hardeningMigration, /CREATE POLICY clients_delete_owner[\s\S]*?app_current_role\(\) = 'firm_owner'/);
  assert.match(hardeningMigration, /CREATE POLICY invoices_delete_owner[\s\S]*?app_current_role\(\) = 'firm_owner'/);
  assert.match(hardeningMigration, /CREATE POLICY portal_guides_update_manager[\s\S]*?app_user_can_manage_company/);
  assert.match(hardeningMigration, /CREATE OR REPLACE FUNCTION guard_nonowner_link_changes/);
  assert.match(hardeningMigration, /CREATE POLICY alerts_update_read_status/);
  assert.match(hardeningMigration, /ALTER FUNCTION audit_trigger_fn\(\) SECURITY DEFINER/);
  assert.match(hardeningMigration, /SET search_path = pg_catalog, pg_temp/);
});

test("signed-context migration fails closed on forged GUCs and isolates its HMAC key", () => {
  assert.match(signedContextMigration, /public\.hmac\(/);
  assert.match(signedContextMigration, /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, pg_temp/);
  assert.match(signedContextMigration, /pg_backend_pid\(\)::text/);
  assert.match(signedContextMigration, /txid_current\(\)::text/);
  assert.match(signedContextMigration, /current_database\(\)/);
  assert.match(signedContextMigration, /session_user/);
  assert.match(signedContextMigration, /v_signature_difference/);
  assert.match(signedContextMigration, /app_private\.rls_context_secrets/);
  assert.match(signedContextMigration, /REVOKE ALL ON app_private\.rls_context_secrets FROM PUBLIC/);
  assert.match(signedContextMigration, /CREATE ROLE mil_context_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS/);
  assert.match(signedContextMigration, /SELECT NULLIF\(app_private\.verified_rls_context\(\)/);
  assert.doesNotMatch(signedContextMigration, /current_setting\('app\.current_(user_id|firm_id|role)'/);
  assert.match(signedContextMigration, /public\.app_current_user_id\(\)/);
  assert.match(migrationRunner, /app\.rls_context_migration_secret', \$1/);
});

test("non-owner users cannot reassign client, company, or employee links", async () => {
  const originalConnect = pool.connect;
  let connectCount = 0;
  (pool as unknown as { connect: typeof pool.connect }).connect = async () => {
    connectCount += 1;
    throw new Error("A link-change denial must not require database access");
  };

  try {
    await assert.rejects(
      clientService.update(
        { userId: "user-1", firmId: "firm-1", role: "accountant" },
        "client-1",
        { companyId: "company-2" },
      ),
      /Somente firm_owner pode alterar o vínculo do cliente/
    );
    await assert.rejects(
      companyService.update(
        { userId: "user-1", firmId: "firm-1", role: "accountant" },
        "company-1",
        { contadorResponsavelId: "user-2" },
      ),
      /Somente firm_owner pode alterar o contador responsável/
    );
    await assert.rejects(
      employeeService.update(
        { userId: "user-1", firmId: "firm-1", role: "accountant" },
        "employee-1",
        { departmentId: "department-2" },
      ),
      /Somente firm_owner pode alterar os vínculos do colaborador/
    );
    assert.equal(connectCount, 0);
  } finally {
    (pool as unknown as { connect: typeof pool.connect }).connect = originalConnect;
  }
});
