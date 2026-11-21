
-- ============================================================
-- MIGRATION 023
-- MIL CONTABIL IA
-- Hardening das permissões das funções de contexto RLS
-- ============================================================

-- 1. Validar a existência do papel operacional e das funções.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'mil_app'
    ) THEN
        RAISE EXCEPTION 'Role mil_app não encontrada';
    END IF;

    IF to_regprocedure('public.app_current_user_id()') IS NULL
       OR to_regprocedure('public.app_current_firm_id()') IS NULL
       OR to_regprocedure('public.app_current_role()') IS NULL
    THEN
        RAISE EXCEPTION 'Uma ou mais funções RLS não foram encontradas';
    END IF;
END;
$$;

-- 2. Remover execução pública das funções.
REVOKE EXECUTE
ON FUNCTION public.app_current_user_id()
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.app_current_firm_id()
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.app_current_role()
FROM PUBLIC;

-- 3. Conceder execução exclusivamente ao papel operacional.
GRANT EXECUTE
ON FUNCTION public.app_current_user_id()
TO mil_app;

GRANT EXECUTE
ON FUNCTION public.app_current_firm_id()
TO mil_app;

GRANT EXECUTE
ON FUNCTION public.app_current_role()
TO mil_app;

-- ============================================================
-- FIM DA MIGRATION 023
-- ============================================================
