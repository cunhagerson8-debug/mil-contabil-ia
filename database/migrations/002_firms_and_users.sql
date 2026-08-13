-- =============================================================================
-- 002_firms_and_users.sql
-- MIL Contábil IA — Tenant raiz (escritórios contábeis) e modelo de usuários
-- =============================================================================
-- Modelo de autenticação:
--   * A tabela `firms` é o tenant raiz da plataforma SaaS. Um "firm" é o
--     escritório contábil cliente da MIL Contábil IA (ex: "Ferreira & Souza
--     Contabilidade"). Todo dado de negócio pertence, em última instância, a
--     um firm_id.
--   * `users` cobre TODOS os tipos de usuário do sistema — equipe da MIL,
--     equipe do escritório e usuários do portal do cliente — diferenciados
--     pela coluna `role`. Isso evita duas tabelas paralelas (staff vs.
--     portal) e simplifica auth: um único fluxo de login para todos.
--   * platform_admin: firm_id é NULL (não pertence a nenhum escritório —
--     acesso de plataforma, equipe da MIL Gestão & Tecnologia).
--   * firm_owner / accountant: firm_id obrigatório, company_id NULL (acesso
--     a todas as empresas do escritório, sujeito a `user_company_access`).
--   * company_manager / company_user: firm_id obrigatório + vínculo via
--     `user_company_access` às empresas específicas que podem acessar no
--     Portal do Cliente.
--   * Senhas NUNCA são armazenadas em texto puro — apenas o hash (bcrypt/
--     argon2, calculado na aplicação) é persistido em `password_hash`.
--   * Suporte nativo a MFA (TOTP) e a login social/SSO via `auth_provider`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- firms — tenant raiz (escritórios contábeis)
-- -----------------------------------------------------------------------------
CREATE TABLE firms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,                  -- razão social do escritório
  trade_name          text,                           -- nome fantasia
  cnpj                text NOT NULL UNIQUE,
  status              firm_status NOT NULL DEFAULT 'trial',
  email               citext NOT NULL,
  phone               text,
  logo_url            text,
  primary_color        text,                           -- whitelabel: cor da marca do escritório
  timezone            text NOT NULL DEFAULT 'America/Sao_Paulo',
  trial_ends_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz                      -- soft delete: preserva histórico de billing/auditoria
);

CREATE INDEX idx_firms_status ON firms(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_firms_cnpj_trgm ON firms USING gin (cnpj gin_trgm_ops);

COMMENT ON TABLE firms IS 'Tenant raiz: escritório contábil cliente da plataforma MIL Contábil IA.';

-- -----------------------------------------------------------------------------
-- users — todos os usuários do sistema (staff da MIL, do escritório, e portal)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             uuid REFERENCES firms(id) ON DELETE CASCADE,  -- NULL apenas para platform_admin
  role                user_role NOT NULL,
  status              user_status NOT NULL DEFAULT 'invited',
  full_name           text NOT NULL,
  email               citext NOT NULL,
  phone               text,
  password_hash       text,                            -- NULL se auth_provider != 'password'
  auth_provider       text NOT NULL DEFAULT 'password', -- 'password' | 'google' | 'microsoft' | 'saml'
  auth_provider_id    text,                             -- id externo do provedor SSO/social
  mfa_enabled         boolean NOT NULL DEFAULT false,
  mfa_secret          text,                              -- TOTP secret, cifrado na aplicação antes de persistir
  avatar_url          text,
  last_login_at       timestamptz,
  invited_by          uuid REFERENCES users(id),
  invited_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT chk_platform_admin_no_firm
    CHECK ( (role = 'platform_admin' AND firm_id IS NULL) OR (role != 'platform_admin' AND firm_id IS NOT NULL) ),
  CONSTRAINT chk_password_or_sso
    CHECK ( (auth_provider = 'password' AND password_hash IS NOT NULL) OR (auth_provider != 'password') )
);

-- E-mail único por escritório (mesmo e-mail pode existir em escritórios diferentes,
-- ex: contador que atende dois escritórios com contas distintas) — e único globalmente
-- entre platform_admins (firm_id IS NULL).
CREATE UNIQUE INDEX uq_users_email_per_firm ON users(firm_id, email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_platform_admin_email ON users(email) WHERE firm_id IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_users_firm_id ON users(firm_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);

COMMENT ON TABLE users IS 'Todos os usuários da plataforma: equipe MIL, equipe do escritório e usuários do portal do cliente, diferenciados por role.';
COMMENT ON COLUMN users.firm_id IS 'NULL apenas para platform_admin. Obrigatório para os demais roles.';

-- -----------------------------------------------------------------------------
-- user_company_access — vínculo granular usuário ⇄ empresa
-- -----------------------------------------------------------------------------
-- Para firm_owner/accountant: linha opcional aqui restringe a carteira de
-- empresas visíveis (se não houver nenhuma linha, assume-se acesso a todas
-- as empresas do firm — ver policy RLS correspondente).
-- Para company_manager/company_user: linha aqui é OBRIGATÓRIA — define
-- exatamente quais empresas o usuário do portal pode acessar.
CREATE TABLE user_company_access (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id          uuid NOT NULL,  -- FK adicionada em 003_companies.sql (ordem de criação)
  can_manage          boolean NOT NULL DEFAULT false, -- true para company_manager-like permissions nesta empresa
  granted_by          uuid REFERENCES users(id),
  granted_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, company_id)
);

CREATE INDEX idx_user_company_access_user ON user_company_access(user_id);
CREATE INDEX idx_user_company_access_company ON user_company_access(company_id);

COMMENT ON TABLE user_company_access IS 'Define quais empresas um usuário do portal (ou contador com carteira restrita) pode acessar.';

-- -----------------------------------------------------------------------------
-- refresh_tokens — sessões de longa duração (JWT refresh)
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          text NOT NULL UNIQUE,   -- hash do token, nunca o token em claro
  user_agent          text,
  ip_address          inet,
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expiry ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_firms_updated_at BEFORE UPDATE ON firms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
