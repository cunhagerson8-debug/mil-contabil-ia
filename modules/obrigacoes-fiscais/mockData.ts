import { TaxObligation } from "./types";

export const mockObrigacoes: TaxObligation[] = [
  // ── Padaria Pão Dourado (Simples Nacional) ──────────────────────────────────
  {
    id: "obr-001", companyId: "emp-001", nome: "DAS – Simples Nacional", type: "DAS",
    competencia: "05/2026", vencimento: "2026-06-20", status: "Próxima do Vencimento",
    valor: 1840.50, periodicidade: "Mensal", integrationSource: "Receita Federal",
  },
  {
    id: "obr-002", companyId: "emp-001", nome: "PGDAS-D – Declaração Mensal", type: "PGDAS",
    competencia: "05/2026", vencimento: "2026-06-20", status: "Próxima do Vencimento",
    periodicidade: "Mensal", integrationSource: "Receita Federal",
  },
  {
    id: "obr-003", companyId: "emp-001", nome: "eSocial – Eventos Periódicos", type: "eSocial",
    competencia: "05/2026", vencimento: "2026-06-07", status: "Em Dia",
    periodicidade: "Mensal", integrationRef: "REC-2026-0506-0091234",
    integrationSource: "eSocial",
  },
  {
    id: "obr-004", companyId: "emp-001", nome: "FGTS Digital – Competência Maio", type: "FGTS Digital",
    competencia: "05/2026", vencimento: "2026-06-07", status: "Em Dia",
    valor: 620.00, periodicidade: "Mensal", integrationSource: "FGTS Digital",
  },
  {
    id: "obr-005", companyId: "emp-001", nome: "DAS – Simples Nacional", type: "DAS",
    competencia: "04/2026", vencimento: "2026-05-20", status: "Em Dia",
    valor: 1790.00, periodicidade: "Mensal",
  },

  // ── Tech Solutions (Lucro Presumido) ────────────────────────────────────────
  {
    id: "obr-006", companyId: "emp-002", nome: "DCTFWeb – Contribuições", type: "DCTFWeb",
    competencia: "05/2026", vencimento: "2026-06-15", status: "Próxima do Vencimento",
    valor: 8420.00, periodicidade: "Mensal", integrationSource: "Receita Federal",
  },
  {
    id: "obr-007", companyId: "emp-002", nome: "EFD-Reinf – Série R-2010", type: "EFD-Reinf",
    competencia: "05/2026", vencimento: "2026-06-15", status: "Próxima do Vencimento",
    periodicidade: "Mensal", integrationSource: "Receita Federal",
  },
  {
    id: "obr-008", companyId: "emp-002", nome: "ECD – Exercício 2025", type: "ECD",
    competencia: "2025", vencimento: "2026-06-30", status: "Próxima do Vencimento",
    periodicidade: "Anual", integrationSource: "Receita Federal",
  },
  {
    id: "obr-009", companyId: "emp-002", nome: "ECF – Exercício 2025", type: "ECF",
    competencia: "2025", vencimento: "2026-07-31", status: "Em Dia",
    periodicidade: "Anual",
  },
  {
    id: "obr-010", companyId: "emp-002", nome: "eSocial – Folha de Pagamento", type: "eSocial",
    competencia: "05/2026", vencimento: "2026-06-07", status: "Em Dia",
    periodicidade: "Mensal", integrationRef: "REC-2026-0506-0044512", integrationSource: "eSocial",
  },
  {
    id: "obr-011", companyId: "emp-002", nome: "Certidão Negativa Federal", type: "Certidão",
    competencia: "06/2026", vencimento: "2026-09-15", status: "Em Dia",
    periodicidade: "Eventual", observacoes: "Certidão conjunta RFB/PGFN válida até set/2026",
  },
  {
    id: "obr-012", companyId: "emp-002", nome: "DARF – IRPJ Estimativa Mensal", type: "DARF",
    competencia: "05/2026", vencimento: "2026-05-30", status: "Vencida",
    valor: 4200.00, periodicidade: "Mensal",
    observacoes: "Verificar se houve recolhimento fora da plataforma",
  },

  // ── Metalúrgica Santa Fé (Lucro Real) ──────────────────────────────────────
  {
    id: "obr-013", companyId: "emp-004", nome: "FGTS Digital – Competência Abril", type: "FGTS Digital",
    competencia: "04/2026", vencimento: "2026-05-07", status: "Vencida",
    valor: 3100.00, periodicidade: "Mensal", integrationSource: "FGTS Digital",
    observacoes: "Em processo de encerramento – verificar obrigação de recolhimento",
  },
  {
    id: "obr-014", companyId: "emp-004", nome: "GRF – FGTS Rescisório", type: "GRF",
    competencia: "06/2026", vencimento: "2026-06-25", status: "Próxima do Vencimento",
    valor: 5800.00, periodicidade: "Eventual",
    observacoes: "Rescisões de encerramento de atividade",
  },
];
