-- Authenticated RLS context. Historical migrations remain unchanged.
-- The application key is supplied to the migration runner through a
-- transaction-local setting; it is persisted only in a NOLOGIN-owned schema.

DO $$
DECLARE
  v_secret text := current_setting('app.rls_context_migration_secret', true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mil_app') THEN
    RAISE EXCEPTION 'mil_app must exist before migration 019';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'mil_app'
      AND (rolsuper OR rolbypassrls OR rolcanlogin)
  ) THEN
    RAISE EXCEPTION 'mil_app must be NOLOGIN, NOSUPERUSER, and NOBYPASSRLS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members membership
    JOIN pg_roles operational_role ON operational_role.oid = membership.member
    WHERE operational_role.rolname = 'mil_app'
  ) THEN
    RAISE EXCEPTION 'mil_app must not be a member of other roles';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'mil_platform_admin'
      AND (rolsuper OR NOT rolbypassrls OR rolcanlogin)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'mil_platform_admin'
  ) THEN
    RAISE EXCEPTION 'mil_platform_admin must be NOLOGIN, NOSUPERUSER, and BYPASSRLS';
  END IF;

  IF octet_length(convert_to(COALESCE(v_secret, ''), 'UTF8')) < 32 THEN
    RAISE EXCEPTION 'RLS_CONTEXT_SECRET must contain at least 32 bytes';
  END IF;

  IF to_regprocedure('public.hmac(bytea,bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto public.hmac(bytea,bytea,text) is required';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mil_context_owner') THEN
    RAISE EXCEPTION 'mil_context_owner already exists; review it before migration 019';
  END IF;
END;
$$;

CREATE ROLE mil_context_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;

DO $$
BEGIN
  EXECUTE format('GRANT mil_context_owner TO %I', session_user);
END;
$$;

CREATE SCHEMA app_private AUTHORIZATION mil_context_owner;

SET LOCAL ROLE mil_context_owner;

CREATE TABLE app_private.rls_context_secrets (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  secret bytea NOT NULL CHECK (octet_length(secret) >= 32),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

INSERT INTO app_private.rls_context_secrets (singleton, secret)
VALUES (
  true,
  convert_to(current_setting('app.rls_context_migration_secret', true), 'UTF8')
);

CREATE FUNCTION app_private.verified_rls_context()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_token text;
  v_payload_part text;
  v_signature_part text;
  v_payload jsonb;
  v_secret bytea;
  v_expected_signature bytea;
  v_received_signature bytea;
  v_signature_difference integer := 0;
  v_signature_byte integer;
  v_expiry bigint;
  v_now bigint;
BEGIN
  v_token := pg_catalog.current_setting('app.rls_context_token', true);
  IF v_token IS NULL OR length(v_token) > 2048 THEN
    RETURN NULL;
  END IF;

  v_payload_part := split_part(v_token, '.', 1);
  v_signature_part := split_part(v_token, '.', 2);
  IF v_payload_part = ''
     OR v_signature_part !~ '^[0-9a-f]{64}$'
     OR split_part(v_token, '.', 3) <> '' THEN
    RETURN NULL;
  END IF;

  SELECT secret
  INTO v_secret
  FROM app_private.rls_context_secrets
  WHERE singleton = true;

  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  v_expected_signature := public.hmac(convert_to(v_payload_part, 'UTF8'), v_secret, 'sha256');
  v_received_signature := decode(v_signature_part, 'hex');
  FOR v_signature_byte IN 0..31 LOOP
    v_signature_difference := v_signature_difference
      | (get_byte(v_expected_signature, v_signature_byte) # get_byte(v_received_signature, v_signature_byte));
  END LOOP;
  IF v_signature_difference <> 0 THEN
    RETURN NULL;
  END IF;

  v_payload := convert_from(decode(v_payload_part, 'base64'), 'UTF8')::jsonb;
  IF jsonb_typeof(v_payload) <> 'object'
     OR NOT (v_payload ?& ARRAY[
       'v', 'userId', 'firmId', 'role', 'expiresAt', 'backendPid',
       'transactionId', 'databaseName', 'sessionUser'
     ])
     OR v_payload ->> 'v' <> '1'
     OR v_payload ->> 'userId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR v_payload ->> 'firmId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR v_payload ->> 'role' NOT IN ('firm_owner', 'accountant', 'company_manager', 'company_user')
     OR v_payload ->> 'backendPid' <> pg_backend_pid()::text
     OR v_payload ->> 'transactionId' <> txid_current()::text
     OR v_payload ->> 'databaseName' <> current_database()
     OR v_payload ->> 'sessionUser' <> session_user THEN
    RETURN NULL;
  END IF;

  IF v_payload ->> 'expiresAt' !~ '^[0-9]+$' THEN
    RETURN NULL;
  END IF;
  v_expiry := (v_payload ->> 'expiresAt')::bigint;
  v_now := extract(epoch FROM statement_timestamp())::bigint;
  IF v_expiry <= v_now OR v_expiry > v_now + 1200 THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_payload ->> 'userId',
    'firm_id', v_payload ->> 'firmId',
    'role', v_payload ->> 'role'
  );
EXCEPTION
  WHEN data_exception THEN
    RETURN NULL;
END;
$$;

CREATE FUNCTION app_private.set_rls_context(p_token text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) > 2048 THEN
    RAISE EXCEPTION 'Invalid RLS context' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('app.rls_context_token', p_token, true);
  IF app_private.verified_rls_context() IS NULL THEN
    RAISE EXCEPTION 'Invalid RLS context' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON app_private.rls_context_secrets FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.verified_rls_context() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.set_rls_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.set_rls_context(text) TO mil_app;
GRANT USAGE ON SCHEMA app_private TO mil_app;

RESET ROLE;

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(app_private.verified_rls_context() ->> 'user_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.app_current_firm_id()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(app_private.verified_rls_context() ->> 'firm_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.app_current_role()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT app_private.verified_rls_context() ->> 'role';
$$;

-- PostgreSQL requires CREATE on the target schema when transferring function ownership.
GRANT CREATE ON SCHEMA public TO mil_context_owner;

ALTER FUNCTION app_private.verified_rls_context() OWNER TO mil_context_owner;
ALTER FUNCTION app_private.set_rls_context(text) OWNER TO mil_context_owner;
ALTER FUNCTION public.app_current_user_id() OWNER TO mil_context_owner;
ALTER FUNCTION public.app_current_firm_id() OWNER TO mil_context_owner;
ALTER FUNCTION public.app_current_role() OWNER TO mil_context_owner;

REVOKE CREATE ON SCHEMA public FROM mil_context_owner;

COMMENT ON FUNCTION public.app_current_user_id() IS
  'Returns the user ID only from a valid, HMAC-signed RLS context bound to this backend and transaction.';
COMMENT ON FUNCTION public.app_current_firm_id() IS
  'Returns the firm ID only from a valid, HMAC-signed RLS context bound to this backend and transaction.';
COMMENT ON FUNCTION public.app_current_role() IS
  'Returns the application role only from a valid, HMAC-signed RLS context bound to this backend and transaction.';

RESET ROLE;

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid := public.app_current_user_id();
  v_firm uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_firm := (to_jsonb(NEW) ->> 'firm_id')::uuid;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
    VALUES (v_firm, v_actor, 'insert', TG_TABLE_NAME, (to_jsonb(NEW) ->> 'id')::uuid, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_firm := (to_jsonb(NEW) ->> 'firm_id')::uuid;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
    VALUES (v_firm, v_actor, 'update', TG_TABLE_NAME, (to_jsonb(NEW) ->> 'id')::uuid, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_firm := (to_jsonb(OLD) ->> 'firm_id')::uuid;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (v_firm, v_actor, 'delete', TG_TABLE_NAME, (to_jsonb(OLD) ->> 'id')::uuid, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_digital_certificates_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid := public.app_current_user_id();
  v_firm uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT firm_id INTO v_firm FROM public.companies WHERE id = OLD.company_id;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (v_firm, v_actor, 'delete', 'digital_certificates', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  SELECT firm_id INTO v_firm FROM public.companies WHERE id = NEW.company_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
    VALUES (v_firm, v_actor, 'insert', 'digital_certificates', NEW.id, to_jsonb(NEW));
  ELSE
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
    VALUES (v_firm, v_actor, 'update', 'digital_certificates', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_users_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid := public.app_current_user_id();
  v_redact text[] := ARRAY['password_hash', 'mfa_secret'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
    VALUES (NEW.firm_id, v_actor, 'insert', 'users', NEW.id, to_jsonb(NEW) - v_redact);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
    VALUES (NEW.firm_id, v_actor, 'update', 'users', NEW.id, to_jsonb(OLD) - v_redact, to_jsonb(NEW) - v_redact);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (OLD.firm_id, v_actor, 'delete', 'users', OLD.id, to_jsonb(OLD) - v_redact);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

ALTER FUNCTION public.audit_trigger_fn() SECURITY DEFINER;
ALTER FUNCTION public.audit_trigger_fn() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.audit_digital_certificates_trigger_fn() SECURITY DEFINER;
ALTER FUNCTION public.audit_digital_certificates_trigger_fn() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.audit_users_trigger_fn() SECURITY DEFINER;
ALTER FUNCTION public.audit_users_trigger_fn() SET search_path = pg_catalog, pg_temp;

ALTER ROLE mil_app NOINHERIT;

RESET ROLE;

DO $$
BEGIN
  EXECUTE format('REVOKE mil_context_owner FROM %I', session_user);
END;
$$;
