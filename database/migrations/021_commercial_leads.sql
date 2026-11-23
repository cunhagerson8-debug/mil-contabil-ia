CREATE TABLE commercial_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp_e164 text NOT NULL,
  email citext,
  service_interest text NOT NULL,
  voluntary_details text,
  consented_at timestamptz NOT NULL,
  consent_version text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'mila',
  last_contacted_at timestamptz,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_commercial_leads_whatsapp UNIQUE (whatsapp_e164),
  CONSTRAINT chk_commercial_leads_name_length CHECK (length(name) BETWEEN 2 AND 120),
  CONSTRAINT chk_commercial_leads_whatsapp_e164 CHECK (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT chk_commercial_leads_email_length CHECK (email IS NULL OR length(email::text) <= 254),
  CONSTRAINT chk_commercial_leads_details_length CHECK (
    voluntary_details IS NULL OR length(voluntary_details) <= 500
  ),
  CONSTRAINT chk_commercial_leads_service_interest CHECK (
    service_interest IN ('software_subscription', 'accounting_services', 'both', 'undecided')
  ),
  CONSTRAINT chk_commercial_leads_status CHECK (
    status IN ('new', 'contacting', 'qualified', 'converted', 'closed')
  ),
  CONSTRAINT chk_commercial_leads_source CHECK (source = 'mila'),
  CONSTRAINT chk_commercial_leads_consent_version CHECK (length(consent_version) BETWEEN 1 AND 80)
);

CREATE INDEX idx_commercial_leads_status_created
  ON commercial_leads(status, created_at DESC);

CREATE INDEX idx_commercial_leads_name
  ON commercial_leads USING gin (name gin_trgm_ops);

ALTER TABLE commercial_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_leads FORCE ROW LEVEL SECURITY;

CREATE POLICY commercial_leads_public_insert
  ON commercial_leads
  FOR INSERT
  TO mil_app
  WITH CHECK (
    source = 'mila'
    AND consented_at IS NOT NULL
    AND consent_version <> ''
  );

GRANT INSERT (
  name, whatsapp_e164, email, service_interest, voluntary_details,
  consented_at, consent_version, source
) ON commercial_leads TO mil_app;

GRANT SELECT, UPDATE ON commercial_leads TO mil_platform_admin;

COMMENT ON TABLE commercial_leads IS
  'Leads comerciais da MIL captados pela Mila, separados dos clientes contábeis por escritório.';
