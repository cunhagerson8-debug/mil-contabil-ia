// =============================================================================
// MIL CONTÁBIL IA — Architecture: Integrations
// =============================================================================
// Este arquivo define as interfaces (contratos) de todas as integrações
// externas planejadas. Cada integração segue o padrão Adapter:
//
//   interface XxxAdapter  →  define o contrato público
//   MockXxxAdapter        →  implementação de stub com dados simulados
//   (futura) HttpXxxAdapter → implementação real usando fetch + certificado A1
//
// Quando uma integração for ativada, basta trocar a implementação injetada —
// nenhum código de UI precisa mudar.
//
// Status:
//   🔲 PLANEJADO    — interface definida, sem implementação real ainda
//   🟡 EM PROGRESSO — integração parcialmente implementada
//   ✅ ATIVO        — integração em produção
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tipos compartilhados de integração
// ─────────────────────────────────────────────────────────────────────────────

export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";

export interface IntegrationMeta {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  lastSyncAt?: string; // ISO datetime
  errorMessage?: string;
}

export interface IntegrationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Certificado Digital A1
// Status: 🔲 PLANEJADO
// ─────────────────────────────────────────────────────────────────────────────

export interface CertificadoA1 {
  cnpj: string;
  titular: string;
  validadeInicio: string;
  validadeFim: string;
  pfxBase64?: string; // carregado em memória apenas durante a operação
}

export interface CertificadoA1Adapter {
  /**
   * Verifica se o certificado configurado para o CNPJ é válido.
   */
  verificar(cnpj: string): Promise<IntegrationResult<CertificadoA1>>;

  /**
   * Retorna o número de dias restantes de validade. Negativo = vencido.
   */
  diasRestantes(cnpj: string): Promise<number>;

  /**
   * Assina um payload XML com o certificado A1 (usado para NF-e, eSocial etc.)
   * NOTA: em produção, nunca armazenar o PFX — carregue, use e descarte.
   */
  assinar(cnpj: string, xmlPayload: string): Promise<IntegrationResult<string>>;
}

