-- ============================================================
-- 014_tax_obligations_new_schema.sql
-- MIL Contábil IA
-- Compatibilidade entre estrutura antiga e nova API
-- ============================================================

-- 1. Adiciona as colunas utilizadas pela API nova
ALTER TABLE tax_obligations
    ADD COLUMN IF NOT EXISTS obligation_type text,
    ADD COLUMN IF NOT EXISTS period text,
    ADD COLUMN IF NOT EXISTS due_date date,
    ADD COLUMN IF NOT EXISTS original_due_date date,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS completed_by uuid,
    ADD COLUMN IF NOT EXISTS integration_reference text,
    ADD COLUMN IF NOT EXISTS receipt_number text,
    ADD COLUMN IF NOT EXISTS receipt_url text,
    ADD COLUMN IF NOT EXISTS amount numeric(14,2),
    ADD COLUMN IF NOT EXISTS notes text;

-- 2. Migra os dados existentes do modelo antigo
UPDATE tax_obligations
SET obligation_type = type::text
WHERE obligation_type IS NULL
  AND type IS NOT NULL;

UPDATE tax_obligations
SET period = competencia
WHERE period IS NULL
  AND competencia IS NOT NULL;

UPDATE tax_obligations
SET due_date = vencimento
WHERE due_date IS NULL
  AND vencimento IS NOT NULL;

UPDATE tax_obligations
SET original_due_date = vencimento
WHERE original_due_date IS NULL
  AND vencimento IS NOT NULL;

UPDATE tax_obligations
SET amount = valor
WHERE amount IS NULL
  AND valor IS NOT NULL;

UPDATE tax_obligations
SET notes = observacoes
WHERE notes IS NULL
  AND observacoes IS NOT NULL;

UPDATE tax_obligations
SET integration_reference = integration_ref
WHERE integration_reference IS NULL
  AND integration_ref IS NOT NULL;

UPDATE tax_obligations
SET completed_at = paid_at
WHERE completed_at IS NULL
  AND paid_at IS NOT NULL;

-- 3. Índices da nova API
CREATE INDEX IF NOT EXISTS idx_tax_obligations_due_date
    ON tax_obligations(due_date);

CREATE INDEX IF NOT EXISTS idx_tax_obligations_original_due_date
    ON tax_obligations(original_due_date);

CREATE INDEX IF NOT EXISTS idx_tax_obligations_deleted_at
    ON tax_obligations(deleted_at);

CREATE INDEX IF NOT EXISTS idx_tax_obligations_obligation_type
    ON tax_obligations(obligation_type);

-- 4. Documentação
COMMENT ON COLUMN tax_obligations.obligation_type
IS 'Tipo da obrigação fiscal utilizado pela nova API';

COMMENT ON COLUMN tax_obligations.period
IS 'Competência/período utilizado pela nova API';

COMMENT ON COLUMN tax_obligations.due_date
IS 'Data de vencimento utilizada pela nova API';

COMMENT ON COLUMN tax_obligations.original_due_date
IS 'Data original do vencimento';

COMMENT ON COLUMN tax_obligations.completed_at
IS 'Data e hora da conclusão da obrigação';

COMMENT ON COLUMN tax_obligations.completed_by
IS 'Usuário responsável pela conclusão da obrigação';

COMMENT ON COLUMN tax_obligations.integration_reference
IS 'Referência externa da integração';

COMMENT ON COLUMN tax_obligations.receipt_number
IS 'Número do recibo ou comprovante';

COMMENT ON COLUMN tax_obligations.receipt_url
IS 'Endereço do comprovante armazenado';

COMMENT ON COLUMN tax_obligations.amount
IS 'Valor da obrigação fiscal';

COMMENT ON COLUMN tax_obligations.notes
IS 'Observações da obrigação fiscal';
-- 5. Libera colunas obrigatórias do modelo legado
-- A nova API não preenche mais estes campos diretamente.
ALTER TABLE tax_obligations
    ALTER COLUMN nome DROP NOT NULL,
    ALTER COLUMN type DROP NOT NULL,
    ALTER COLUMN competencia DROP NOT NULL,
    ALTER COLUMN vencimento DROP NOT NULL,
    ALTER COLUMN periodicidade DROP NOT NULL;