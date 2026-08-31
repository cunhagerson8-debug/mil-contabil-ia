-- 013_tax_obligations_deleted_at.sql
-- Adiciona suporte a soft delete nas obrigacoes fiscais.

ALTER TABLE tax_obligations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tax_obligations_deleted_at
ON tax_obligations (deleted_at);