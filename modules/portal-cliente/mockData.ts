import { PortalDocument, PortalMessage, PortalGuide } from "./types";

export const mockPortalDocuments: PortalDocument[] = [
  {
    id: "pd-001", clientId: "cli-001", nome: "Balancete Maio 2026", categoria: "Relatório",
    dataDisponibilizacao: "2026-06-05", tamanho: "284 KB",
  },
  {
    id: "pd-002", clientId: "cli-001", nome: "DAS – Guia Maio 2026", categoria: "Guia",
    dataDisponibilizacao: "2026-06-12", tamanho: "58 KB", validade: "2026-06-20",
  },
  {
    id: "pd-003", clientId: "cli-001", nome: "Certidão Negativa Federal", categoria: "Certidão",
    dataDisponibilizacao: "2026-05-20", tamanho: "120 KB", validade: "2026-08-20",
  },
  {
    id: "pd-004", clientId: "cli-001", nome: "Contrato de Prestação de Serviços 2026", categoria: "Contrato",
    dataDisponibilizacao: "2025-12-30", tamanho: "430 KB",
  },
  {
    id: "pd-005", clientId: "cli-002", nome: "ECD – Arquivo SPED 2025", categoria: "Documento",
    dataDisponibilizacao: "2026-06-17", tamanho: "4.8 MB",
  },
  {
    id: "pd-006", clientId: "cli-002", nome: "Relatório de Apuração Trimestral Q1/2026", categoria: "Relatório",
    dataDisponibilizacao: "2026-05-10", tamanho: "1.1 MB",
  },
  {
    id: "pd-007", clientId: "cli-002", nome: "DCTFWeb – Guia Maio 2026", categoria: "Guia",
    dataDisponibilizacao: "2026-06-10", tamanho: "62 KB", validade: "2026-07-15",
  },
];

export const mockPortalMessages: PortalMessage[] = [
  {
    id: "pm-001", clientId: "cli-001",
    assunto: "Dúvida sobre limite de faturamento no Simples",
    corpo: "Bom dia! Gostaria de saber se estou próximo do limite de faturamento do Simples Nacional e quais as implicações caso ultrapasse. Att, Marcos.",
    remetente: "Cliente", status: "Respondida", data: "2026-06-10T10:22:00",
  },
  {
    id: "pm-002", clientId: "cli-001",
    assunto: "Re: Dúvida sobre limite de faturamento no Simples",
    corpo: "Bom dia, Marcos! O limite anual do Simples Nacional é R$ 4,8 milhões. Com base no seu faturamento atual, você está em 78% do limite. Recomendamos acompanhar mensalmente. Qualquer dúvida, estamos à disposição.",
    remetente: "Escritório", status: "Lida", data: "2026-06-10T14:05:00",
    respostaId: "pm-001",
  },
  {
    id: "pm-003", clientId: "cli-002",
    assunto: "Prazo para entrega dos documentos de junho",
    corpo: "Olá, quais documentos precisamos entregar até quando para o fechamento de junho? Obrigada.",
    remetente: "Cliente", status: "Aguardando", data: "2026-06-17T09:15:00",
  },
];

export const mockPortalGuides: PortalGuide[] = [
  {
    id: "pg-001", clientId: "cli-001",
    titulo: "DAS – Simples Nacional – 05/2026",
    descricao: "Guia do Documento de Arrecadação do Simples Nacional referente à competência 05/2026.",
    tipo: "DAS", valor: 1840.50, vencimento: "2026-06-20",
    codigoBarras: "85810000018-4 40560000000-0 00000000000-0 00000000000-0",
    pago: false, dataDisponibilizacao: "2026-06-12",
  },
  {
    id: "pg-002", clientId: "cli-001",
    titulo: "DAS – Simples Nacional – 04/2026",
    descricao: "Guia do Documento de Arrecadação do Simples Nacional referente à competência 04/2026.",
    tipo: "DAS", valor: 1790.00, vencimento: "2026-05-20",
    pago: true, dataDisponibilizacao: "2026-05-10",
  },
  {
    id: "pg-003", clientId: "cli-002",
    titulo: "DCTFWeb – Contribuições – 05/2026",
    descricao: "Guia de recolhimento das contribuições previdenciárias apuradas na DCTFWeb.",
    tipo: "DCTFWeb", valor: 8420.00, vencimento: "2026-07-15",
    pago: false, dataDisponibilizacao: "2026-06-10",
  },
];
