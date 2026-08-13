-- =============================================================================
-- 012_seed_roles_and_plans.sql
-- MIL Contábil IA — Dados de referência (planos comerciais)
-- =============================================================================
-- user_role já é um enum fixo (001) — não há tabela "roles" para popular,
-- por decisão de modelagem (ver ARCHITECTURE.md). Este arquivo documenta a
-- matriz de permissões esperada por role como comentário de referência para
-- a camada de aplicação (middleware de autorização), e popula o catálogo
-- real de planos comerciais da plataforma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Matriz de permissões por role (referência para a aplicação)
-- -----------------------------------------------------------------------------
-- platform_admin
--   Acesso global a todos os firms. Gerencia plans, suspende/ativa firms,
--   visualiza billing agregado. Não acessa dados operacionais (clients,
--   invoices) de um firm específico, exceto em modo de suporte auditado.
--
-- firm_owner
--   Acesso total ao próprio firm: cria/edita/exclui companies, clients,
--   convida e remove usuários, vê billing/subscription do escritório,
--   vê audit_logs do firm. Único role que pode excluir registros (DELETE).
--
-- accountant
--   Acesso operacional ao próprio firm: cria/edita companies, clients,
--   tax_obligations, invoices. NÃO vê billing/subscription do escritório,
--   NÃO convida usuários, NÃO exclui registros (apenas firm_owner exclui).
--   Pode ter carteira restrita via user_company_access.
--
-- company_manager
--   Usuário do Portal do Cliente com permissão de gestão da própria empresa:
--   lê obrigações, notas, guias e documentos da(s) company(ies) vinculada(s)
--   em user_company_access; pode enviar mensagens; pode marcar guias como
--   pagas. Não vê dados de outras empresas do mesmo escritório.
--
-- company_user
--   Usuário do Portal do Cliente com acesso operacional/leitura: mesma
--   visibilidade de dados que company_manager, mas can_manage=false em
--   user_company_access — a aplicação usa esse flag para esconder ações
--   de gestão (ex: não pode marcar guia como paga, só visualizar).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plans — catálogo inicial de planos comerciais
-- -----------------------------------------------------------------------------
INSERT INTO plans (code, name, description, price_amount, billing_interval, max_companies, max_users, max_invoices_month, features, is_active)
VALUES
  (
    'starter', 'Starter',
    'Para escritórios pequenos iniciando a digitalização — até 10 empresas.',
    199.00, 'monthly', 10, 5, 100,
    '{"esocial_integration": false, "fgts_digital_integration": false, "white_label": false, "portal_cliente": true, "ai_chat": true}'::jsonb,
    true
  ),
  (
    'professional', 'Professional',
    'Para escritórios em crescimento — até 50 empresas, integrações fiscais completas.',
    499.00, 'monthly', 50, 20, 1000,
    '{"esocial_integration": true, "fgts_digital_integration": true, "white_label": false, "portal_cliente": true, "ai_chat": true}'::jsonb,
    true
  ),
  (
    'enterprise', 'Enterprise',
    'Para escritórios e redes contábeis de grande porte — empresas e usuários ilimitados, whitelabel.',
    1490.00, 'monthly', NULL, NULL, NULL,
    '{"esocial_integration": true, "fgts_digital_integration": true, "white_label": true, "portal_cliente": true, "ai_chat": true, "priority_support": true}'::jsonb,
    true
  ),
  (
    'enterprise_annual', 'Enterprise Anual',
    'Plano Enterprise com cobrança anual e desconto.',
    14900.00, 'yearly', NULL, NULL, NULL,
    '{"esocial_integration": true, "fgts_digital_integration": true, "white_label": true, "portal_cliente": true, "ai_chat": true, "priority_support": true}'::jsonb,
    true
  );

COMMENT ON TABLE plans IS 'Catálogo de planos comerciais. Populado via seed (012) e gerenciável depois via painel platform_admin (BYPASSRLS), não pela aplicação operacional do escritório.';
