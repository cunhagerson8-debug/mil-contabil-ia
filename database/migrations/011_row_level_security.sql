-- =============================================================================
-- 011_row_level_security.sql
-- MIL Contábil IA — Row Level Security (RLS)
-- =============================================================================
-- MODELO DE SESSÃO
-- A aplicação, no início de cada transação/request, executa:
--   SET LOCAL app.current_user_id  = '<uuid do usuário autenticado>';
--   SET LOCAL app.current_firm_id  = '<uuid do firm do usuário>';   -- NULL para platform_admin
--   SET LOCAL app.current_role     = '<role do usuário>';
-- Essas variáveis de sessão são lidas pelas policies abaixo via
-- current_setting(...). SET LOCAL garante que o valor não escapa da
-- transação atual (sem risco de "vazar" para outra request no mesmo
-- connection pool).
--
-- ROLES DE BANCO (Postgres roles, distintos de user_role/enum de aplicação):
--   mil_app          — role usado pela aplicação para tráfego normal de
--                       usuários (firm_owner, accountant, company_manager,
--                       company_user). Sujeito a TODAS as policies abaixo.
--   mil_platform_admin — role usado pelo painel administrativo da MIL e por
--                       jobs de billing/plataforma. BYPASSRLS — não filtra
--                       por firm_id, pois precisa de visão global.
--
-- PRINCÍPIO GERAL DAS POLICIES
--   * Tabelas com firm_id direto: policy compara firm_id = app.current_firm_id.
--   * Tabelas sem firm_id direto (ex: invoice_items): policy via EXISTS
--     contra a tabela pai, subindo até encontrar firm_id.
--   * Tabelas acessadas pelo Portal do Cliente (clients, portal_*): policy
--     adicional permite leitura quando o usuário tem vínculo em
--     user_company_access para a company do registro, MESMO que o
--     current_firm_id não bata 1:1 (cobre o caso futuro de um cliente com
--     acesso, via convite, a dados de mais de um firm — hoje não ocorre na
--     prática, mas a policy já é robusta a isso).
-- =============================================================================

CREATE ROLE mil_app NOLOGIN;
CREATE ROLE mil_platform_admin NOLOGIN BYPASSRLS;

-- -----------------------------------------------------------------------------
-- Funções helper — encapsulam a leitura das variáveis de sessão
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_firm_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_firm_id', true)::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_role() RETURNS text AS $$
  SELECT current_setting('app.current_role', true);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_user_has_company_access(p_company_id uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.user_id = app_current_user_id() AND uca.company_id = p_company_id
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION app_current_firm_id() IS 'Lê app.current_firm_id, setado pela aplicação via SET LOCAL no início da transação.';

-- -----------------------------------------------------------------------------
-- firms
-- -----------------------------------------------------------------------------
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;

-- Usuários só veem o próprio firm. platform_admin usa role com BYPASSRLS,
-- então não precisa de policy adicional para visão global.
CREATE POLICY firms_select_own ON firms
  FOR SELECT
  USING (id = app_current_firm_id());

CREATE POLICY firms_update_own_if_owner ON firms
  FOR UPDATE
  USING (id = app_current_firm_id() AND app_current_role() = 'firm_owner')
  WITH CHECK (id = app_current_firm_id() AND app_current_role() = 'firm_owner');

-- INSERT de novos firms é feito exclusivamente via mil_platform_admin
-- (fluxo de onboarding/vendas) — nenhuma policy de INSERT para mil_app.

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_same_firm ON users
  FOR SELECT
  USING (firm_id = app_current_firm_id());

CREATE POLICY users_insert_same_firm ON users
  FOR INSERT
  WITH CHECK (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner')          -- só firm_owner convida novos usuários
  );

CREATE POLICY users_update_same_firm_or_self ON users
  FOR UPDATE
  USING (
    firm_id = app_current_firm_id()
    AND (app_current_role() = 'firm_owner' OR id = app_current_user_id())
  )
  WITH CHECK (
    firm_id = app_current_firm_id()
    AND (app_current_role() = 'firm_owner' OR id = app_current_user_id())
  );

CREATE POLICY users_delete_same_firm_owner_only ON users
  FOR DELETE
  USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');

-- -----------------------------------------------------------------------------
-- user_company_access (sem firm_id direto — sobe via users)
-- -----------------------------------------------------------------------------
ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_company_access_same_firm ON user_company_access
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = user_company_access.user_id AND u.firm_id = app_current_firm_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = user_company_access.user_id AND u.firm_id = app_current_firm_id())
  );

