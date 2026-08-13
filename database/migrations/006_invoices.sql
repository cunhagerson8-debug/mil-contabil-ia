-- =============================================================================
-- 006_invoices.sql
-- MIL Contábil IA — Módulo Emissão de Notas
-- Espelha modules/notas-fiscais/types.ts (Invoice, InvoiceItem)
-- =============================================================================
-- Nota de modelagem: `impostos` no frontend é um objeto livre
-- { iss?, pis?, cofins?, csll?, irrf? }. Modelamos como colunas numéricas
-- nullable em vez de jsonb porque são valores fiscais que entram em
-- relatórios agregados (SUM, filtros) com frequência — colunas tipadas dão
-- index e CHECK constraints; jsonb exigiria casting em toda query agregada.
-- =============================================================================

CREATE TABLE invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  numero                text NOT NULL,
  tipo                  invoice_type NOT NULL,
  status                invoice_status NOT NULL DEFAULT 'pendente',
  data_emissao          date NOT NULL DEFAULT CURRENT_DATE,
  tomador                text NOT NULL,         -- razão social / nome do destinatário
  tomador_doc            text NOT NULL,         -- CPF ou CNPJ do tomador
  valor_total            numeric(14,2) NOT NULL CHECK (valor_total >= 0),
  -- impostos (todos opcionais, espelhando Invoice['impostos'])
  iss                    numeric(14,2),
  pis                    numeric(14,2),
  cofins                 numeric(14,2),
  csll                   numeric(14,2),
  irrf                   numeric(14,2),
  chave_acesso           text,                  -- chave de 44 dígitos NF-e / protocolo NFS-e
  xml_storage_key        text,                  -- referência ao XML no storage externo, não o XML em si
  pdf_storage_key        text,                  -- referência ao PDF/DANFE no storage externo
  motivo_cancelamento    text,
  issued_by              uuid REFERENCES users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_invoices_numero_per_company UNIQUE (company_id, tipo, numero),
  CONSTRAINT chk_invoice_cancelamento
    CHECK (status != 'cancelada' OR motivo_cancelamento IS NOT NULL)
);

CREATE INDEX idx_invoices_firm ON invoices(firm_id);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_status ON invoices(firm_id, status);
CREATE INDEX idx_invoices_data_emissao ON invoices(data_emissao);
CREATE INDEX idx_invoices_tomador_trgm ON invoices USING gin (tomador gin_trgm_ops);
CREATE INDEX idx_invoices_chave_acesso ON invoices(chave_acesso) WHERE chave_acesso IS NOT NULL;

COMMENT ON TABLE invoices IS 'NFS-e, NF-e, NFC-e emitidas. XML e PDF residem em storage externo (S3/GCS); aqui apenas as referências.';

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- invoice_items
-- -----------------------------------------------------------------------------
CREATE TABLE invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  descricao       text NOT NULL,
  quantidade      numeric(12,3) NOT NULL CHECK (quantidade > 0),
  valor_unitario  numeric(14,2) NOT NULL CHECK (valor_unitario >= 0),
  valor_total     numeric(14,2) NOT NULL CHECK (valor_total >= 0),
  ordem           smallint NOT NULL DEFAULT 0,  -- preserva a ordem de exibição dos itens na nota
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id, ordem);

COMMENT ON TABLE invoice_items IS 'Itens (produtos/serviços) de cada nota fiscal.';

-- -----------------------------------------------------------------------------
-- Garante que valor_total da invoice é consistente com a soma dos itens.
-- Validação leve via trigger — não bloqueia a escrita do item, apenas avisa
-- via NOTICE; a reconciliação definitiva acontece na camada de aplicação ao
-- emitir a nota (soma dos itens é calculada antes do INSERT da invoice).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_invoice_items_total()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total numeric(14,2);
  v_items_total numeric(14,2);
BEGIN
  SELECT valor_total INTO v_invoice_total FROM invoices WHERE id = NEW.invoice_id;
  SELECT COALESCE(SUM(valor_total), 0) INTO v_items_total FROM invoice_items WHERE invoice_id = NEW.invoice_id;

  IF v_invoice_total IS NOT NULL AND v_items_total != v_invoice_total THEN
    RAISE NOTICE 'invoice % : soma dos itens (%) difere do valor_total da nota (%)',
      NEW.invoice_id, v_items_total, v_invoice_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_items_check_total AFTER INSERT OR UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION check_invoice_items_total();
