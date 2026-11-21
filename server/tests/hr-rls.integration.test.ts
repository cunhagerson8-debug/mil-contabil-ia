import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  process.env.JWT_SECRET = "hr-rls-integration-test-jwt-secret";
  process.env.GEMINI_API_KEY = "hr-rls-integration-test";
  process.env.PG_POOL_MAX = "1";
}

test("RH RLS: isolamento, autorização, dados pessoais e contexto assinado", {
  skip: !enabled,
}, async (suite) => {
  const { pool, withTenantContext } = await import("../src/db/withTenantContext.js").then(async (module) => ({
    ...module,
    pool: (await import("../src/db/pool.js")).pool,
  }));
  const fixturePool = new Pool({ connectionString: administrativeUrl, max: 1 });

  const firmA = randomUUID();
  const firmB = randomUUID();
  const companyA1 = randomUUID();
  const companyA2 = randomUUID();
  const companyB1 = randomUUID();
  const staffA = randomUUID();
  const staffB = randomUUID();
  const portalManagerA1 = randomUUID();
  const portalUserA1 = randomUUID();
  const employeeA1 = randomUUID();
  const employeeA2 = randomUUID();
  const employeeB1 = randomUUID();
  const documentA1 = randomUUID();
  const documentA2 = randomUUID();
  const documentB1 = randomUUID();
  const createdFirmIds = [firmA, firmB];
  const createdEmployeeIds = [employeeA1, employeeA2, employeeB1];
  let fixturesCommitted = false;

  const context = (userId: string, firmId: string, role: string) => ({ userId, firmId, role });
  const accountantA = context(staffA, firmA, "accountant");
  const accountantB = context(staffB, firmB, "accountant");
  const portalManagerContext = context(portalManagerA1, firmA, "company_manager");
  const portalUserContext = context(portalUserA1, firmA, "company_user");

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

      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE mil_platform_admin");
      await client.query(
        `INSERT INTO firms (id, name, cnpj, email) VALUES
         ($1, 'Synthetic HR Security A', $3, $5),
         ($2, 'Synthetic HR Security B', $4, $6)`,
        [firmA, firmB, firmA.replace(/-/g, "").slice(0, 14), firmB.replace(/-/g, "").slice(0, 14), `${firmA}@example.invalid`, `${firmB}@example.invalid`],
      );
      await client.query(
        `INSERT INTO users (id, firm_id, role, status, full_name, email, auth_provider)
         VALUES
         ($1, $2, 'accountant', 'active', 'Synthetic HR Staff A', $3, 'test'),
         ($4, $5, 'accountant', 'active', 'Synthetic HR Staff B', $6, 'test'),
         ($7, $2, 'company_manager', 'active', 'Synthetic HR Portal Manager', $8, 'test'),
         ($9, $2, 'company_user', 'active', 'Synthetic HR Portal User', $10, 'test')`,
        [
          staffA, firmA, `${staffA}@example.invalid`,
          staffB, firmB, `${staffB}@example.invalid`,
          portalManagerA1, `${portalManagerA1}@example.invalid`,
          portalUserA1, `${portalUserA1}@example.invalid`,
        ],
      );
      await client.query(
        `INSERT INTO companies
           (id, firm_id, razao_social, nome_fantasia, cnpj, cnae, regime, responsavel, data_abertura)
         VALUES
           ($1, $2, 'Synthetic HR Company A1 Ltda', 'Synthetic A1', $3, '0000000', 'simples_nacional', 'Synthetic A1', '2020-01-01'),
           ($4, $2, 'Synthetic HR Company A2 Ltda', 'Synthetic A2', $5, '0000000', 'simples_nacional', 'Synthetic A2', '2020-01-01'),
           ($6, $7, 'Synthetic HR Company B1 Ltda', 'Synthetic B1', $8, '0000000', 'simples_nacional', 'Synthetic B1', '2020-01-01')`,
        [
          companyA1, firmA, companyA1.replace(/-/g, "").slice(0, 14),
          companyA2, companyA2.replace(/-/g, "").slice(0, 14),
          companyB1, firmB, companyB1.replace(/-/g, "").slice(0, 14),
        ],
      );
      await client.query(
        `INSERT INTO user_company_access (user_id, company_id, can_manage)
         VALUES ($1, $2, true), ($3, $2, false)`,
        [portalManagerA1, companyA1, portalUserA1],
      );
      await client.query(
        `INSERT INTO user_company_hr_permissions
           (user_id, company_id, can_read_employees, granted_by)
         VALUES ($1, $2, true, $3), ($4, $2, true, $3)`,
        [portalManagerA1, companyA1, staffA, portalUserA1],
      );
      await client.query(
        `INSERT INTO hr_employees
           (id, firm_id, company_id, name, admission_date, employment_type)
         VALUES
           ($1, $2, $3, 'Synthetic HR Employee A1', '2024-01-01', 'clt'),
           ($4, $2, $5, 'Synthetic HR Employee A2', '2024-01-02', 'clt'),
           ($6, $7, $8, 'Synthetic HR Employee B1', '2024-01-03', 'clt')`,
        [
          employeeA1, firmA, companyA1,
          employeeA2, companyA2,
          employeeB1, firmB, companyB1,
        ],
      );
      await client.query(
        `INSERT INTO hr_employee_sensitive_data
           (employee_id, firm_id, company_id, cpf, salary)
         VALUES
           ($1, $2, $3, $4, 101.01),
           ($5, $2, $6, $7, 202.02),
           ($8, $9, $10, $11, 303.03)`,
        [
          employeeA1, firmA, companyA1, `SYNTHETIC-${employeeA1}`,
          employeeA2, companyA2, `SYNTHETIC-${employeeA2}`,
          employeeB1, firmB, companyB1, `SYNTHETIC-${employeeB1}`,
        ],
      );
      await client.query(
        `INSERT INTO hr_employee_documents
           (id, employee_id, document_type, document_name, file_url)
         VALUES
           ($1, $2, 'test', 'Synthetic document A1', $3),
           ($4, $5, 'test', 'Synthetic document A2', $6),
           ($7, $8, 'test', 'Synthetic document B1', $9)`,
        [
          documentA1, employeeA1, `https://example.invalid/${documentA1}`,
          documentA2, employeeA2, `https://example.invalid/${documentA2}`,
          documentB1, employeeB1, `https://example.invalid/${documentB1}`,
        ],
      );
      await client.query("COMMIT");
      fixturesCommitted = true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function cleanupFixtures(): Promise<void> {
    if (!fixturesCommitted) return;
    const client = await fixturePool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE mil_platform_admin");
      await client.query("DELETE FROM hr_employee_documents WHERE id = ANY($1::uuid[])", [[documentA1, documentA2, documentB1]]);
      await client.query("DELETE FROM hr_employees WHERE id = ANY($1::uuid[])", [createdEmployeeIds]);
      await client.query("DELETE FROM user_company_access WHERE user_id = ANY($1::uuid[])", [[staffA, staffB, portalManagerA1, portalUserA1]]);
      await client.query("DELETE FROM companies WHERE id = ANY($1::uuid[])", [[companyA1, companyA2, companyB1]]);
      await client.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[staffA, staffB, portalManagerA1, portalUserA1]]);
      await client.query("DELETE FROM audit_logs WHERE firm_id = ANY($1::uuid[])", [createdFirmIds]);
      await client.query("DELETE FROM firms WHERE id = ANY($1::uuid[])", [createdFirmIds]);
      await client.query("COMMIT");
      fixturesCommitted = false;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  try {
    await createFixtures();

    await suite.test("um escritório não consulta nem altera funcionários de outro escritório", async () => {
      const result = await withTenantContext(accountantA, async (client) => {
        const visible = await client.query<{ id: string; firm_id: string }>(
          "SELECT id, firm_id FROM hr_employees ORDER BY id",
        );
        const byForeignId = await client.query("SELECT id FROM hr_employees WHERE id = $1", [employeeB1]);
        const update = await client.query("UPDATE hr_employees SET name = 'Synthetic cross-firm change' WHERE id = $1", [employeeB1]);
        const deletion = await client.query("DELETE FROM hr_employees WHERE id = $1", [employeeB1]);
        return { visible: visible.rows, byForeignId: byForeignId.rows, updateCount: update.rowCount, deleteCount: deletion.rowCount };
      });

      assert.deepEqual(result.visible.map((row) => row.id).sort(), [employeeA1, employeeA2].sort());
      assert.ok(result.visible.every((row) => row.firm_id === firmA));
      assert.deepEqual(result.byForeignId, []);
      assert.equal(result.updateCount, 0);
      assert.equal(result.deleteCount, 0);

      const foreignFirmView = await withTenantContext(accountantB, async (client) => {
        const rows = await client.query<{ id: string }>("SELECT id FROM hr_employees ORDER BY id");
        return rows.rows.map((row) => row.id);
      });
      assert.deepEqual(foreignFirmView, [employeeB1]);
    });

    await suite.test("empresa vinculada vê apenas funcionários da própria empresa", async () => {
      const managerRows = await withTenantContext(portalManagerContext, async (client) => {
        const rows = await client.query<{ id: string; company_id: string }>(
          "SELECT id, company_id FROM hr_employees ORDER BY id",
        );
        return rows.rows;
      });
      const userRows = await withTenantContext(portalUserContext, async (client) => {
        const rows = await client.query<{ id: string; company_id: string }>(
          "SELECT id, company_id FROM hr_employees ORDER BY id",
        );
        return rows.rows;
      });

      assert.deepEqual(managerRows.map((row) => row.id), [employeeA1]);
      assert.ok(managerRows.every((row) => row.company_id === companyA1));
      assert.deepEqual(userRows.map((row) => row.id), [employeeA1]);
      assert.ok(userRows.every((row) => row.company_id === companyA1));

      const knownOtherCompanyId = await withTenantContext(portalUserContext, async (client) => {
        const rows = await client.query("SELECT id FROM hr_employees WHERE id = $1", [employeeA2]);
        return rows.rows;
      });
      assert.deepEqual(knownOtherCompanyId, []);
    });

    await suite.test("usuário de portal sem permissão não altera nem exclui funcionário", async () => {
      const result = await withTenantContext(portalUserContext, async (client) => {
        const update = await client.query(
          "UPDATE hr_employees SET name = 'Synthetic unauthorized change' WHERE id = $1",
          [employeeA1],
        );
        const deletion = await client.query("DELETE FROM hr_employees WHERE id = $1", [employeeA1]);
        const unchanged = await client.query<{ name: string }>(
          "SELECT name FROM hr_employees WHERE id = $1",
          [employeeA1],
        );
        return { updateCount: update.rowCount, deleteCount: deletion.rowCount, name: unchanged.rows[0]?.name };
      });

      assert.equal(result.updateCount, 0);
      assert.equal(result.deleteCount, 0);
      assert.equal(result.name, "Synthetic HR Employee A1");
    });

    await suite.test("equipe autorizada pode consultar CPF, salário e documentos no escopo", async () => {
      const staffData = await withTenantContext(accountantA, async (client) => {
        const employee = await client.query<{ cpf: string; salary: string }>(
          "SELECT cpf, salary FROM hr_employee_sensitive_data WHERE employee_id = $1",
          [employeeA1],
        );
        const documents = await client.query<{ file_url: string }>(
          "SELECT file_url FROM hr_employee_documents WHERE id = $1",
          [documentA1],
        );
        return { employee: employee.rows[0], documents: documents.rows };
      });
      assert.equal(staffData.employee.cpf, `SYNTHETIC-${employeeA1}`);
      assert.equal(staffData.employee.salary, "101.01");
      assert.deepEqual(staffData.documents, [{ file_url: `https://example.invalid/${documentA1}` }]);
    });

    await suite.test("company_manager sem permissão RH não consulta CPF ou salário", async () => {
      const personalData = await withTenantContext(portalManagerContext, async (client) => {
        const result = await client.query("SELECT cpf, salary FROM hr_employee_sensitive_data WHERE employee_id = $1", [employeeA1]);
        return result.rows;
      });
      assert.deepEqual(personalData, []);
    });

    await suite.test("company_manager sem permissão RH não consulta documentos", async () => {
      const documents = await withTenantContext(portalManagerContext, async (client) => {
        const result = await client.query("SELECT file_url FROM hr_employee_documents WHERE id = $1", [documentA1]);
        return result.rows;
      });
      assert.deepEqual(documents, []);
    });

    await suite.test("company_user sem permissão RH não consulta CPF ou salário", async () => {
      const personalData = await withTenantContext(portalUserContext, async (client) => {
        const result = await client.query("SELECT cpf, salary FROM hr_employee_sensitive_data WHERE employee_id = $1", [employeeA1]);
        return result.rows;
      });
      assert.deepEqual(personalData, []);
    });

    await suite.test("company_user sem permissão RH não consulta documentos", async () => {
      const documents = await withTenantContext(portalUserContext, async (client) => {
        const result = await client.query("SELECT file_url FROM hr_employee_documents WHERE id = $1", [documentA1]);
        return result.rows;
      });
      assert.deepEqual(documents, []);
    });

    await suite.test("consultas RH executam sob a role operacional sem privilégios administrativos", async () => {
      const role = await withTenantContext(accountantA, async (client) => {
        const result = await client.query<{
          database_name: string;
          login_name: string;
          effective_role: string;
          is_superuser: boolean;
          bypass_rls: boolean;
          owns_employee_table: boolean;
        }>(`
          SELECT current_database() AS database_name,
                 session_user AS login_name,
                 current_user AS effective_role,
                 r.rolsuper AS is_superuser,
                 r.rolbypassrls AS bypass_rls,
                 pg_has_role(r.oid, c.relowner, 'USAGE') AS owns_employee_table
          FROM pg_roles r
          JOIN pg_class c ON c.relname = 'hr_employees'
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          WHERE r.rolname = current_user
        `);
        const employee = await client.query("SELECT id FROM hr_employees WHERE id = $1", [employeeA1]);
        return { role: result.rows[0], employeeCount: employee.rowCount };
      });

      assert.equal(role.role.database_name, "mil_contabil_teste");
      assert.equal(role.role.login_name, "mil_app_login");
      assert.equal(role.role.effective_role, "mil_app");
      assert.equal(role.role.is_superuser, false);
      assert.equal(role.role.bypass_rls, false);
      assert.equal(role.role.owns_employee_table, false);
      assert.equal(role.employeeCount, 1);
    });

    await suite.test("GUCs e tokens manipulados não alteram o escopo do contexto autenticado", async () => {
      const result = await withTenantContext(accountantA, async (client) => {
        const before = await client.query<{ user_id: string; firm_id: string; role: string }>(`
          SELECT app_current_user_id()::text AS user_id,
                 app_current_firm_id()::text AS firm_id,
                 app_current_role() AS role
        `);
        await client.query("SELECT set_config('app.current_user_id', $1, true)", [staffB]);
        await client.query("SELECT set_config('app.current_firm_id', $1, true)", [firmB]);
        await client.query("SELECT set_config('app.current_role', 'firm_owner', true)");
        const after = await client.query<{ user_id: string; firm_id: string; role: string }>(`
          SELECT app_current_user_id()::text AS user_id,
                 app_current_firm_id()::text AS firm_id,
                 app_current_role() AS role
        `);
        const foreignEmployee = await client.query("SELECT id FROM hr_employees WHERE id = $1", [employeeB1]);

        await client.query("SAVEPOINT forged_context");
        await assert.rejects(
          client.query("SELECT app_private.set_rls_context($1)", ["forged.token"]),
          (error: { code?: string }) => error.code === "42501",
        );
        await client.query("ROLLBACK TO SAVEPOINT forged_context");

        await client.query("SAVEPOINT role_escalation");
        await client.query("RESET ROLE");
        const resetRole = await client.query<{ role: string }>("SELECT current_user AS role");
        await assert.rejects(client.query("SET LOCAL ROLE mil_platform_admin"));
        await client.query("ROLLBACK TO SAVEPOINT role_escalation");
        const restoredRole = await client.query<{ role: string }>("SELECT current_user AS role");

        return {
          before: before.rows[0],
          after: after.rows[0],
          foreignEmployeeCount: foreignEmployee.rowCount,
          resetRole: resetRole.rows[0]?.role,
          restoredRole: restoredRole.rows[0]?.role,
        };
      });

      assert.deepEqual(result.before, { user_id: staffA, firm_id: firmA, role: "accountant" });
      assert.deepEqual(result.after, result.before);
      assert.equal(result.foreignEmployeeCount, 0);
      assert.equal(result.resetRole, "mil_app_login");
      assert.equal(result.restoredRole, "mil_app");
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
