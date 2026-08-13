-- =============================================================================
-- 004_clients.sql
-- MIL Contábil IA — Módulo Clientes
-- Espelha modules/clientes/types.ts (Client, ClientContact, ClientDocument,
-- ClientHistoryEntry)
-- =============================================================================
-- Nota de modelagem: Client e Company são entidades distintas de propósito.
-- `companies` é o cadastro fiscal/tributário formal (CNAE, regime, sócios).
-- `clients` é o relacionamento comercial do escritório (contatos, histórico
-- de atendimento, documentos do relacionamento). Um client PODE apontar para
-- uma company (quando o cliente é uma PJ já cadastrada no módulo Empresas),
-- mas também existe sem company_id (ex: pessoa física, ou prospecto que
-- ainda não abriu CNPJ) — company_id é nullable, espelhando o `companyId?`
-- opcional do types.ts original.
-- =============================================================================

CREATE TABLE clients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  company_id          uuid REFERENCES companies(id) ON DELETE SET NULL, -- opcional
  nome                text NOT NULL,
  tipo                tipo_cliente NOT NULL,
  documento           text NOT NULL,            -- CPF ou CNPJ, sem formatação fixa (validado na aplicação)
  status              status_cliente NOT NULL DEFAULT 'prospecto',
  data_cadastro       date NOT NULL DEFAULT CURRENT_DATE,
  servicos_contratados text[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT uq_clients_documento_per_firm UNIQUE (firm_id, documento)
);

CREATE INDEX idx_clients_firm_id ON clients(firm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_company_id ON clients(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_status ON clients(firm_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_nome_trgm ON clients USING gin (nome gin_trgm_ops);
CREATE INDEX idx_clients_documento_trgm ON clients USING gin (documento gin_trgm_ops);

COMMENT ON TABLE clients IS 'Relacionamento comercial do escritório com o cliente (PF ou PJ). Distinto de companies: company_id é opcional.';

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- client_contacts
-- -----------------------------------------------------------------------------
CREATE TABLE client_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  cargo           text,
  email           citext,
  telefone        text,
  principal       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- No máximo um contato principal por cliente
CREATE UNIQUE INDEX uq_client_contacts_principal
  ON client_contacts(client_id) WHERE principal = true;

CREATE INDEX idx_client_contacts_client ON client_contacts(client_id);

CREATE TRIGGER trg_client_contacts_updated_at BEFORE UPDATE ON client_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- client_documents
-- -----------------------------------------------------------------------------
CREATE TABLE client_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  tipo            tipo_documento_cliente NOT NULL,
  storage_key     text NOT NULL,        -- referência ao objeto no storage (S3/GCS), não o arquivo em si
  tamanho_bytes   bigint,
  data_upload     timestamptz NOT NULL DEFAULT now(),
  validade        date,
  uploaded_by     uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_documents_client ON client_documents(client_id);
CREATE INDEX idx_client_documents_validade ON client_documents(validade) WHERE validade IS NOT NULL;

COMMENT ON COLUMN client_documents.storage_key IS 'Chave do objeto no bucket de storage (S3/GCS). O arquivo binário nunca é armazenado no Postgres.';

-- -----------------------------------------------------------------------------
-- client_history_entries
-- -----------------------------------------------------------------------------
CREATE TABLE client_history_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tipo            tipo_historico_cliente NOT NULL,
  descricao       text NOT NULL,
  responsavel_id  uuid REFERENCES users(id),
  data            timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_history_client ON client_history_entries(client_id, data DESC);
