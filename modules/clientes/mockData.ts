import { Client } from "./types";

export const mockClients: Client[] = [
  {
    id: "cli-001",
    companyId: "emp-001",
    nome: "Padaria Pão Dourado Ltda",
    tipo: "Pessoa Jurídica",
    documento: "12.345.678/0001-90",
    status: "Ativo",
    dataCadastro: "2018-03-20",
    servicosContratados: ["Contabilidade Mensal", "Folha de Pagamento", "Consultoria Tributária"],
    contatos: [
      { id: "ct-1", nome: "Marcos Vinícius Silva", cargo: "Sócio-Administrador", email: "marcos@paodourado.com.br", telefone: "(11) 98888-1234", principal: true },
    ],
    documentos: [
      { id: "doc-1", nome: "Contrato Social Consolidado", tipo: "Contrato Social", dataUpload: "2024-01-15" },
      { id: "doc-2", nome: "Procuração Eletrônica e-CAC", tipo: "Procuração", dataUpload: "2025-02-10", validade: "2027-02-10" },
    ],
    historico: [
      { id: "h-1", data: "2026-06-10", tipo: "Atendimento", descricao: "Dúvida sobre enquadramento no Simples Nacional", responsavel: "Ana Paula Ferreira" },
      { id: "h-2", data: "2026-05-02", tipo: "Documento", descricao: "Envio de notas fiscais de abril", responsavel: "Marcos Vinícius Silva" },
    ],
  },
  {
    id: "cli-002",
    companyId: "emp-002",
    nome: "Tech Solutions Desenvolvimento de Software S.A.",
    tipo: "Pessoa Jurídica",
    documento: "23.456.789/0001-11",
    status: "Ativo",
    dataCadastro: "2015-08-01",
    servicosContratados: ["Contabilidade Mensal", "BPO Financeiro", "Consultoria Tributária", "Emissão de Notas"],
    contatos: [
      { id: "ct-2", nome: "Fernanda Lima", cargo: "CEO", email: "fernanda@techsolutions.com.br", telefone: "(11) 97777-2222", principal: true },
      { id: "ct-3", nome: "Rodrigo Almeida", cargo: "CFO", email: "rodrigo@techsolutions.com.br", telefone: "(11) 96666-3333", principal: false },
    ],
    documentos: [
      { id: "doc-3", nome: "Certidão Negativa Federal", tipo: "Certidão", dataUpload: "2026-05-20", validade: "2026-08-20" },
    ],
    historico: [
      { id: "h-3", data: "2026-06-15", tipo: "Cobrança", descricao: "Honorários de junho enviados", responsavel: "Carlos Eduardo Souza" },
    ],
  },
  {
    id: "cli-003",
    companyId: "emp-003",
    nome: "João Pedro Santos",
    tipo: "Pessoa Física",
    documento: "456.789.012-33",
    status: "Ativo",
    dataCadastro: "2022-01-15",
    servicosContratados: ["Contabilidade MEI"],
    contatos: [
      { id: "ct-4", nome: "João Pedro Santos", cargo: "Titular", email: "joaopedro@jpconsultoria.com.br", telefone: "(11) 98877-6655", principal: true },
    ],
    documentos: [],
    historico: [
      { id: "h-4", data: "2026-04-30", tipo: "Observação", descricao: "Cliente solicitou orientação sobre limite de faturamento MEI", responsavel: "Ana Paula Ferreira" },
    ],
  },
  {
    id: "cli-004",
    nome: "Mariana Costa",
    tipo: "Pessoa Física",
    documento: "789.012.345-66",
    status: "Prospecto",
    dataCadastro: "2026-06-01",
    servicosContratados: [],
    contatos: [
      { id: "ct-5", nome: "Mariana Costa", cargo: "Interessada", email: "mariana.costa@gmail.com", telefone: "(11) 95555-4444", principal: true },
    ],
    documentos: [],
    historico: [
      { id: "h-5", data: "2026-06-01", tipo: "Atendimento", descricao: "Reunião inicial - abertura de MEI", responsavel: "Carlos Eduardo Souza" },
    ],
  },
];
