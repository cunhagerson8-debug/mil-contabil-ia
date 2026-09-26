import { pool } from "../db/pool.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { taxObligationRepository } from "../repositories/tax-obligation.repository.js";
import { taxObligationRepository as taxObligationRepositoryAllFirms } from "../repositories/taxObligation.repository.js";
import { aiContextRepository } from "../repositories/ai-context.repository.js";
import { milAuditorRepository } from "../repositories/mil-auditor.repository.js";
import { TenantContext, withPlatformReadOnlyContext, withTenantContext } from "../db/withTenantContext.js";
import { ForbiddenError } from "../utils/errors.js";

export type AuditStatus = "ok" | "warning" | "error";

export interface AuditCheck {
  name: string;
  status: AuditStatus;
  message: string;
  details?: unknown;
}

export interface ExecutivePriority {
  companyId: string | null;
  companyName: string | null;
  obligationType: string;
  obligationName: string;
  dueDate: string | null;
  amount?: number;
  priority: "critica" | "alta";
  priorityReason: string;
  requiresHumanDecision: boolean;
  recommendation: string;
}

export interface ExecutiveSummary {
  totalCriticalPendencies: number;
  totalOverdueObligations: number;
  totalUpcomingObligations: number;
  topPriorities: ExecutivePriority[];
  factualSummary: string;
}

export interface MilAuditReport {
  generatedAt: string;
  overallStatus: AuditStatus;
  checks: AuditCheck[];
  executiveSummary: ExecutiveSummary;
}

interface PriorityCandidate extends Omit<ExecutivePriority, "companyName"> {
  companyName: string | null;
  sourceId: string | null;
}

const MAX_EXECUTIVE_PRIORITIES = 5;

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function obligationField(row: unknown, ...fieldNames: string[]): unknown {
  if (!row || typeof row !== "object") return undefined;
  const record = row as Record<string, unknown>;
  return fieldNames.map((fieldName) => record[fieldName]).find((value) => value !== null && value !== undefined);
}

function obligationStatus(row: unknown): string | undefined {
  const status = obligationField(row, "status");
  return typeof status === "string" ? status : undefined;
}

function toCivilDate(value: unknown): string | null {
  let civilDate: string;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear().toString().padStart(4, "0");
    const month = (value.getMonth() + 1).toString().padStart(2, "0");
    const day = value.getDate().toString().padStart(2, "0");
    civilDate = `${year}-${month}-${day}`;
  } else if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value);
    if (!match) return null;
    civilDate = match[1];
  } else {
    return null;
  }

  const [year, month, day] = civilDate.split("-").map(Number);
  const validated = new Date(Date.UTC(year, month - 1, day));
  return validated.toISOString().slice(0, 10) === civilDate ? civilDate : null;
}

function createPriorityCandidate(row: unknown, priority: "critica" | "alta"): PriorityCandidate {
  const sourceId = obligationField(row, "id");
  const companyId = obligationField(row, "company_id", "companyId");
  const rawType = obligationField(row, "obligation_type", "type");
  const rawName = obligationField(row, "nome", "name", "obligation_type", "type");
  const rawDueDate = obligationField(row, "due_date", "vencimento");
  const rawAmount = obligationField(row, "amount", "valor");
  const amount = rawAmount === undefined || rawAmount === null ? undefined : Number(rawAmount);

  return {
    sourceId: typeof sourceId === "string" ? sourceId : null,
    companyId: typeof companyId === "string" ? companyId : null,
    companyName: null,
    obligationType: typeof rawType === "string" ? rawType : "Não informado",
    obligationName: typeof rawName === "string" ? rawName : "Obrigação fiscal",
    dueDate: toCivilDate(rawDueDate),
    ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}),
    priority,
    priorityReason: priority === "critica"
      ? "O vencimento já passou e a obrigação está marcada como vencida."
      : "A obrigação está marcada como próxima do vencimento e requer acompanhamento preventivo.",
    requiresHumanDecision: priority === "critica",
    recommendation: priority === "critica"
      ? "Verificar comprovante ou registro externo e definir a regularização com o responsável."
      : "Confirmar o responsável e acompanhar a conclusão até o vencimento.",
  };
}

function selectPriorityCandidates(obligations: readonly unknown[]): PriorityCandidate[] {
  const candidates = obligations.flatMap((obligation) => {
    const status = obligationStatus(obligation);
    if (status === "vencida") return [createPriorityCandidate(obligation, "critica")];
    if (status === "proxima_vencimento") return [createPriorityCandidate(obligation, "alta")];
    return [];
  });

  return candidates
    .sort((left, right) => {
      const priorityOrder = { critica: 0, alta: 1 };
      return priorityOrder[left.priority] - priorityOrder[right.priority]
        || compareText(left.dueDate ?? "9999-12-31", right.dueDate ?? "9999-12-31")
        || compareText(left.companyId ?? "", right.companyId ?? "")
        || compareText(left.obligationName, right.obligationName)
        || compareText(left.sourceId ?? "", right.sourceId ?? "");
    })
    .slice(0, MAX_EXECUTIVE_PRIORITIES);
}