-- -----------------------------------------------------------------------------
-- refresh_tokens — cada usuário só vê/revoga os próprios tokens
-- -----------------------------------------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_own_only ON refresh_tokens
  FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Equipe do escritório (firm_owner/accountant): vê todas as empresas do
-- firm, EXCETO se houver restrição explícita de carteira em
-- user_company_access (presença de QUALQUER linha para o usuário implica
-- carteira restrita às empresas listadas).
CREATE POLICY companies_select_firm_scoped ON companies
  FOR SELECT
  USING (
    firm_id = app_current_firm_id()
    AND (
      app_current_role() IN ('firm_owner', 'accountant')
      AND (
        NOT EXISTS (SELECT 1 FROM user_company_access uca WHERE uca.user_id = app_current_user_id())
        OR app_user_has_company_access(companies.id)
      )
      OR (
        app_current_role() IN ('company_manager', 'company_user')
        AND app_user_has_company_access(companies.id)
      )
    )
  );

CREATE POLICY companies_insert_firm_scoped ON companies
  FOR INSERT
  WITH CHECK (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'));

CREATE POLICY companies_update_firm_scoped ON companies
  FOR UPDATE
  USING (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'))
  WITH CHECK (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'));

CREATE POLICY companies_delete_firm_owner_only ON companies
  FOR DELETE
  USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');

-- -----------------------------------------------------------------------------
-- company_partners / digital_certificates (sem firm_id direto — sobem via companies)
-- -----------------------------------------------------------------------------
ALTER TABLE company_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_partners_via_company ON company_partners
  FOR ALL
  USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_partners.company_id AND c.firm_id = app_current_firm_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = company_partners.company_id AND c.firm_id = app_current_firm_id()));

-- Certificados A1: leitura permitida à equipe do escritório E aos usuários
-- do portal com acesso à company (precisam ver validade/expiração);
-- escrita restrita à equipe do escritório.
CREATE POLICY digital_certificates_select ON digital_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM companies c WHERE c.id = digital_certificates.company_id
      AND c.firm_id = app_current_firm_id()
      AND (app_current_role() IN ('firm_owner','accountant') OR app_user_has_company_access(c.id))
    )
  );

CREATE POLICY digital_certificates_write ON digital_certificates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM companies c WHERE c.id = digital_certificates.company_id AND c.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM companies c WHERE c.id = digital_certificates.company_id AND c.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  );

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON clients
  FOR SELECT
  USING (
    firm_id = app_current_firm_id()
    AND (
      app_current_role() IN ('firm_owner', 'accountant')
      OR (company_id IS NOT NULL AND app_user_has_company_access(company_id))
    )
  );

CREATE POLICY clients_write_staff_only ON clients
  FOR ALL
  USING (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'))
  WITH CHECK (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'));

-- -----------------------------------------------------------------------------
-- client_contacts / client_documents / client_history_entries (via clients)
-- -----------------------------------------------------------------------------
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_history_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_contacts_via_client ON client_contacts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM clients cl WHERE cl.id = client_contacts.client_id AND cl.firm_id = app_current_firm_id()
                 AND app_current_role() IN ('firm_owner', 'accountant')))
  WITH CHECK (EXISTS (SELECT 1 FROM clients cl WHERE cl.id = client_contacts.client_id AND cl.firm_id = app_current_firm_id()
                 AND app_current_role() IN ('firm_owner', 'accountant')));

CREATE POLICY client_documents_via_client ON client_documents
  FOR ALL
  USING (EXISTS (SELECT 1 FROM clients cl WHERE cl.id = client_documents.client_id AND cl.firm_id = app_current_firm_id()
                 AND app_current_role() IN ('firm_owner', 'accountant')))
  WITH CHECK (EXISTS (SELECT 1 FROM clients cl WHERE cl.id = client_documents.client_id AND cl.firm_id = app_current_firm_id()
                 AND app_current_role() IN ('firm_owner', 'accountant')));

