\set ON_ERROR_STOP on

-- This script verifies that raw custom GUCs and forged tokens fail closed.
-- Full two-firm access, write, role-reset, and pool-reuse coverage is in
-- server/tests/rls-context.integration.test.ts. Run only on the isolated
-- local test database after migrations 001-019 and role setup are approved.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'mil_contabil_teste' THEN
    RAISE EXCEPTION 'Banco incorreto: esperado mil_contabil_teste';
  END IF;
  IF session_user::text <> 'mil_app_login' THEN
    RAISE EXCEPTION 'Conecte com mil_app_login para o teste operacional';
  END IF;
END;
$$;

SET LOCAL ROLE mil_app;

SELECT set_config('app.current_user_id', '11000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.current_firm_id', '10000000-0000-4000-8000-000000000001', true);
SELECT set_config('app.current_role', 'firm_owner', true);
SELECT set_config('app.rls_context_token', 'forged.token', true);

DO $$
DECLARE
  v_count integer;
BEGIN
  IF app_current_user_id() IS NOT NULL
     OR app_current_firm_id() IS NOT NULL
     OR app_current_role() IS NOT NULL THEN
    RAISE EXCEPTION 'Contexto sem assinatura vÃ¡lida nÃ£o falhou fechado';
  END IF;

  SELECT count(*) INTO v_count FROM public.companies;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GUCs ou token falsificados expuseram % empresas', v_count;
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF current_user::text <> 'mil_app_login' THEN
    RAISE EXCEPTION 'RESET ROLE nÃ£o retornou ao login operacional esperado';
  END IF;
  IF pg_has_role(session_user, 'mil_platform_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'Login operacional Ã© membro da role administrativa';
  END IF;
END;
$$;

ROLLBACK;
