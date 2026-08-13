import { Invoice } from "./types";

export const mockInvoices: Invoice[] = [
  {
    id: "nf-001", companyId: "emp-002", numero: "000125", tipo: "NFS-e",
    status: "Emitida", dataEmissao: "2026-06-10",
    tomador: "Banco do Brasil S.A.", tomadorDoc: "00.000.000/0001-91",
    itens: [{ descricao: "Desenvolvimento de Software – Projeto Portal", quantidade: 1, valorUnitario: 18000, valorTotal: 18000 }],
    valorTotal: 18000,
    impostos: { iss: 900, pis: 117, cofins: 540, csll: 162, irrf: 360 },
    chaveAcesso: "NFSe-2026-000125-SP-RPS",
  },
  {
    id: "nf-002", companyId: "emp-002", numero: "000124", tipo: "NFS-e",
    status: "Emitida", dataEmissao: "2026-06-01",
    tomador: "Ambev S.A.", tomadorDoc: "07.526.557/0001-00",
    itens: [
      { descricao: "Consultoria em Arquitetura de Sistemas", quantidade: 40, valorUnitario: 250, valorTotal: 10000 },
      { descricao: "Suporte Técnico Mensal", quantidade: 1, valorUnitario: 2000, valorTotal: 2000 },
    ],
    valorTotal: 12000,
    impostos: { iss: 600, pis: 78, cofins: 360 },
    chaveAcesso: "NFSe-2026-000124-SP-RPS",
  },
  {
    id: "nf-003", companyId: "emp-002", numero: "000123", tipo: "NFS-e",
    status: "Cancelada", dataEmissao: "2026-05-28",
    tomador: "Rede Globo S.A.", tomadorDoc: "27.865.757/0001-02",
    itens: [{ descricao: "Licença de Software – versão incorreta", quantidade: 1, valorUnitario: 5000, valorTotal: 5000 }],
    valorTotal: 5000,
    impostos: { iss: 250 },
    motivoCancelamento: "Nota emitida com versão de produto incorreta. Reemissão com número 000126.",
  },
  {
    id: "nf-004", companyId: "emp-001", numero: "000089", tipo: "NF-e",
    status: "Emitida", dataEmissao: "2026-06-08",
    tomador: "Supermercado Meireles Ltda", tomadorDoc: "44.555.666/0001-77",
    itens: [
      { descricao: "Pão Francês – caixa 50kg", quantidade: 10, valorUnitario: 85, valorTotal: 850 },
      { descricao: "Croissant Manteiga – caixa 30un", quantidade: 20, valorUnitario: 45, valorTotal: 900 },
    ],
    valorTotal: 1750,
    impostos: {},
    chaveAcesso: "35260612345678000190550010000000891000000897",
  },
  {
    id: "nf-005", companyId: "emp-002", numero: "000126", tipo: "NFS-e",
    status: "Em Processo", dataEmissao: "2026-06-18",
    tomador: "Rede Globo S.A.", tomadorDoc: "27.865.757/0001-02",
    itens: [{ descricao: "Licença de Software – v3.2 Enterprise", quantidade: 1, valorUnitario: 5000, valorTotal: 5000 }],
    valorTotal: 5000,
    impostos: { iss: 250, pis: 32.50, cofins: 150 },
  },
];