CREATE POLICY client_history_via_client ON client_history_entries
  FOR ALL
  USING (EXISTS (SELECT 1 FROM clients cl WHERE cl.id = client_history_entries.client_id AND cl.firm_id = app_current_firm_id()
                 AND app_current_role() IN ('firm_owner', 'accountant')))
  WITH CHECK (EXISTS (SELECT 1 FROM clients cl WHERE cl.id = client_history_entries.client_id AND cl.firm_id = app_current_firm_id()
                 AND app_current_role() IN ('firm_owner', 'accountant')));

-- -----------------------------------------------------------------------------
-- tax_obligations
-- -----------------------------------------------------------------------------
ALTER TABLE tax_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_obligations_select ON tax_obligations
  FOR SELECT
  USING (
    firm_id = app_current_firm_id()
    AND (app_current_role() IN ('firm_owner', 'accountant') OR app_user_has_company_access(company_id))
  );

CREATE POLICY tax_obligations_write_staff_only ON tax_obligations
  FOR ALL
  USING (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'))
  WITH CHECK (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'));

-- -----------------------------------------------------------------------------
-- invoices
-- -----------------------------------------------------------------------------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select ON invoices
  FOR SELECT
  USING (
    firm_id = app_current_firm_id()
    AND (app_current_role() IN ('firm_owner', 'accountant') OR app_user_has_company_access(company_id))
  );

CREATE POLICY invoices_write_staff_only ON invoices
  FOR ALL
  USING (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'))
  WITH CHECK (firm_id = app_current_firm_id() AND app_current_role() IN ('firm_owner', 'accountant'));

-- -----------------------------------------------------------------------------
-- invoice_items (via invoices)
-- -----------------------------------------------------------------------------
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_select ON invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id
      AND i.firm_id = app_current_firm_id()
      AND (app_current_role() IN ('firm_owner', 'accountant') OR app_user_has_company_access(i.company_id))
    )
  );

CREATE POLICY invoice_items_write_staff_only ON invoice_items
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  );

-- -----------------------------------------------------------------------------
-- alerts
-- -----------------------------------------------------------------------------
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Alertas de sistema (company_id IS NULL) são visíveis a toda a equipe do
-- firm. Alertas de uma company específica seguem a mesma regra de acesso
-- usada nos demais módulos.
CREATE POLICY alerts_select ON alerts
  FOR SELECT
  USING (
    firm_id = app_current_firm_id()
    AND (
      company_id IS NULL
      OR app_current_role() IN ('firm_owner', 'accountant')
      OR app_user_has_company_access(company_id)
    )
  );

CREATE POLICY alerts_update_mark_read ON alerts
  FOR UPDATE
  USING (
    firm_id = app_current_firm_id()
    AND (
      company_id IS NULL
      OR app_current_role() IN ('firm_owner', 'accountant')
      OR app_user_has_company_access(company_id)
    )
  )
  WITH CHECK (firm_id = app_current_firm_id());

CREATE POLICY alerts_insert_system_or_staff ON alerts
  FOR INSERT
  WITH CHECK (firm_id = app_current_firm_id());

-- -----------------------------------------------------------------------------
-- portal_documents / portal_guides / portal_messages (via clients)
-- -----------------------------------------------------------------------------
ALTER TABLE portal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;

-- Leitura: equipe do escritório (qualquer cliente do firm) OU usuário do
-- portal com acesso à company vinculada ao client.
CREATE POLICY portal_documents_select ON portal_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients cl WHERE cl.id = portal_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND (
        app_current_role() IN ('firm_owner', 'accountant')
        OR (cl.company_id IS NOT NULL AND app_user_has_company_access(cl.company_id))
      )
    )
  );

CREATE POLICY portal_documents_write_staff_only ON portal_documents
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM clients cl WHERE cl.id = portal_documents.client_id AND cl.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM clients cl WHERE cl.id = portal_documents.client_id AND cl.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  );

CREATE POLICY portal_guides_select ON portal_guides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients cl WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND (
        app_current_role() IN ('firm_owner', 'accountant')
        OR (cl.company_id IS NOT NULL AND app_user_has_company_access(cl.company_id))
      )
    )
  );

