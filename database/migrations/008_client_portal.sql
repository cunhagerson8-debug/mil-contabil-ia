-- =============================================================================
-- 008_client_portal.sql
-- MIL Contábil IA — Portal do Cliente
-- Espelha modules/portal-cliente/types.ts (PortalDocument, PortalMessage, PortalGuide)
-- =============================================================================
-- Nota de modelagem: no frontend, PortalDocument/PortalGuide/PortalMessage
-- referenciam clientId (não companyId) — o Portal do Cliente é organizado
-- pela ótica de "Cliente" (relacionamento comercial), não da empresa fiscal
-- formal. Mantemos essa referência para clients(id), consistente com 004.
-- =============================================================================

CREATE TABLE portal_documents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome                    text NOT NULL,
  categoria               portal_document_category NOT NULL,
  storage_key             text NOT NULL,
  tamanho_bytes           bigint,
  data_disponibilizacao   timestamptz NOT NULL DEFAULT now(),
  validade                date,
  uploaded_by             uuid REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_documents_client ON portal_documents(client_id, data_disponibilizacao DESC);
CREATE INDEX idx_portal_documents_validade ON portal_documents(validade) WHERE validade IS NOT NULL;

COMMENT ON TABLE portal_documents IS 'Relatórios, certidões, contratos e demais documentos disponibilizados ao cliente no portal.';

-- -----------------------------------------------------------------------------
-- portal_guides — guias para pagamento (DAS, DARF, GRF, DCTFWeb...)
-- -----------------------------------------------------------------------------
CREATE TABLE portal_guides (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- vínculo opcional com a obrigação fiscal de origem, quando a guia foi
  -- gerada a partir de uma tax_obligation (permite navegar guia -> obrigação)
  tax_obligation_id       uuid REFERENCES tax_obligations(id) ON DELETE SET NULL,
  titulo                  text NOT NULL,
  descricao               text,
  tipo                    portal_guide_type NOT NULL,
  valor                   numeric(14,2) NOT NULL CHECK (valor >= 0),
  vencimento              date NOT NULL,
  codigo_barras           text,
  pago                    boolean NOT NULL DEFAULT false,
  paid_at                 timestamptz,
  data_disponibilizacao   timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_guides_client ON portal_guides(client_id, vencimento);
CREATE INDEX idx_portal_guides_pendentes ON portal_guides(client_id, pago) WHERE pago = false;

COMMENT ON TABLE portal_guides IS 'Guias de pagamento (DAS, DARF, GRF, DCTFWeb) disponibilizadas ao cliente para download e pagamento.';

CREATE TRIGGER trg_portal_guides_updated_at BEFORE UPDATE ON portal_guides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- portal_messages — mensageria cliente ⇄ escritório
-- -----------------------------------------------------------------------------
CREATE TABLE portal_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  assunto         text NOT NULL,
  corpo           text NOT NULL,
  remetente       portal_message_sender NOT NULL,
  -- autor real (necessário para auditoria e RLS — diferencia qual usuário do
  -- portal ou qual contador do escritório efetivamente escreveu a mensagem)
  sender_user_id  uuid REFERENCES users(id),
  status          portal_message_status NOT NULL DEFAULT 'enviada',
  resposta_id     uuid REFERENCES portal_messages(id) ON DELETE SET NULL,
  data            timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_messages_client ON portal_messages(client_id, data);
CREATE INDEX idx_portal_messages_aguardando ON portal_messages(client_id, status) WHERE status = 'aguardando';
CREATE INDEX idx_portal_messages_resposta ON portal_messages(resposta_id) WHERE resposta_id IS NOT NULL;

COMMENT ON TABLE portal_messages IS 'Mensageria bidirecional entre cliente (via portal) e escritório contábil.';
