-- =============================================================================
-- 007_alerts.sql
-- MIL Contábil IA — Central de Alertas
-- Espelha modules/alertas/types.ts (Alert)
-- =============================================================================
-- company_id é nullable: alertas de sistema/plataforma (ex: "nova versão do
-- layout eSocial") não pertencem a uma empresa específica — espelha o
-- `companyId?: string` opcional do frontend.
-- =============================================================================

CREATE TABLE alerts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  company_id          uuid REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = alerta de sistema
  title               text NOT NULL,
  description         text NOT NULL,
  severity            alert_severity NOT NULL,
  category            alert_category NOT NULL,
  due_date            date,
  read                boolean NOT NULL DEFAULT false,
  read_at             timestamptz,
  read_by             uuid REFERENCES users(id),
  action_label        text,
  action_target       text,     -- AppSection (ex: 'OBRIGACOES_FISCAIS') ou URL
  source_module       text NOT NULL,
  -- referências de origem para rastreabilidade — todas opcionais e mutuamente
  -- exclusivas na prática, mas sem CHECK rígido para permitir alertas
  -- compostos futuros (ex: um alerta que cita tanto uma obrigação quanto um certificado)
  source_obligation_id uuid REFERENCES tax_obligations(id) ON DELETE CASCADE,
  source_invoice_id     uuid REFERENCES invoices(id) ON DELETE CASCADE,
  source_certificate_id uuid REFERENCES digital_certificates(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_firm ON alerts(firm_id);
CREATE INDEX idx_alerts_company ON alerts(company_id);
CREATE INDEX idx_alerts_unread ON alerts(firm_id, read) WHERE read = false;
CREATE INDEX idx_alerts_severity ON alerts(firm_id, severity, created_at DESC);
CREATE INDEX idx_alerts_category ON alerts(firm_id, category);

COMMENT ON TABLE alerts IS 'Feed unificado de alertas: obrigações vencendo, certificados expirando, pendências fiscais, notas rejeitadas, avisos de sistema.';
COMMENT ON COLUMN alerts.company_id IS 'NULL para alertas de sistema/plataforma que não pertencem a uma empresa específica.';

-- -----------------------------------------------------------------------------
-- Geração automática de alertas a partir de tax_obligations
-- -----------------------------------------------------------------------------
-- Quando recalculate_obligation_statuses() (005) muda o status de uma
-- obrigação para 'vencida' ou 'proxima_vencimento', este trigger cria o
-- alerta correspondente automaticamente — evita que a aplicação precise
-- replicar essa lógica em múltiplos lugares.
CREATE OR REPLACE FUNCTION generate_alert_from_obligation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'vencida' AND (OLD.status IS DISTINCT FROM 'vencida') THEN
    INSERT INTO alerts (firm_id, company_id, title, description, severity, category,
                         due_date, action_label, action_target, source_module, source_obligation_id)
    VALUES (
      NEW.firm_id, NEW.company_id,
      format('%s vencida', NEW.nome),
      format('A obrigação "%s" referente à competência %s venceu em %s sem confirmação de pagamento.',
             NEW.nome, NEW.competencia, to_char(NEW.vencimento, 'DD/MM/YYYY')),
      'critico', 'obrigacao_fiscal',
      NEW.vencimento, 'Ver Obrigação', 'OBRIGACOES_FISCAIS', 'Obrigações Fiscais', NEW.id
    );
  ELSIF NEW.status = 'proxima_vencimento' AND (OLD.status IS DISTINCT FROM 'proxima_vencimento') THEN
    INSERT INTO alerts (firm_id, company_id, title, description, severity, category,
                         due_date, action_label, action_target, source_module, source_obligation_id)
    VALUES (
      NEW.firm_id, NEW.company_id,
      format('%s vence em breve', NEW.nome),
      format('A obrigação "%s" referente à competência %s vence em %s.',
             NEW.nome, NEW.competencia, to_char(NEW.vencimento, 'DD/MM/YYYY')),
      'atencao', 'obrigacao_fiscal',
      NEW.vencimento, 'Ver Obrigação', 'OBRIGACOES_FISCAIS', 'Obrigações Fiscais', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tax_obligations_generate_alert
  AFTER UPDATE OF status ON tax_obligations
  FOR EACH ROW EXECUTE FUNCTION generate_alert_from_obligation();

-- -----------------------------------------------------------------------------
-- Geração automática de alertas para certificados A1 expirando (<=30 dias)
-- -----------------------------------------------------------------------------
-- Diferente do trigger acima, validade de certificado não muda de "status"
-- por escrita — é função pura do tempo. Por isso este é um procedimento de
-- job agendado (mesmo padrão de recalculate_obligation_statuses em 005),
-- não um trigger de tabela.
CREATE OR REPLACE FUNCTION generate_certificate_expiry_alerts()
RETURNS void AS $$
BEGIN
  INSERT INTO alerts (firm_id, company_id, title, description, severity, category,
                       due_date, action_label, action_target, source_module, source_certificate_id)
  SELECT
    c.firm_id, dc.company_id,
    format('Certificado Digital A1 expira em %s dias', (dc.valid_until - CURRENT_DATE)),
    format('O certificado A1 da empresa %s vence em %s. Após o vencimento, a empresa ficará impedida de assinar documentos eletrônicos, transmitir eSocial e emitir NF-e.',
           c.nome_fantasia, to_char(dc.valid_until, 'DD/MM/YYYY')),
    CASE WHEN (dc.valid_until - CURRENT_DATE) <= 7 THEN 'critico'::alert_severity ELSE 'atencao'::alert_severity END,
    'certificado_digital',
    dc.valid_until, 'Ver Empresa', 'EMPRESAS', 'Empresas', dc.id
  FROM digital_certificates dc
  JOIN companies c ON c.id = dc.company_id
  WHERE dc.revoked_at IS NULL
    AND dc.valid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    -- evita duplicar alerta já emitido para o mesmo certificado na mesma janela do dia
    AND NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.source_certificate_id = dc.id
        AND a.created_at::date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_certificate_expiry_alerts() IS 'Executar via job agendado diário junto com recalculate_obligation_statuses().';