-- Cliente do portal pode marcar a própria guia como vista/processada, mas
-- não criar/excluir guias — apenas o UPDATE do campo `pago` é permitido
-- na prática pela aplicação (a policy de banco autoriza o UPDATE da linha;
-- a restrição de "só o campo pago" é reforçada na camada de aplicação/API,
-- já que RLS não faz column-level granularity nativamente sem trigger extra).
CREATE POLICY portal_guides_update_by_client ON portal_guides
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients cl WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND (cl.company_id IS NOT NULL AND app_user_has_company_access(cl.company_id))
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM clients cl WHERE cl.id = portal_guides.client_id AND cl.firm_id = app_current_firm_id())
  );

CREATE POLICY portal_guides_write_staff_only ON portal_guides
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM clients cl WHERE cl.id = portal_guides.client_id AND cl.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM clients cl WHERE cl.id = portal_guides.client_id AND cl.firm_id = app_current_firm_id())
    AND app_current_role() IN ('firm_owner', 'accountant')
  );

-- Mensagens: ambos os lados (cliente e escritório) podem ler e escrever —
-- é o próprio propósito do canal. A escrita exige que o remetente
-- declarado corresponda ao papel do usuário autenticado.
CREATE POLICY portal_messages_select ON portal_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients cl WHERE cl.id = portal_messages.client_id
      AND cl.firm_id = app_current_firm_id()
      AND (
        app_current_role() IN ('firm_owner', 'accountant')
        OR (cl.company_id IS NOT NULL AND app_user_has_company_access(cl.company_id))
      )
    )
  );

CREATE POLICY portal_messages_insert ON portal_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients cl WHERE cl.id = portal_messages.client_id
      AND cl.firm_id = app_current_firm_id()
      AND (
        (app_current_role() IN ('firm_owner', 'accountant') AND portal_messages.remetente = 'escritorio')
        OR (cl.company_id IS NOT NULL AND app_user_has_company_access(cl.company_id) AND portal_messages.remetente = 'cliente')
      )
    )
  );

-- -----------------------------------------------------------------------------
-- plans — catálogo público de leitura (sem isolamento por firm)
-- -----------------------------------------------------------------------------
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_all_active ON plans
  FOR SELECT
  USING (is_active = true);
-- INSERT/UPDATE/DELETE de planos: apenas mil_platform_admin (BYPASSRLS), sem policy para mil_app.

-- -----------------------------------------------------------------------------
-- subscriptions / platform_invoices / usage_counters
-- -----------------------------------------------------------------------------
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- Apenas firm_owner vê billing do próprio firm (accountant não precisa ver
-- quanto o escritório paga à plataforma).
CREATE POLICY subscriptions_select_owner_only ON subscriptions
  FOR SELECT
  USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');

CREATE POLICY platform_invoices_select_owner_only ON platform_invoices
  FOR SELECT
  USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');

CREATE POLICY usage_counters_select_owner_only ON usage_counters
  FOR SELECT
  USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');
-- escrita nessas três tabelas é feita exclusivamente por mil_platform_admin / jobs internos.

-- -----------------------------------------------------------------------------
-- audit_logs — leitura restrita a firm_owner do próprio firm
-- -----------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_owner_only ON audit_logs
  FOR SELECT
  USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');
-- INSERT é feito exclusivamente pelas funções de trigger (audit_trigger_fn,
-- audit_users_trigger_fn), que rodam com privilégios do owner da função
-- (SECURITY DEFINER não usado aqui de propósito — roda como o caller, e o
-- caller mil_app tem GRANT INSERT explícito, ver 012 para grants finais).

-- -----------------------------------------------------------------------------
-- GRANTS — privilégios de tabela para o role mil_app
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  firms, users, user_company_access, refresh_tokens,
  companies, company_partners, digital_certificates,
  clients, client_contacts, client_documents, client_history_entries,
  tax_obligations,
  invoices, invoice_items,
  alerts,
  portal_documents, portal_guides, portal_messages,
  subscriptions, platform_invoices, usage_counters
TO mil_app;

GRANT SELECT ON plans TO mil_app;
GRANT SELECT, INSERT ON audit_logs TO mil_app;  -- sem UPDATE/DELETE: log é append-only para mil_app

GRANT ALL ON ALL TABLES IN SCHEMA public TO mil_platform_admin;
