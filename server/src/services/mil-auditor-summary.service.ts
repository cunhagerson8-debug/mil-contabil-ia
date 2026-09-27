// =============================================================================
// Resumo Executivo determinístico — extraído de mil-auditor.service.ts para
// ser reutilizado tanto pelo MIL Auditor quanto pelo contexto da MIL IA, sem
// duplicar a regra de classificação/priorização em dois lugares.
// =============================================================================
import { taxObligationRepository } from "../repositories/tax-obligation.repository.js";
import { taxObligationRepository as taxObligationRepositoryAllFirms } from "../repositories/taxObligation.repository.js";
import { aiContextRepository } from "../repositories/ai-context.repository.js";
import { milAuditorRepository } from "../repositories/mil-auditor.repository.js";
import { TenantContext, withPlatformReadOnlyContext, withTenantContext } from "../db/withTenantContext.js";
import { ForbiddenError } from "../utils/errors.js";

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

export interface MilAuditorSummaryResult {
  totalObligations: number;
  overdueCount: number;
  upcomingCount: number;
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

export const milAuditorSummaryService = {
  async build(ctx: TenantContext): Promise<MilAuditorSummaryResult> {
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

    return {
      totalObligations: taxObligations.length,
      overdueCount: overdueObligations.length,
      upcomingCount: upcomingObligations.length,
      executiveSummary,
    };
  },
};
