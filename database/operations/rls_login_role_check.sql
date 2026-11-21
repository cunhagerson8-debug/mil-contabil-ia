\set ON_ERROR_STOP on

\if :{?expected_login_role}
\else
\echo 'Defina -v expected_login_role=mil_app_login ou mil_platform_login.'
\quit 2
\endif

SELECT CASE :'expected_login_role'
         WHEN 'mil_app_login' THEN 'mil_app'
         WHEN 'mil_platform_login' THEN 'mil_platform_admin'
         ELSE NULL
       END AS target_role,
       :'expected_login_role' IN ('mil_app_login', 'mil_platform_login') AS login_role_valid
\gset

\if :login_role_valid
\else
\echo 'Role de login não reconhecida.'
\quit 2
\endif

BEGIN READ ONLY;
DO $$
BEGIN
  IF current_database() <> 'mil_contabil_teste' THEN
    RAISE EXCEPTION 'Banco incorreto: esperado mil_contabil_teste';
  END IF;
END;
$$;
SELECT set_config('rls_test.expected_login_role', :'expected_login_role', true);

DO $$
DECLARE
  v_login text := current_setting('rls_test.expected_login_role');
  v_role record;
  v_expected_member text;
BEGIN
  v_expected_member := CASE v_login
    WHEN 'mil_app_login' THEN 'mil_app'
    WHEN 'mil_platform_login' THEN 'mil_platform_admin'
    ELSE NULL
  END;

  IF v_expected_member IS NULL OR session_user::text <> v_login THEN
    RAISE EXCEPTION 'Usuário de conexão não corresponde ao login esperado';
  END IF;

  SELECT rolsuper, rolbypassrls, rolcanlogin, rolinherit
  INTO v_role
  FROM pg_roles
  WHERE rolname = session_user;

  IF v_role.rolsuper OR v_role.rolbypassrls OR NOT v_role.rolcanlogin OR v_role.rolinherit THEN
    RAISE EXCEPTION 'Login preparado com atributos não permitidos';
  END IF;

  IF NOT pg_has_role(session_user, v_expected_member, 'MEMBER') THEN
    RAISE EXCEPTION 'Login não é membro da role planejada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members m
    JOIN pg_roles granted_role ON granted_role.oid = m.roleid
    JOIN pg_roles login_role ON login_role.oid = m.member
    WHERE login_role.rolname = session_user
      AND granted_role.rolname <> v_expected_member
  ) THEN
    RAISE EXCEPTION 'Login possui memberships adicionais não aprovadas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles privileged_role
    WHERE (privileged_role.rolsuper OR privileged_role.rolbypassrls)
      AND pg_has_role(session_user, privileged_role.oid, 'MEMBER')
      AND privileged_role.rolname <> v_expected_member
  ) THEN
    RAISE EXCEPTION 'Login pode assumir uma role privilegiada inesperada';
  END IF;
END;
$$;

SET LOCAL ROLE :target_role;

DO $$
DECLARE
  v_login text := current_setting('rls_test.expected_login_role');
  v_expected_role text;
  v_role record;
BEGIN
  v_expected_role := CASE v_login
    WHEN 'mil_app_login' THEN 'mil_app'
    WHEN 'mil_platform_login' THEN 'mil_platform_admin'
    ELSE NULL
  END;

  IF current_user::text <> v_expected_role THEN
    RAISE EXCEPTION 'SET LOCAL ROLE não produziu a role efetiva planejada';
  END IF;

  SELECT rolsuper, rolbypassrls, rolinherit
  INTO v_role
  FROM pg_roles
  WHERE rolname = current_user;

  IF v_role.rolsuper OR v_role.rolinherit THEN
    RAISE EXCEPTION 'Role efetiva não atende aos atributos esperados';
  END IF;

  IF v_expected_role = 'mil_app' AND v_role.rolbypassrls THEN
    RAISE EXCEPTION 'mil_app possui BYPASSRLS';
  END IF;

  IF v_expected_role = 'mil_platform_admin' AND NOT v_role.rolbypassrls THEN
    RAISE EXCEPTION 'mil_platform_admin não possui BYPASSRLS conforme o desenho atual';
  END IF;
END;
$$;

SELECT session_user AS login_conectado, current_user AS role_efetiva;
ROLLBACK;
