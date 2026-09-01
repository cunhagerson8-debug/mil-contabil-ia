import { pool } from "../db/pool.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type AuditStatus = "ok" | "warning" | "error";

export interface AuditCheck {
  name: string;
  status: AuditStatus;
  message: string;
  details?: unknown;
}

export interface MilAuditReport {
  generatedAt: string;
  overallStatus: AuditStatus;
  checks: AuditCheck[];
}

const EXPECTED_MIGRATIONS = [
  "001_extensions_and_enums.sql",
  "002_firms_and_users.sql",
  "003_companies.sql",
  "004_clients.sql",
  "005_tax_obligations.sql",
  "006_invoices.sql",
  "007_alerts.sql",
  "008_client_portal.sql",
  "009_subscriptions_and_billing.sql",
  "010_audit_log.sql",
  "011_row_level_security.sql",
  "012_seed_roles_and_plans.sql",
  "013_tax_obligations_deleted_at.sql",
  "014_tax_obligations_new_schema.sql",
];

const ESSENTIAL_TABLES = [
  "firms",
  "users",
  "companies",
  "clients",
  "tax_obligations",
  "invoices",
  "alerts",
  "portal_documents",
  "plans",
  "subscriptions",
  "audit_logs",
];

function backendFileExists(relativePath: string): boolean {
  const localPath = resolve(process.cwd(), "src", relativePath);
  const productionPath = resolve(process.cwd(), "server", "src", relativePath);

  return existsSync(localPath) || existsSync(productionPath);
}

