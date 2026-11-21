-- Preparação de roles para conexões separadas da aplicação.
-- Revisar e executar somente em janela autorizada, após validar o banco alvo.
-- Não define senha nem altera roles existentes mil_app/mil_platform_admin.
-- Execute após as migrations 011 e 019.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mil_app_login') THEN
        CREATE ROLE mil_app_login NOLOGIN NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mil_platform_login') THEN
        CREATE ROLE mil_platform_login NOLOGIN NOINHERIT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'mil_app'
          AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit)
    ) THEN
        RAISE EXCEPTION 'mil_app precisa ser NOLOGIN, NOINHERIT, não-superuser e sem BYPASSRLS';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'mil_platform_admin'
          AND (rolsuper OR NOT rolbypassrls OR rolcanlogin)
    ) THEN
        RAISE EXCEPTION 'mil_platform_admin precisa ser NOLOGIN, não-superuser e com BYPASSRLS';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mil_app')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mil_platform_admin') THEN
        RAISE EXCEPTION 'Aplique e valide a migration 011 antes de preparar os logins';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'mil_context_owner'
          AND NOT rolcanlogin
          AND NOT rolsuper
          AND NOT rolbypassrls
          AND NOT rolinherit
    ) THEN
        RAISE EXCEPTION 'Aplique a migration 019 e valide mil_context_owner antes de preparar os logins';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        JOIN pg_roles context_role ON context_role.oid = membership.member
        WHERE context_role.rolname = 'mil_context_owner'
    ) THEN
        RAISE EXCEPTION 'mil_context_owner não pode ser membro de outra role';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname IN ('mil_app_login', 'mil_platform_login')
          AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit)
    ) THEN
        RAISE EXCEPTION 'Logins preparados devem permanecer NOLOGIN, NOINHERIT, não-superuser e sem BYPASSRLS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles operational_role
        JOIN pg_roles privileged_role
          ON privileged_role.rolsuper OR privileged_role.rolbypassrls
        WHERE operational_role.rolname = 'mil_app'
          AND pg_has_role(operational_role.oid, privileged_role.oid, 'MEMBER')
    ) THEN
        RAISE EXCEPTION 'mil_app não pode ser membro de role superuser ou BYPASSRLS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles login_role
        JOIN pg_roles privileged_role
          ON privileged_role.rolsuper OR privileged_role.rolbypassrls
        WHERE login_role.rolname = 'mil_app_login'
          AND pg_has_role(login_role.oid, privileged_role.oid, 'MEMBER')
    ) THEN
        RAISE EXCEPTION 'mil_app_login não pode assumir role superuser ou BYPASSRLS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles login_role
        JOIN pg_auth_members membership ON membership.member = login_role.oid
        JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
        WHERE login_role.rolname = 'mil_app_login'
          AND granted_role.rolname <> 'mil_app'
    ) THEN
        RAISE EXCEPTION 'mil_app_login pode ser membro somente de mil_app';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles login_role
        JOIN pg_auth_members membership ON membership.member = login_role.oid
        JOIN pg_roles granted_role ON granted_role.oid = membership.roleid
        WHERE login_role.rolname = 'mil_platform_login'
          AND granted_role.rolname <> 'mil_platform_admin'
    ) THEN
        RAISE EXCEPTION 'mil_platform_login pode ser membro somente de mil_platform_admin';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles login_role
        JOIN pg_roles privileged_role
          ON privileged_role.rolsuper
          OR (privileged_role.rolbypassrls AND privileged_role.rolname <> 'mil_platform_admin')
        WHERE login_role.rolname = 'mil_platform_login'
          AND pg_has_role(login_role.oid, privileged_role.oid, 'MEMBER')
    ) THEN
        RAISE EXCEPTION 'mil_platform_login não pode assumir superuser ou outra role BYPASSRLS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles platform_role
        JOIN pg_roles superuser_role ON superuser_role.rolsuper
        WHERE platform_role.rolname = 'mil_platform_admin'
          AND pg_has_role(platform_role.oid, superuser_role.oid, 'MEMBER')
    ) THEN
        RAISE EXCEPTION 'mil_platform_admin não pode ser membro de uma role superuser';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_roles operational_role
        JOIN pg_class c
          ON pg_has_role(operational_role.oid, c.relowner, 'USAGE')
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE operational_role.rolname = 'mil_app'
          AND n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND c.relrowsecurity
    ) THEN
        RAISE EXCEPTION 'mil_app não pode possuir tabelas protegidas por RLS';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_auth_members membership
        JOIN pg_roles operational_role ON operational_role.oid = membership.member
        WHERE operational_role.rolname = 'mil_app'
    ) THEN
        RAISE EXCEPTION 'mil_app não pode possuir memberships de outras roles';
    END IF;
END
$$;

GRANT mil_app TO mil_app_login;
GRANT mil_platform_admin TO mil_platform_login;

-- Após configurar autenticação/segredos individuais e regras de rede no provedor,
-- a ativação LOGIN e a gestão de credenciais devem ser aprovadas separadamente:
-- ALTER ROLE mil_app_login LOGIN;
-- ALTER ROLE mil_platform_login LOGIN;