function createExecutiveSummary(
  totalOverdueObligations: number,
  totalUpcomingObligations: number,
  candidates: PriorityCandidate[],
  companyNames: Map<string, string>
): ExecutiveSummary {
  const topPriorities = candidates.map(({ sourceId: _sourceId, ...candidate }) => ({
    ...candidate,
    companyName: candidate.companyId ? companyNames.get(candidate.companyId) ?? null : null,
  }));

  return {
    totalCriticalPendencies: totalOverdueObligations,
    totalOverdueObligations,
    totalUpcomingObligations,
    topPriorities,
    factualSummary: `Há ${totalOverdueObligations} obrigação(ões) vencida(s) e ${totalUpcomingObligations} próxima(s) do vencimento. ${totalOverdueObligations} pendência(s) crítica(s) requer(em) análise humana. A lista contém ${topPriorities.length} prioridade(s) fiscal(is).`,
  };
}

function toCompanyNameMap(rows: Array<{ id: string; nome_fantasia: string }>): Map<string, string> {
  return new Map(rows.map((row) => [row.id, row.nome_fantasia]));
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
  async runAudit(ctx: TenantContext): Promise<MilAuditReport> {
    const checks: AuditCheck[] = [];
    let taxObligations: unknown[];
    let companyNames = new Map<string, string>();

    // platform_admin não pertence a nenhum escritório (firmId = null): o
    // filtro por firm_id do fluxo comum (listByFirm) sempre retornaria vazio.
    // Reaproveita o mesmo caminho seguro já usado pela tela de Obrigações
    // Fiscais para platform_admin — leitura somente-leitura sem filtro de
    // firm, com revalidação explícita do usuário no banco.
    if (ctx.role === "platform_admin") {
      const platformData = await withPlatformReadOnlyContext(async (client) => {
          const isPlatformAdmin = await aiContextRepository.assertPlatformAdmin(client, ctx.userId);
          if (!isPlatformAdmin) throw new ForbiddenError("Usuário não autorizado como platform_admin.");
          const obligations = await taxObligationRepositoryAllFirms.findAll(client);
          const candidates = selectPriorityCandidates(obligations);
          const companyIds = [...new Set(candidates.flatMap((item) => item.companyId ? [item.companyId] : []))];
          const companies = await milAuditorRepository.findCompanyNamesGlobally(client, companyIds);
          return { obligations, companies };
        });
      taxObligations = platformData.obligations;
      companyNames = toCompanyNameMap(platformData.companies);
    } else {
      taxObligations = await taxObligationRepository.listByFirm(ctx);
      if (ctx.firmId) {
        const candidates = selectPriorityCandidates(taxObligations);
        const companyIds = [...new Set(candidates.flatMap((item) => item.companyId ? [item.companyId] : []))];
        const companies = await withTenantContext(ctx, (client) =>
          milAuditorRepository.findCompanyNamesByFirm(client, ctx.firmId!, companyIds)
        );
        companyNames = toCompanyNameMap(companies);
      }
    }

const overdueObligations = taxObligations.filter((item) => obligationStatus(item) === "vencida");

const upcomingObligations = taxObligations.filter((item) => obligationStatus(item) === "proxima_vencimento");
const priorityCandidates = selectPriorityCandidates(taxObligations);
const executiveSummary = createExecutiveSummary(
  overdueObligations.length,
  upcomingObligations.length,
  priorityCandidates,
  companyNames
);

checks.push({
  name: "Situação Fiscal",
  status:
    overdueObligations.length > 0
      ? "error"
      : upcomingObligations.length > 0
        ? "warning"
        : "ok",
  message:
    overdueObligations.length > 0
      ? `${overdueObligations.length} obrigação(ões) fiscal(is) vencida(s).`
      : upcomingObligations.length > 0
        ? `${upcomingObligations.length} obrigação(ões) próxima(s) do vencimento.`
        : "Nenhuma obrigação fiscal vencida ou próxima do vencimento.",
  details: {
    overdue: overdueObligations.length,
    upcoming: upcomingObligations.length,
    total: taxObligations.length,
  },
});


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

      return this.buildReport(checks, executiveSummary);
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

    checks.push({
  name: "Automação Fiscal",
  status: backendFileExists("jobs/obligation-status.job.ts") ? "ok" : "warning",
  message: backendFileExists("jobs/obligation-status.job.ts")
    ? "Job diário de atualização das obrigações fiscais está configurado."
    : "Job diário de atualização das obrigações fiscais não foi encontrado.",
  details: {
    jobFile: "jobs/obligation-status.job.ts",
    configured: backendFileExists("jobs/obligation-status.job.ts"),
  },
});

    return this.buildReport(checks, executiveSummary);
  }

  private buildReport(checks: AuditCheck[], executiveSummary: ExecutiveSummary): MilAuditReport {
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
      executiveSummary,
    };
  }
}

export const milAuditorService = new MilAuditorService();