import { withPlatformReadOnlyContext, withTenantContext, type TenantContext } from "../db/withTenantContext.js";
import { aiContextRepository, AI_CONTEXT_LIMITS, type AiObligationRow, type AiPlatformObligationRow } from "../repositories/ai-context.repository.js";
import type {
  AiCompanyRecord,
  AiContextData,
  AiObligationClassification,
  AiObligationRecord,
} from "../types/ai-context.js";
import { ConflictError, ForbiddenError } from "../utils/errors.js";

function classifyObligation(row: AiObligationRow, today: Date): AiObligationClassification {
  if (row.status === "nao_aplicavel") return "nao_aplicavel";
  if (row.completed_at || row.paid_at) return "em_dia";

  const dueDate = new Date(`${row.due_date}T00:00:00Z`);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueUtc = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const daysUntilDue = Math.floor((dueUtc - todayUtc) / 86_400_000);

  if (daysUntilDue < 0) return "vencida";
  if (daysUntilDue <= 15) return "proxima";
  return "em_dia";
}

function toCompanyRecord(row: Awaited<ReturnType<typeof aiContextRepository.findCompanies>>[number]): AiCompanyRecord {
  return {
    id: row.id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    regime: row.regime,
    status: row.status,
  };
}

function toObligationRecord(row: AiObligationRow, classification: AiObligationClassification): AiObligationRecord {
  return {
    companyId: row.company_id,
    companyName: row.company_name,
    nome: row.nome ?? row.obligation_type ?? "Obrigação fiscal",
    type: row.obligation_type ?? "Não informado",
    competencia: row.period ?? "Não informada",
    vencimento: row.due_date,
    classificacao: classification,
    valor: row.amount !== null ? Number(row.amount) : undefined,
  };
}

function toPlatformObligationRecord(row: AiPlatformObligationRow): AiObligationRecord {
  return {
    companyId: "redacted-platform-context",
    companyName: row.company_name,
    nome: row.nome ?? row.obligation_type ?? "Obrigação fiscal",
    type: row.obligation_type ?? "Não informado",
    competencia: row.period ?? "Não informada",
    vencimento: row.due_date,
    classificacao: row.classification as AiObligationClassification,
    valor: row.amount !== null ? Number(row.amount) : undefined,
  };
}

export const aiContextService = {
  async buildForTenant(ctx: TenantContext, message: string): Promise<AiContextData> {
    if (!ctx.firmId) {
      throw new ConflictError("A Assistente MIL IA exige um usuário vinculado a um escritório.");
    }

    return withTenantContext(ctx, async (client) => {
      const normalizedMessage = message.toLocaleLowerCase("pt-BR");
      const [totalEmpresas, companies] = await Promise.all([
        aiContextRepository.countCompanies(client),
        aiContextRepository.findCompanies(client),
      ]);

      const selectedCompany = companies.find((company) =>
        normalizedMessage.includes(company.nome_fantasia.toLocaleLowerCase("pt-BR"))
        || normalizedMessage.includes(company.razao_social.toLocaleLowerCase("pt-BR"))
        || normalizedMessage.includes(company.cnpj)
      );
      const obligations = await aiContextRepository.findObligations(client, selectedCompany?.id);
      const today = new Date();
      const classified = obligations.map((row) => ({
        row,
        classification: classifyObligation(row, today),
      }));
      const relevant = classified
        .filter(({ classification }) => classification === "vencida" || classification === "proxima")
        .slice(0, AI_CONTEXT_LIMITS.relevantObligations)
        .map(({ row, classification }) => toObligationRecord(row, classification));
      const selected = selectedCompany ? toCompanyRecord(selectedCompany) : undefined;
      const companiesWithOverdue = new Set(classified.filter((item) => item.classification === "vencida").map((item) => item.row.company_id));
      const companiesWithUpcoming = new Set(classified.filter((item) => item.classification === "proxima").map((item) => item.row.company_id));

      return {
        escopo: selected ? "empresa" : "escritorio",
        totalEmpresas,
        empresasAtivas: companies.filter((company) => company.status === "ativa").length,
        empresasEmDia: companies.filter((company) => !companiesWithOverdue.has(company.id) && !companiesWithUpcoming.has(company.id)).length,
        empresasComVencidas: companiesWithOverdue.size,
        empresasComProximas: companiesWithUpcoming.size,
        obrigacoesVencidas: classified.filter((item) => item.classification === "vencida").length,
        obrigacoesProximas: classified.filter((item) => item.classification === "proxima").length,
        obrigacoesEmDia: classified.filter((item) => item.classification === "em_dia").length,
        empresaSelecionada: selected,
        empresas: selected
  ? undefined
  : companies
      .filter((company) => company.status === "ativa")
      .slice(0, AI_CONTEXT_LIMITS.companies)
      .map(toCompanyRecord),
        obrigacoesRelevantes: relevant,
        registrosLimitados: totalEmpresas > AI_CONTEXT_LIMITS.companies || obligations.length >= AI_CONTEXT_LIMITS.obligations,
      };
    });
  },

  async buildForPlatformAdmin(ctx: TenantContext, _message: string): Promise<AiContextData> {
    if (ctx.role !== "platform_admin") {
      throw new ForbiddenError("Somente platform_admin pode consultar a visão global da plataforma.");
    }

    return withPlatformReadOnlyContext(async (client) => {
      const isPlatformAdmin = await aiContextRepository.assertPlatformAdmin(client, ctx.userId);
      if (!isPlatformAdmin) {
        throw new ForbiddenError("Usuário não autorizado como platform_admin.");
      }

      const [summary, relevantObligations] = await Promise.all([
        aiContextRepository.getPlatformSummary(client),
        aiContextRepository.findRelevantPlatformObligations(client, AI_CONTEXT_LIMITS.platformObligations),
      ]);

      return {
        escopo: "plataforma",
        totalEscritorios: Number(summary.total_firms),
        totalEmpresas: Number(summary.total_companies),
        empresasAtivas: Number(summary.active_companies),
        empresasEmDia: 0,
        empresasComVencidas: Number(summary.companies_with_overdue),
        empresasComProximas: Number(summary.companies_with_upcoming),
        obrigacoesVencidas: Number(summary.overdue_obligations),
        obrigacoesProximas: Number(summary.upcoming_obligations),
        obrigacoesEmDia: Number(summary.on_time_obligations),
        obrigacoesRelevantes: relevantObligations.map(toPlatformObligationRecord),
        registrosLimitados: true,
      };
    });
  },
};