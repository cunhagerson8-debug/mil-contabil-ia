-- =============================================================================
-- 003_companies.sql
-- MIL Contábil IA — Módulo Empresas
-- Espelha modules/empresas/types.ts (Company, Socio)
-- =============================================================================

CREATE TABLE companies (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                 uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  razao_social            text NOT NULL,
  nome_fantasia           text NOT NULL,
  cnpj                    text NOT NULL,
  cnae                    text NOT NULL,
  cnae_descricao          text,
  regime                  regime_tributario NOT NULL,
  responsavel             text NOT NULL,            -- nome do responsável pela empresa-cliente
  contador_responsavel_id uuid REFERENCES users(id), -- FK para o contador do escritório responsável
  status                  status_empresa NOT NULL DEFAULT 'ativa',
  data_abertura           date NOT NULL,
  email                   citext,
  telefone                text,
  endereco                text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,

  CONSTRAINT uq_companies_cnpj_per_firm UNIQUE (firm_id, cnpj)
);

CREATE INDEX idx_companies_firm_id ON companies(firm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_status ON companies(firm_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_cnpj_trgm ON companies USING gin (cnpj gin_trgm_ops);
CREATE INDEX idx_companies_nome_trgm ON companies USING gin (nome_fantasia gin_trgm_ops, razao_social gin_trgm_ops);

COMMENT ON TABLE companies IS 'Empresas-clientes atendidas por um escritório contábil (firm). Âncora do company_id usado nos demais módulos.';

CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Agora que companies existe, fecha a FK pendente de user_company_access (criada em 002)
ALTER TABLE user_company_access
  ADD CONSTRAINT fk_user_company_access_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- company_partners — Quadro societário (Socio)
-- -----------------------------------------------------------------------------
CREATE TABLE company_partners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  cpf             text NOT NULL,
  participacao    numeric(5,2) NOT NULL CHECK (participacao >= 0 AND participacao <= 100),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_partners_company ON company_partners(company_id);

COMMENT ON TABLE company_partners IS 'Quadro societário de cada empresa-cliente.';

CREATE TRIGGER trg_company_partners_updated_at BEFORE UPDATE ON company_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- digital_certificates — Certificado Digital A1
-- -----------------------------------------------------------------------------
-- O arquivo .pfx NUNCA é armazenado no banco. Apenas metadados de validade e
-- a referência ao cofre externo (KMS/HSM/Vault) onde o material criptográfico
-- reside. Isso é coerente com architecture/integrations.ts (CertificadoA1Adapter)
-- no frontend, que já trata o PFX como efêmero/carregado em memória.
CREATE TABLE digital_certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  titular             text NOT NULL,
  cnpj                text NOT NULL,
  vault_reference     text NOT NULL,        -- identificador no cofre externo (ex: ARN do KMS, path do Vault)
  valid_from          date NOT NULL,
  valid_until         date NOT NULL,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_digital_certificates_company ON digital_certificates(company_id);
CREATE INDEX idx_digital_certificates_validity ON digital_certificates(valid_until) WHERE revoked_at IS NULL;

COMMENT ON TABLE digital_certificates IS 'Metadados de validade do Certificado Digital A1. O material criptográfico (.pfx) nunca é persistido aqui — vault_reference aponta para um cofre externo (KMS/HSM/Vault).';

CREATE TRIGGER trg_digital_certificates_updated_at BEFORE UPDATE ON digital_certificates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
