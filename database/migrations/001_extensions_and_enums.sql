-- =============================================================================
-- 001_extensions_and_enums.sql
-- MIL Contábil IA — Extensões e tipos enumerados compartilhados
-- =============================================================================
-- Convenções do projeto:
--   * Toda tabela usa UUID como chave primária (gen_random_uuid()).
--   * Datas/horas em timestamptz; "apenas data" (ex: vencimento) em date.
--   * Nomes de tabela e coluna em snake_case, inglês — mantém o schema
--     reutilizável fora do contexto pt-BR caso a MIL expanda regionalmente.
--   * Os enums abaixo espelham exatamente os union types já usados em
--     modules/*/types.ts no frontend, para que o mapeamento ORM seja 1:1.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), criptografia de campos sensíveis
CREATE EXTENSION IF NOT EXISTS "citext";     -- e-mails case-insensitive
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca textual (nome, razão social, CNPJ parcial)

-- -----------------------------------------------------------------------------
-- Plataforma / Tenancy / Auth
-- -----------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'platform_admin',         -- equipe MIL Gestão & Tecnologia — acesso global
  'firm_owner',              -- dono/sócio do escritório contábil (tenant admin)
  'accountant',              -- contador do escritório, acesso operacional
  'company_manager',         -- responsável da empresa-cliente (portal, gestão da própria empresa)
  'company_user'             -- usuário operacional da empresa-cliente (portal, leitura/limitado)
);

CREATE TYPE firm_status AS ENUM ('active', 'trial', 'suspended', 'cancelled');
CREATE TYPE user_status AS ENUM ('active', 'invited', 'suspended', 'deactivated');

-- -----------------------------------------------------------------------------
-- Módulo: Empresas
-- -----------------------------------------------------------------------------

CREATE TYPE regime_tributario AS ENUM ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei');
CREATE TYPE status_empresa AS ENUM ('ativa', 'inativa', 'em_abertura', 'em_encerramento');

-- -----------------------------------------------------------------------------
-- Módulo: Clientes
-- -----------------------------------------------------------------------------

CREATE TYPE tipo_cliente AS ENUM ('pessoa_fisica', 'pessoa_juridica');
CREATE TYPE status_cliente AS ENUM ('ativo', 'inativo', 'prospecto');
CREATE TYPE tipo_documento_cliente AS ENUM ('contrato_social', 'procuracao', 'certidao', 'comprovante', 'outro');
CREATE TYPE tipo_historico_cliente AS ENUM ('atendimento', 'documento', 'cobranca', 'observacao');

-- -----------------------------------------------------------------------------
-- Módulo: Obrigações Fiscais
-- -----------------------------------------------------------------------------

CREATE TYPE obligation_type AS ENUM (
  'das', 'pgdas', 'dctfweb', 'efd_reinf', 'esocial', 'fgts_digital',
  'ecd', 'ecf', 'certidao', 'darf', 'grf', 'gfip'
);
CREATE TYPE obligation_status AS ENUM ('em_dia', 'proxima_vencimento', 'vencida', 'nao_aplicavel');
CREATE TYPE obligation_periodicity AS ENUM ('mensal', 'trimestral', 'anual', 'eventual');
CREATE TYPE obligation_integration_source AS ENUM ('receita_federal', 'esocial', 'fgts_digital', 'manual');

-- -----------------------------------------------------------------------------
-- Módulo: Notas Fiscais
-- -----------------------------------------------------------------------------

CREATE TYPE invoice_type AS ENUM ('nfse', 'nfe', 'nfce');
CREATE TYPE invoice_status AS ENUM ('emitida', 'cancelada', 'rejeitada', 'pendente', 'em_processo');

-- -----------------------------------------------------------------------------
-- Módulo: Central de Alertas
-- -----------------------------------------------------------------------------

CREATE TYPE alert_severity AS ENUM ('critico', 'atencao', 'informativo');
CREATE TYPE alert_category AS ENUM (
  'obrigacao_fiscal', 'certificado_digital', 'pendencia_fiscal',
  'nota_fiscal', 'cliente', 'sistema'
);

-- -----------------------------------------------------------------------------
-- Módulo: Portal do Cliente
-- -----------------------------------------------------------------------------

CREATE TYPE portal_document_category AS ENUM ('guia', 'relatorio', 'certidao', 'documento', 'contrato');
CREATE TYPE portal_message_status AS ENUM ('enviada', 'lida', 'respondida', 'aguardando');
CREATE TYPE portal_message_sender AS ENUM ('cliente', 'escritorio');
CREATE TYPE portal_guide_type AS ENUM ('das', 'darf', 'grf', 'dctfweb', 'outro');

-- -----------------------------------------------------------------------------
-- Billing / Subscriptions (plataforma MIL Contábil IA)
-- -----------------------------------------------------------------------------

CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'paused');
CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
CREATE TYPE invoice_payment_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------

CREATE TYPE audit_action AS ENUM ('insert', 'update', 'delete', 'login', 'logout', 'export', 'permission_change');