export class MilAuditorService {
  async runAudit(): Promise<MilAuditReport> {
    const checks: AuditCheck[] = [];

    // 1. Banco de dados
    try {
      await pool.query("SELECT 1");

      checks.push({
        name: "Banco de dados",
        status: "ok",
        message: "Conexão com PostgreSQL funcionando.",
      });
    } catch (error) {
      checks.push({
        name: "Banco de dados",
        status: "error",
        message: "Falha na conexão com PostgreSQL.",
        details: error instanceof Error ? error.message : String(error),
      });

      return this.buildReport(checks);
    }

    // 2. Migrations
    try {
      const result = await pool.query<{ filename: string }>(
        "SELECT filename FROM schema_migrations ORDER BY filename"
      );

      const applied = result.rows.map((row) => row.filename);

      const missing = EXPECTED_MIGRATIONS.filter(
        (migration) => !applied.includes(migration)
      );

      checks.push({
        name: "Migrations",
        status: missing.length === 0 ? "ok" : "error",
        message:
          missing.length === 0
            ? "Todas as migrations esperadas estão registradas."
            : `${missing.length} migration(s) não registrada(s).`,
        details: {
  required: EXPECTED_MIGRATIONS.length,
  requiredApplied: EXPECTED_MIGRATIONS.length - missing.length,
  totalHistoryRecords: applied.length,
  missing,
  historicalOrExtra: applied.filter(
    (migration) => !EXPECTED_MIGRATIONS.includes(migration)
  ),
},
      });
    } catch (error) {
      checks.push({
        name: "Migrations",
        status: "error",
        message: "Não foi possível verificar as migrations.",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    // 3. Tabelas essenciais
    try {
      const result = await pool.query<{ table_name: string }>(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        `
      );

      const existingTables = result.rows.map((row) => row.table_name);

      const missingTables = ESSENTIAL_TABLES.filter(
        (table) => !existingTables.includes(table)
      );

      checks.push({
        name: "Tabelas essenciais",
        status: missingTables.length === 0 ? "ok" : "error",
        message:
          missingTables.length === 0
            ? "Todas as tabelas essenciais foram encontradas."
            : `${missingTables.length} tabela(s) essencial(is) ausente(s).`,
        details: {
          expected: ESSENTIAL_TABLES.length,
          missing: missingTables,
        },
      });
    } catch (error) {
      checks.push({
        name: "Tabelas essenciais",
        status: "error",
        message: "Não foi possível verificar as tabelas.",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    // 4. Row Level Security
    try {
      const result = await pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM pg_policies WHERE schemaname = 'public'"
      );

      const policyCount = Number(result.rows[0]?.count ?? 0);

      checks.push({
        name: "Segurança RLS",
        status: policyCount >= 41 ? "ok" : "warning",
        message:
          policyCount >= 41
            ? `${policyCount} políticas RLS encontradas.`
            : `Somente ${policyCount} políticas RLS foram encontradas.`,
        details: {
          policies: policyCount,
        },
      });
    } catch (error) {
      checks.push({
        name: "Segurança RLS",
        status: "error",
        message: "Não foi possível verificar as políticas RLS.",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    // 5. Planos comerciais
    try {
      const result = await pool.query<{ code: string }>(
        "SELECT code FROM plans WHERE is_active = true ORDER BY code"
      );

      const plans = result.rows.map((row) => row.code);

      const expectedPlans = [
        "starter",
        "professional",
        "enterprise",
        "enterprise_annual",
      ];

      const missingPlans = expectedPlans.filter(
        (plan) => !plans.includes(plan)
      );

      checks.push({
        name: "Planos comerciais",
        status: missingPlans.length === 0 ? "ok" : "warning",
        message:
          missingPlans.length === 0
            ? "Todos os planos comerciais estão ativos."
            : "Existem planos comerciais ausentes ou inativos.",
        details: {
          active: plans,
          missing: missingPlans,
        },
      });
    } catch (error) {
      checks.push({
        name: "Planos comerciais",
        status: "error",
        message: "Não foi possível verificar os planos.",
        details: error instanceof Error ? error.message : String(error),
      });
    }

        // 6. Diagnóstico funcional dos módulos
        const modules = [
      {
        name: "Empresas",
        table: "companies",
        repository: backendFileExists("repositories/company.repository.ts"),
        service: backendFileExists("services/company.service.ts"),
        controller: backendFileExists("controllers/company.controller.ts"),
        route: backendFileExists("routes/companies.routes.ts"),
      },
      {
        name: "Clientes",
        table: "clients",
        repository: backendFileExists("repositories/client.repository.ts"),
        service: backendFileExists("services/client.service.ts"),
        controller: backendFileExists("controllers/client.controller.ts"),
        route: backendFileExists("routes/clients.routes.ts"),
      },
      {
        name: "Escritórios Contábeis",
        table: "firms",
        repository: backendFileExists("repositories/firm.repository.ts"),
        service: backendFileExists("services/firm.service.ts"),
        controller: backendFileExists("controllers/firm.controller.ts"),
        route: backendFileExists("routes/firms.routes.ts"),
      },
      {
        name: "Fiscal / Obrigações",
        table: "tax_obligations",
        repository: backendFileExists("repositories/tax-obligation.repository.ts"),
        service: backendFileExists("services/tax-obligation.service.ts"),
        controller: backendFileExists("controllers/tax-obligation.controller.ts"),
        route: backendFileExists("routes/tax-obligations.routes.ts"),
      },
      {
        name: "Notas Fiscais",
        table: "invoices",
        repository: backendFileExists("repositories/invoice.repository.ts"),
        service: backendFileExists("services/invoice.service.ts"),
        controller: backendFileExists("controllers/invoice.controller.ts"),
        route: backendFileExists("routes/invoices.routes.ts"),
      },
      {
        name: "Alertas",
        table: "alerts",
        repository: backendFileExists("repositories/alert.repository.ts"),
        service: backendFileExists("services/alert.service.ts"),
        controller: backendFileExists("controllers/alert.controller.ts"),
        route: backendFileExists("routes/alerts.routes.ts"),
      },
      {
        name: "Portal do Cliente",
        table: "portal_documents",
        repository: backendFileExists("repositories/portal.repository.ts"),
        service: backendFileExists("services/portal.service.ts"),
        controller: backendFileExists("controllers/portal.controller.ts"),
        route: backendFileExists("routes/portal.routes.ts"),
      },
      {
        name: "Assinaturas / Cobrança",
        table: "subscriptions",
        repository: backendFileExists("repositories/subscription.repository.ts"),
        service: backendFileExists("services/subscription.service.ts"),
        controller: backendFileExists("controllers/subscription.controller.ts"),
        route: backendFileExists("routes/subscriptions.routes.ts"),
      },
      {
        name: "Gestão de RH",
        table: "hr_employees",
        repository: backendFileExists("repositories/employee.repository.ts"),
        service: backendFileExists("services/employee.service.ts"),
        controller: backendFileExists("controllers/employee.controller.ts"),
        route: backendFileExists("routes/employees.routes.ts"),
      },
    ];

    try {
      const tableResult = await pool.query<{ table_name: string }>(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        `
      );

      const existingTables = new Set(
        tableResult.rows.map((row) => row.table_name)
      );

      const moduleDiagnosis = modules.map((module) => {
        const database = existingTables.has(module.table);

        const complete =
          database &&
          module.repository &&
          module.service &&
          module.controller &&
          module.route;

        return {
          module: module.name,
          database,
          repository: module.repository,
          service: module.service,
          controller: module.controller,
          api: module.route,
          status: complete ? "operational" : "incomplete",
        };
      });

      const incompleteModules = moduleDiagnosis.filter(
        (module) => module.status === "incomplete"
      );

      checks.push({
        name: "Diagnóstico de módulos",
        status: incompleteModules.length === 0 ? "ok" : "warning",
        message:
          incompleteModules.length === 0
            ? "Todos os módulos analisados estão operacionais."
            : `${incompleteModules.length} módulo(s) ainda estão incompletos.`,
        details: moduleDiagnosis,
      });
    } catch (error) {
      checks.push({
        name: "Diagnóstico de módulos",
        status: "error",
        message: "Não foi possível realizar o diagnóstico dos módulos.",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    return this.buildReport(checks);
  }

  private buildReport(checks: AuditCheck[]): MilAuditReport {
    let overallStatus: AuditStatus = "ok";

    if (checks.some((check) => check.status === "error")) {
      overallStatus = "error";
    } else if (checks.some((check) => check.status === "warning")) {
      overallStatus = "warning";
    }

    return {
      generatedAt: new Date().toISOString(),
      overallStatus,
      checks,
    };
  }
}

export const milAuditorService = new MilAuditorService();