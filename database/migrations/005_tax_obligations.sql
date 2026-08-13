-- =============================================================================
-- 005_tax_obligations.sql
-- MIL Contábil IA — Módulo Obrigações Fiscais
-- Espelha modules/obrigacoes-fiscais/types.ts (TaxObligation)
-- =============================================================================
-- Esta tabela é a fonte primária de muitos alertas em `alerts` (status =
-- vencida ou proxima_vencimento). A função/trigger de geração automática de
-- alertas é definida em 007_alerts.sql, após a tabela alerts existir.
-- =============================================================================

CREATE TABLE tax_obligations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  type                  obligation_type NOT NULL,
  competencia           text NOT NULL,           -- formato livre "MM/YYYY" ou "YYYY", igual ao frontend
  vencimento            date NOT NULL,
  status                obligation_status NOT NULL DEFAULT 'em_dia',
  valor                 numeric(14,2),
  observacoes           text,
  periodicidade         obligation_periodicity NOT NULL,
  integration_ref       text,                    -- protocolo eSocial, recibo PGDAS etc.
  integration_source    obligation_integration_source,
  paid_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_obligations_firm ON tax_obligations(firm_id);
CREATE INDEX idx_tax_obligations_company ON tax_obligations(company_id);
CREATE INDEX idx_tax_obligations_status ON tax_obligations(firm_id, status);
CREATE INDEX idx_tax_obligations_vencimento ON tax_obligations(vencimento);
-- Acelera a varredura diária (job) que recalcula status vencida/proxima_vencimento
CREATE INDEX idx_tax_obligations_status_vencimento
  ON tax_obligations(status, vencimento) WHERE status IN ('em_dia', 'proxima_vencimento');

COMMENT ON TABLE tax_obligations IS 'DAS, PGDAS, DCTFWeb, EFD-Reinf, eSocial, FGTS Digital, ECD, ECF, certidões etc. Alimenta a Central de Alertas.';

CREATE TRIGGER trg_tax_obligations_updated_at BEFORE UPDATE ON tax_obligations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Recalcula status com base na data de vencimento.
-- Chamado por job agendado (diário) — não em trigger de escrita, porque o
-- "vencimento se aproximando" muda só com a passagem do tempo, não com edição
-- da linha. Mantido aqui (e não em 011_rls) por pertencer ao domínio da tabela.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_obligation_statuses()
RETURNS void AS $$
BEGIN
  UPDATE tax_obligations
  SET status = 'vencida'
  WHERE status NOT IN ('vencida', 'nao_aplicavel')
    AND paid_at IS NULL
    AND vencimento < CURRENT_DATE;

  UPDATE tax_obligations
  SET status = 'proxima_vencimento'
  WHERE status = 'em_dia'
    AND paid_at IS NULL
    AND vencimento >= CURRENT_DATE
    AND vencimento <= CURRENT_DATE + INTERVAL '15 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_obligation_statuses() IS 'Executar via cron/job agendado diário (ex: pg_cron ou scheduler externo) para manter o status das obrigações em dia sem reescrever a UI.';
