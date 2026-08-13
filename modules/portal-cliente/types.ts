// =============================================================================
// Módulo: Portal do Cliente
// Espaço seguro para que clientes acessem guias, relatórios, documentos,
// certidões e se comuniquem com o escritório.
// =============================================================================

export type PortalDocumentCategory = "Guia" | "Relatório" | "Certidão" | "Documento" | "Contrato";
export type PortalMessageStatus = "Enviada" | "Lida" | "Respondida" | "Aguardando";

export interface PortalDocument {
  id: string;
  clientId: string;
  nome: string;
  categoria: PortalDocumentCategory;
  dataDisponibilizacao: string;
  tamanho: string;      // ex: "1.2 MB"
  validade?: string;    // ISO date — para certidões e guias
  downloadUrl?: string; // futura URL assinada S3/GCS
}

export interface PortalMessage {
  id: string;
  clientId: string;
  assunto: string;
  corpo: string;
  remetente: "Cliente" | "Escritório";
  status: PortalMessageStatus;
  data: string;
  respostaId?: string; // id da mensagem de resposta
}

export interface PortalGuide {
  id: string;
  clientId: string;
  titulo: string;
  descricao: string;
  tipo: "DAS" | "DARF" | "GRF" | "DCTFWeb" | "Outro";
  valor: number;
  vencimento: string;
  codigoBarras?: string;
  pago: boolean;
  dataDisponibilizacao: string;
}