/** Stub — retorna dados simulados */
export class MockCertificadoA1Adapter implements CertificadoA1Adapter {
  async verificar(cnpj: string): Promise<IntegrationResult<CertificadoA1>> {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        cnpj,
        titular: "Mock Titular Ltda",
        validadeInicio: "2024-07-01",
        validadeFim: "2026-07-05",
      },
    };
  }
  async diasRestantes(_cnpj: string): Promise<number> {
    return 17; // simulado
  }
  async assinar(_cnpj: string, xmlPayload: string): Promise<IntegrationResult<string>> {
    return { success: true, timestamp: new Date().toISOString(), data: `<SignedXML>${xmlPayload}</SignedXML>` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Receita Federal / e-CAC
// Status: 🔲 PLANEJADO
// Futuras APIs: Consulta CNPJ, situação cadastral, certidões, PGDAS, DCTF.
// ─────────────────────────────────────────────────────────────────────────────

export interface SituacaoCadastralRFB {
  cnpj: string;
  razaoSocial: string;
  situacao: "ATIVA" | "SUSPENSA" | "INAPTA" | "BAIXADA" | "NULA";
  dataAbertura: string;
  naturezaJuridica: string;
  optanteSimples: boolean;
  optanteMEI: boolean;
}

export interface ReceitaFederalAdapter {
  /**
   * Consulta a situação cadastral de um CNPJ na Receita Federal.
   */
  consultarCNPJ(cnpj: string): Promise<IntegrationResult<SituacaoCadastralRFB>>;

  /**
   * Emite certidão negativa de débitos (CND) via e-CAC.
   * Requer Certificado A1 válido.
   */
  emitirCND(cnpj: string, certificado: CertificadoA1): Promise<IntegrationResult<string>>;

  /**
   * Busca pendências e declarações em atraso no e-CAC.
   */
  consultarPendencias(cnpj: string): Promise<IntegrationResult<string[]>>;
}

export class MockReceitaFederalAdapter implements ReceitaFederalAdapter {
  async consultarCNPJ(cnpj: string): Promise<IntegrationResult<SituacaoCadastralRFB>> {
    return {
      success: true, timestamp: new Date().toISOString(),
      data: {
        cnpj, razaoSocial: "Empresa Mock Ltda", situacao: "ATIVA",
        dataAbertura: "2018-01-01", naturezaJuridica: "2062 – Sociedade Empresária Limitada",
        optanteSimples: true, optanteMEI: false,
      },
    };
  }
  async emitirCND(_cnpj: string, _cert: CertificadoA1): Promise<IntegrationResult<string>> {
    return { success: true, timestamp: new Date().toISOString(), data: "MOCK-CND-2026-OK" };
  }
  async consultarPendencias(_cnpj: string): Promise<IntegrationResult<string[]>> {
    return { success: true, timestamp: new Date().toISOString(), data: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. eSocial
// Status: 🔲 PLANEJADO
// Eventos: S-1000 (empregador), S-2200 (admissão), S-2206 (alteração),
//          S-2230 (afastamento), S-2299 (desligamento), S-1200 (remuneração)
// ─────────────────────────────────────────────────────────────────────────────

export type ESocialEventType =
  | "S-1000" | "S-1005" | "S-1010" | "S-1200" | "S-1210"
  | "S-2200" | "S-2205" | "S-2206" | "S-2230" | "S-2299"
  | "S-5001" | "S-5002";

export interface ESocialEvent {
  tipo: ESocialEventType;
  cnpj: string;
  competencia: string;    // YYYY-MM
  payload: Record<string, unknown>; // estrutura específica por evento
}

export interface ESocialReceipt {
  protocolo: string;
  dataTransmissao: string;
  status: "Aceito" | "Rejeitado" | "Em Processamento";
  erros?: Array<{ codigo: string; descricao: string }>;
}

export interface ESocialAdapter {
  /**
   * Transmite um evento ao ambiente do eSocial.
   * Assina automaticamente com o certificado A1 do CNPJ.
   */
  transmitir(evento: ESocialEvent, certificado: CertificadoA1): Promise<IntegrationResult<ESocialReceipt>>;

  /**
   * Consulta o status de um evento já transmitido pelo protocolo.
   */
  consultarStatus(protocolo: string): Promise<IntegrationResult<ESocialReceipt>>;

  /**
   * Retorna os eventos pendentes de transmissão para um CNPJ/competência.
   */
  eventosPendentes(cnpj: string, competencia: string): Promise<IntegrationResult<ESocialEvent[]>>;
}

export class MockESocialAdapter implements ESocialAdapter {
  async transmitir(evento: ESocialEvent, _cert: CertificadoA1): Promise<IntegrationResult<ESocialReceipt>> {
    return {
      success: true, timestamp: new Date().toISOString(),
      data: {
        protocolo: `REC-MOCK-${Date.now()}`,
        dataTransmissao: new Date().toISOString(),
        status: "Aceito",
      },
    };
  }
  async consultarStatus(protocolo: string): Promise<IntegrationResult<ESocialReceipt>> {
    return {
      success: true, timestamp: new Date().toISOString(),
      data: { protocolo, dataTransmissao: new Date().toISOString(), status: "Aceito" },
    };
  }
  async eventosPendentes(_cnpj: string, _competencia: string): Promise<IntegrationResult<ESocialEvent[]>> {
    return { success: true, timestamp: new Date().toISOString(), data: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FGTS Digital
// Status: 🔲 PLANEJADO
// Integração com o sistema FGTS Digital da CAIXA/MTE para geração e
// pagamento de guias (GRRF, DARF-FGTS, extrato FGTS).
// ─────────────────────────────────────────────────────────────────────────────

export interface FGTSGuia {
  cnpj: string;
  competencia: string;    // MM/YYYY
  valorTotal: number;
  codigoBarras?: string;
  dataVencimento: string;
  status: "Pendente" | "Paga" | "Vencida";
}

export interface FGTSDigitalAdapter {
  /**
   * Gera a guia de recolhimento do FGTS para a competência informada.
   */
  gerarGuia(cnpj: string, competencia: string, certificado: CertificadoA1): Promise<IntegrationResult<FGTSGuia>>;

  /**
   * Consulta o status de pagamento de uma guia já gerada.
   */
  consultarStatus(cnpj: string, competencia: string): Promise<IntegrationResult<FGTSGuia>>;

  /**
   * Extrato do FGTS dos trabalhadores vinculados ao CNPJ.
   */
  extratoTrabalhadores(cnpj: string): Promise<IntegrationResult<Array<{ nome: string; cpf: string; saldo: number }>>>;
}

export class MockFGTSDigitalAdapter implements FGTSDigitalAdapter {
  async gerarGuia(cnpj: string, competencia: string, _cert: CertificadoA1): Promise<IntegrationResult<FGTSGuia>> {
    return {
      success: true, timestamp: new Date().toISOString(),
      data: {
        cnpj, competencia, valorTotal: 1240.00,
        codigoBarras: "85810000012-4 40560000000-0 00000000000-0 00000000000-0",
        dataVencimento: "2026-07-07", status: "Pendente",
      },
    };
  }
  async consultarStatus(cnpj: string, competencia: string): Promise<IntegrationResult<FGTSGuia>> {
    return {
      success: true, timestamp: new Date().toISOString(),
      data: { cnpj, competencia, valorTotal: 1240.00, dataVencimento: "2026-07-07", status: "Pendente" },
    };
  }
  async extratoTrabalhadores(_cnpj: string): Promise<IntegrationResult<Array<{ nome: string; cpf: string; saldo: number }>>> {
    return { success: true, timestamp: new Date().toISOString(), data: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Registry — acesso centralizado a todas as integrações
// ─────────────────────────────────────────────────────────────────────────────

export interface IntegrationRegistry {
  certificadoA1:   CertificadoA1Adapter;
  receitaFederal:  ReceitaFederalAdapter;
  esocial:         ESocialAdapter;
  fgtsDigital:     FGTSDigitalAdapter;
}

/**
 * Retorna a registry com implementações mock (padrão enquanto integrações reais não estão ativas).
 * Para ativar uma integração real, substitua apenas a implementação correspondente aqui.
 *
 * @example
 * // Ativar integração real do eSocial:
 * const registry = createIntegrationRegistry();
 * registry.esocial = new HttpESocialAdapter(apiKey, environment);
 */
export function createIntegrationRegistry(): IntegrationRegistry {
  return {
    certificadoA1:  new MockCertificadoA1Adapter(),
    receitaFederal: new MockReceitaFederalAdapter(),
    esocial:        new MockESocialAdapter(),
    fgtsDigital:    new MockFGTSDigitalAdapter(),
  };
}

// Instância singleton para uso em toda a aplicação
export const integrations = createIntegrationRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// 7. Status das integrações para exibição no painel
// ─────────────────────────────────────────────────────────────────────────────

export const integrationStatusList: IntegrationMeta[] = [
  {
    id: "receita-federal",
    name: "Receita Federal / e-CAC",
    description: "Consulta CNPJ, certidões, situação cadastral, PGDAS e DCTF via e-CAC.",
    status: "disconnected",
  },
  {
    id: "esocial",
    name: "eSocial",
    description: "Transmissão de eventos trabalhistas e previdenciários ao ambiente eSocial.",
    status: "disconnected",
  },
  {
    id: "fgts-digital",
    name: "FGTS Digital",
    description: "Geração e consulta de guias FGTS Digital via CAIXA/MTE.",
    status: "disconnected",
  },
  {
    id: "certificado-a1",
    name: "Certificado Digital A1",
    description: "Assinatura de documentos eletrônicos, NF-e, eSocial e e-CAC.",
    status: "pending",
  },
  {
    id: "sefaz-nfe",
    name: "SEFAZ – NF-e / NFS-e",
    description: "Emissão, cancelamento e consulta de notas fiscais via SEFAZ estadual e prefeitura.",
    status: "disconnected",
  },
];
