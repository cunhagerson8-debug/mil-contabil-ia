// =============================================================================
// Módulo: Notas Fiscais
// Emissão, consulta, cancelamento e relatórios de NFS-e, NF-e e NFC-e.
// Futuramente integrado com SEFAZ e APIs de emissão via Certificado A1.
// =============================================================================

export type InvoiceType = "NFS-e" | "NF-e" | "NFC-e";
export type InvoiceStatus = "Emitida" | "Cancelada" | "Rejeitada" | "Pendente" | "Em Processo";

export interface InvoiceItem {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  numero: string;
  tipo: InvoiceType;
  status: InvoiceStatus;
  dataEmissao: string;
  tomador: string;           // razão social / nome do destinatário
  tomadorDoc: string;        // CPF ou CNPJ
  itens: InvoiceItem[];
  valorTotal: number;
  impostos: {
    iss?: number;
    pis?: number;
    cofins?: number;
    csll?: number;
    irrf?: number;
  };
  chaveAcesso?: string;      // chave 44 dígitos NF-e / protocolo NFS-e
  xmlUrl?: string;           // futura URL do XML via integração SEFAZ
  pdfUrl?: string;
  motivoCancelamento?: string;
}
