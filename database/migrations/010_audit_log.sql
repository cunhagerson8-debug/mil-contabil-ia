-- =============================================================================
-- 010_audit_log.sql
-- MIL Contábil IA — Log de Auditoria
-- =============================================================================
-- Design: tabela única, polimórfica (entity_table + entity_id) em vez de uma
-- tabela de auditoria por entidade. Trade-off consciente:
--   + Uma única função de trigger genérica cobre todas as tabelas de negócio.
--   + Consultas de "tudo que o usuário X fez" ou "tudo que aconteceu com a
--     empresa Y" são uma única query, não um UNION por tabela.
--   + Mais fácil reter/particionar (por data) e exportar para WORM storage.
--   - jsonb para old/new values custa mais espaço que colunas tipadas, mas
--     auditoria é write-heavy/read-rarely — aceitável.
-- =============================================================================

CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         uuid REFERENCES firms(id) ON DELETE SET NULL,  -- nullable: ações de platform_admin podem não ter firm
  actor_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,  -- nullable: ações de sistema/job não têm usuário
  action          audit_action NOT NULL,
  entity_table    text NOT NULL,         -- nome da tabela afetada, ex: 'companies', 'invoices'
  entity_id       uuid,                  -- PK do registro afetado (NULL para 'login'/'logout')
  old_values      jsonb,                 -- estado anterior (NULL em insert)
  new_values      jsonb,                 -- estado novo (NULL em delete)
  ip_address      inet,
  user_agent      text,
  metadata        jsonb NOT NULL DEFAULT '{}',  -- contexto adicional livre (ex: motivo, request_id)
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Particionamento por mês é recomendado em produção a partir de volume
-- relevante (ver nota ao final do arquivo) — índices abaixo já assumem isso.
CREATE INDEX idx_audit_logs_firm ON audit_logs(firm_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Trilha de auditoria de toda a plataforma: alterações de dados (insert/update/delete), login/logout, exportações e mudanças de permissão.';
COMMENT ON COLUMN audit_logs.entity_table IS 'Nome da tabela de negócio afetada — usado para reconstruir o contexto sem precisar de FK física por tabela.';

-- -----------------------------------------------------------------------------
-- Função de trigger genérica — anexável a qualquer tabela de negócio
-- -----------------------------------------------------------------------------
-- Lê firm_id da própria linha quando a coluna existe; caso a tabela não
-- tenha firm_id diretamente (ex: invoice_items, que só tem invoice_id),
-- a aplicação deve usar a variante explícita ou a tabela deve ser
-- enriquecida via JOIN antes da escrita — neste schema, toda tabela
-- auditada relevante já carrega firm_id diretamente.
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_actor uuid;
  v_firm  uuid;
BEGIN
  -- app.current_user_id é setado pela aplicação via SET LOCAL no início da transação
  -- (mesma convenção usada para RLS em 011_row_level_security.sql)
  BEGIN
    v_actor := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    BEGIN v_firm := (to_jsonb(NEW)->>'firm_id')::uuid; EXCEPTION WHEN OTHERS THEN v_firm := NULL; END;
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
    VALUES (v_firm, v_actor, 'insert', TG_TABLE_NAME, (to_jsonb(NEW)->>'id')::uuid, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN v_firm := (to_jsonb(NEW)->>'firm_id')::uuid; EXCEPTION WHEN OTHERS THEN v_firm := NULL; END;
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
    VALUES (v_firm, v_actor, 'update', TG_TABLE_NAME, (to_jsonb(NEW)->>'id')::uuid, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    BEGIN v_firm := (to_jsonb(OLD)->>'firm_id')::uuid; EXCEPTION WHEN OTHERS THEN v_firm := NULL; END;
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (v_firm, v_actor, 'delete', TG_TABLE_NAME, (to_jsonb(OLD)->>'id')::uuid, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION audit_trigger_fn() IS 'Função de trigger genérica de auditoria. Anexar via CREATE TRIGGER ... AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn() em qualquer tabela com coluna firm_id.';

-- -----------------------------------------------------------------------------
-- Anexa auditoria às tabelas de negócio sensíveis (firm-scoped)
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_audit_companies AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER trg_audit_tax_obligations AFTER INSERT OR UPDATE OR DELETE ON tax_obligations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- digital_certificates não tem firm_id direto (apenas company_id) — a
-- função genérica deixaria firm_id NULL no log, o que quebraria a leitura
-- de auditoria por firm_owner (policy audit_logs_select_owner_only exige
-- firm_id = app_current_firm_id()). Usa função dedicada que resolve
-- firm_id via JOIN com companies antes de inserir o log.
CREATE OR REPLACE FUNCTION audit_digital_certificates_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_actor uuid;
  v_firm  uuid;
BEGIN
  BEGIN
    v_actor := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    SELECT firm_id INTO v_firm FROM companies WHERE id = OLD.company_id;
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (v_firm, v_actor, 'delete', 'digital_certificates', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSE
    SELECT firm_id INTO v_firm FROM companies WHERE id = NEW.company_id;
    IF TG_OP = 'INSERT' THEN
      INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
      VALUES (v_firm, v_actor, 'insert', 'digital_certificates', NEW.id, to_jsonb(NEW));
    ELSE
      INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
      VALUES (v_firm, v_actor, 'update', 'digital_certificates', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_digital_certificates AFTER INSERT OR UPDATE OR DELETE ON digital_certificates
  FOR EACH ROW EXECUTE FUNCTION audit_digital_certificates_trigger_fn();

CREATE TRIGGER trg_audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- users é auditado, mas exclui password_hash/mfa_secret do payload por
-- segurança — usa função dedicada em vez da genérica.
CREATE OR REPLACE FUNCTION audit_users_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_actor uuid;
  v_redact text[] := ARRAY['password_hash', 'mfa_secret'];
BEGIN
  BEGIN
    v_actor := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
    VALUES (NEW.firm_id, v_actor, 'insert', 'users', NEW.id, to_jsonb(NEW) - v_redact);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
    VALUES (NEW.firm_id, v_actor, 'update', 'users', NEW.id, to_jsonb(OLD) - v_redact, to_jsonb(NEW) - v_redact);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (OLD.firm_id, v_actor, 'delete', 'users', OLD.id, to_jsonb(OLD) - v_redact);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_users_trigger_fn();

-- -----------------------------------------------------------------------------
-- Nota de operação (produção): particionamento e retenção
-- -----------------------------------------------------------------------------
-- Em volume de produção, recomenda-se converter audit_logs em tabela
-- particionada por RANGE (created_at), partição mensal, com política de
-- retenção (ex: mover partições >24 meses para storage frio / WORM,
-- conforme exigência de guarda fiscal/legal). Não implementado nesta
-- migração para manter o schema inicial simples; é uma migração futura
-- aditiva (CREATE TABLE ... PARTITION BY RANGE) que não quebra a aplicação.
