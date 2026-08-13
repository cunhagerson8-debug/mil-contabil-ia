-- =============================================================================
-- 009_subscriptions_and_billing.sql
-- MIL Contábil IA — Assinaturas e Faturamento da Plataforma
-- =============================================================================
-- IMPORTANTE — não confundir com a tabela `invoices` (006): aquela é a Nota
-- Fiscal que o ESCRITÓRIO emite para os SEUS clientes (NFS-e/NF-e/NFC-e).
-- Este arquivo modela o lado oposto: o que o ESCRITÓRIO paga à MIL Gestão &
-- Tecnologia pelo uso da plataforma (assinatura SaaS). São domínios de
-- negócio diferentes, daí tabelas e nomenclatura separadas
-- (platform_invoices, não invoices).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plans — catálogo de planos da plataforma
-- -----------------------------------------------------------------------------
CREATE TABLE plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,     -- 'starter', 'professional', 'enterprise'
  name                text NOT NULL,
  description         text,
  price_amount        numeric(10,2) NOT NULL CHECK (price_amount >= 0),
  billing_interval     billing_interval NOT NULL,
  max_companies       integer,                  -- NULL = ilimitado
  max_users           integer,                  -- NULL = ilimitado
  max_invoices_month  integer,                  -- NULL = ilimitado
  features            jsonb NOT NULL DEFAULT '{}', -- flags de feature (ex: {"esocial_integration": true})
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE plans IS 'Catálogo de planos comerciais da plataforma MIL Contábil IA.';
COMMENT ON COLUMN plans.features IS 'Flags de feature por plano, ex: {"esocial_integration": true, "fgts_digital": false, "white_label": true}. Lido pela aplicação para feature-gating.';

CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- subscriptions — assinatura de um firm a um plano
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                 uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES plans(id),
  status                  subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start    timestamptz NOT NULL DEFAULT now(),
  current_period_end      timestamptz NOT NULL,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  cancelled_at            timestamptz,
  -- referência ao provedor de pagamento externo (Stripe, etc.) — a plataforma
  -- não processa cartão diretamente
  payment_provider        text,                -- 'stripe', 'pagarme', etc.
  payment_provider_ref    text,                -- ID da subscription no provedor externo
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Um firm tem apenas uma assinatura ativa por vez (histórico de trocas de
-- plano vira novas linhas com status cancelled, não update da mesma linha)
CREATE UNIQUE INDEX uq_subscriptions_active_per_firm
  ON subscriptions(firm_id) WHERE status IN ('trialing', 'active', 'past_due', 'paused');

CREATE INDEX idx_subscriptions_firm ON subscriptions(firm_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end) WHERE status = 'active';

COMMENT ON TABLE subscriptions IS 'Assinatura de um escritório (firm) a um plano da plataforma. Cobrança real processada por gateway externo (payment_provider).';

CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- platform_invoices — faturas que a MIL emite para o escritório (cobrança SaaS)
-- -----------------------------------------------------------------------------
CREATE TABLE platform_invoices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                 uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  subscription_id         uuid NOT NULL REFERENCES subscriptions(id),
  numero                  text NOT NULL UNIQUE, -- numeração interna da MIL, não fiscal do escritório
  status                  invoice_payment_status NOT NULL DEFAULT 'draft',
  amount_due              numeric(10,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid             numeric(10,2) NOT NULL DEFAULT 0,
  currency                text NOT NULL DEFAULT 'BRL',
  period_start            timestamptz NOT NULL,
  period_end              timestamptz NOT NULL,
  due_date                date NOT NULL,
  paid_at                 timestamptz,
  payment_provider_ref    text,    -- ID da invoice/charge no gateway externo
  pdf_storage_key         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_invoices_firm ON platform_invoices(firm_id);
CREATE INDEX idx_platform_invoices_subscription ON platform_invoices(subscription_id);
CREATE INDEX idx_platform_invoices_status ON platform_invoices(status);
CREATE INDEX idx_platform_invoices_due_date ON platform_invoices(due_date) WHERE status = 'open';

COMMENT ON TABLE platform_invoices IS 'Faturamento SaaS: o que a MIL Gestão & Tecnologia cobra do escritório contábil pelo uso da plataforma. Distinto de invoices (006), que são NF-e/NFS-e emitidas pelo escritório a seus próprios clientes.';

CREATE TRIGGER trg_platform_invoices_updated_at BEFORE UPDATE ON platform_invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- usage_counters — contadores de uso para enforcement de limites do plano
-- -----------------------------------------------------------------------------
-- Em vez de COUNT(*) nas tabelas operacionais a cada checagem de limite
-- (caro em tenants grandes), mantemos contadores agregados por período,
-- atualizados incrementalmente pela aplicação ou por trigger leve.
CREATE TABLE usage_counters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  period_month        date NOT NULL,         -- truncado para o primeiro dia do mês
  invoices_issued     integer NOT NULL DEFAULT 0,
  active_companies    integer NOT NULL DEFAULT 0,
  active_users        integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (firm_id, period_month)
);

CREATE INDEX idx_usage_counters_firm_period ON usage_counters(firm_id, period_month DESC);

COMMENT ON TABLE usage_counters IS 'Contadores agregados mensais para enforcement de limites de plano (max_invoices_month etc.) sem custo de COUNT(*) em tempo real.';
