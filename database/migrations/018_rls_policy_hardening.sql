-- Incremental hardening for tenant and company-scoped access.
-- Historical migrations remain unchanged.

CREATE OR REPLACE FUNCTION app_user_can_access_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE app_current_role()
    WHEN 'firm_owner' THEN true
    WHEN 'accountant' THEN
      NOT EXISTS (
        SELECT 1
        FROM user_company_access uca
        WHERE uca.user_id = app_current_user_id()
      )
      OR (
        p_company_id IS NOT NULL
        AND app_user_has_company_access(p_company_id)
      )
    WHEN 'company_manager' THEN
      p_company_id IS NOT NULL
      AND app_user_has_company_access(p_company_id)
    WHEN 'company_user' THEN
      p_company_id IS NOT NULL
      AND app_user_has_company_access(p_company_id)
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION app_user_can_manage_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_role() = 'company_manager'
    AND p_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM user_company_access uca
      WHERE uca.user_id = app_current_user_id()
        AND uca.company_id = p_company_id
        AND uca.can_manage = true
    );
$$;

GRANT EXECUTE ON FUNCTION app_user_can_access_company(uuid) TO mil_app;
GRANT EXECUTE ON FUNCTION app_user_can_manage_company(uuid) TO mil_app;

-- A login that can set mil_app must not also be able to assume a privileged
-- database role. Keep self-service updates limited to last_login_at.
DROP POLICY IF EXISTS users_update_same_firm_or_self ON users;
CREATE POLICY users_update_firm_owner
ON users
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() = 'firm_owner'
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() = 'firm_owner'
);

CREATE POLICY users_update_self_login
ON users
FOR UPDATE
USING (
  id = app_current_user_id()
  AND firm_id = app_current_firm_id()
)
WITH CHECK (
  id = app_current_user_id()
  AND firm_id = app_current_firm_id()
);

CREATE OR REPLACE FUNCTION app_is_privileged_database_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((
    SELECT rolsuper OR rolbypassrls
    FROM pg_roles
    WHERE rolname = current_user
  ), false);
$$;

CREATE OR REPLACE FUNCTION guard_user_privileged_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app_is_privileged_database_role() THEN
    RETURN NEW;
  END IF;

  IF app_current_role() = 'firm_owner'
     AND OLD.firm_id = app_current_firm_id()
     AND NEW.firm_id = app_current_firm_id() THEN
    RETURN NEW;
  END IF;

  IF OLD.id = app_current_user_id()
     AND NEW.id = OLD.id
     AND NEW.firm_id IS NOT DISTINCT FROM OLD.firm_id
     AND (to_jsonb(NEW) - ARRAY['last_login_at', 'updated_at'])
         IS NOT DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['last_login_at', 'updated_at']) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Usuário sem permissão para alterar estes campos'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_users_guard_privileged_update ON users;
CREATE TRIGGER trg_users_guard_privileged_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION guard_user_privileged_update();

CREATE OR REPLACE FUNCTION guard_nonowner_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT app_is_privileged_database_role()
     AND app_current_role() IS DISTINCT FROM 'firm_owner'
     AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Somente firm_owner pode remover o registro'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_guard_soft_delete ON companies;
CREATE TRIGGER trg_companies_guard_soft_delete
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION guard_nonowner_soft_delete();

DROP TRIGGER IF EXISTS trg_clients_guard_soft_delete ON clients;
CREATE TRIGGER trg_clients_guard_soft_delete
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION guard_nonowner_soft_delete();

DROP TRIGGER IF EXISTS trg_hr_employees_guard_soft_delete ON hr_employees;
CREATE TRIGGER trg_hr_employees_guard_soft_delete
BEFORE UPDATE ON hr_employees
FOR EACH ROW
EXECUTE FUNCTION guard_nonowner_soft_delete();

CREATE OR REPLACE FUNCTION guard_nonowner_link_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_columns text[];
  v_column text;
BEGIN
  IF app_is_privileged_database_role()
     OR app_current_role() = 'firm_owner' THEN
    RETURN NEW;
  END IF;

  v_columns := CASE TG_TABLE_NAME
    WHEN 'companies' THEN ARRAY['id', 'firm_id', 'contador_responsavel_id']
    WHEN 'company_partners' THEN ARRAY['company_id']
    WHEN 'digital_certificates' THEN ARRAY['company_id']
    WHEN 'clients' THEN ARRAY['id', 'firm_id', 'company_id']
    WHEN 'client_contacts' THEN ARRAY['client_id']
    WHEN 'client_documents' THEN ARRAY['client_id']
    WHEN 'client_history_entries' THEN ARRAY['client_id']
    WHEN 'tax_obligations' THEN ARRAY['id', 'firm_id', 'company_id']
    WHEN 'invoices' THEN ARRAY['id', 'firm_id', 'company_id']
    WHEN 'invoice_items' THEN ARRAY['invoice_id']
    WHEN 'alerts' THEN ARRAY['firm_id', 'company_id', 'source_obligation_id', 'source_invoice_id', 'source_certificate_id']
    WHEN 'portal_documents' THEN ARRAY['client_id']
    WHEN 'portal_guides' THEN ARRAY['client_id', 'tax_obligation_id']
    WHEN 'portal_messages' THEN ARRAY['client_id', 'sender_user_id', 'resposta_id']
    WHEN 'hr_departments' THEN ARRAY['firm_id', 'company_id']
    WHEN 'hr_employees' THEN ARRAY['firm_id', 'company_id', 'department_id']
    WHEN 'hr_employee_documents' THEN ARRAY['employee_id']
    WHEN 'hr_vacations' THEN ARRAY['employee_id']
    WHEN 'hr_leaves' THEN ARRAY['employee_id']
    ELSE ARRAY[]::text[]
  END;

  FOREACH v_column IN ARRAY v_columns LOOP
    IF (to_jsonb(NEW) -> v_column) IS DISTINCT FROM (to_jsonb(OLD) -> v_column) THEN
      RAISE EXCEPTION 'Usuário operacional não pode alterar vínculos'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_guard_links BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_company_partners_guard_links BEFORE UPDATE ON company_partners
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_digital_certificates_guard_links BEFORE UPDATE ON digital_certificates
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_clients_guard_links BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_client_contacts_guard_links BEFORE UPDATE ON client_contacts
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_client_documents_guard_links BEFORE UPDATE ON client_documents
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_client_history_guard_links BEFORE UPDATE ON client_history_entries
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_tax_obligations_guard_links BEFORE UPDATE ON tax_obligations
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_invoices_guard_links BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_invoice_items_guard_links BEFORE UPDATE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
DROP POLICY IF EXISTS alerts_select ON alerts;
DROP POLICY IF EXISTS alerts_update_mark_read ON alerts;
DROP POLICY IF EXISTS alerts_insert_system_or_staff ON alerts;

CREATE POLICY alerts_select_scoped
ON alerts
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = alerts.company_id
        AND c.firm_id = app_current_firm_id()
        AND app_user_can_access_company(c.id)
    )
  )
);

CREATE POLICY alerts_update_read_status
ON alerts
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = alerts.company_id
        AND c.firm_id = app_current_firm_id()
        AND app_user_can_access_company(c.id)
    )
  )
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND read_by = app_current_user_id()
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = alerts.company_id
        AND c.firm_id = app_current_firm_id()
        AND app_user_can_access_company(c.id)
    )
  )
);

CREATE POLICY alerts_insert_scoped
ON alerts
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = alerts.company_id
        AND c.firm_id = app_current_firm_id()
        AND app_user_can_access_company(c.id)
    )
  )
  AND (
    source_obligation_id IS NULL
    OR EXISTS (
      SELECT 1 FROM tax_obligations o
      WHERE o.id = alerts.source_obligation_id
        AND o.firm_id = app_current_firm_id()
        AND o.company_id IS NOT DISTINCT FROM alerts.company_id
    )
  )
  AND (
    source_invoice_id IS NULL
    OR EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = alerts.source_invoice_id
        AND i.firm_id = app_current_firm_id()
        AND i.company_id IS NOT DISTINCT FROM alerts.company_id
    )
  )
  AND (
    source_certificate_id IS NULL
    OR EXISTS (
      SELECT 1 FROM digital_certificates dc
      JOIN companies c ON c.id = dc.company_id
      WHERE dc.id = alerts.source_certificate_id
        AND c.firm_id = app_current_firm_id()
        AND dc.company_id IS NOT DISTINCT FROM alerts.company_id
    )
  )
);

CREATE OR REPLACE FUNCTION guard_alert_read_status_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app_is_privileged_database_role() THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - ARRAY['read', 'read_at', 'read_by'])
       IS NOT DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['read', 'read_at', 'read_by'])
     AND NEW.read IS TRUE
     AND NEW.read_by = app_current_user_id() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Usuário operacional só pode marcar alertas como lidos'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_alerts_guard_read_status
BEFORE UPDATE ON alerts
FOR EACH ROW
EXECUTE FUNCTION guard_alert_read_status_update();

CREATE TRIGGER trg_alerts_guard_links BEFORE UPDATE ON alerts
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_portal_documents_guard_links BEFORE UPDATE ON portal_documents
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_portal_guides_guard_links BEFORE UPDATE ON portal_guides
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_portal_messages_guard_links BEFORE UPDATE ON portal_messages
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_hr_departments_guard_links BEFORE UPDATE ON hr_departments
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_hr_employees_guard_links BEFORE UPDATE ON hr_employees
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_hr_employee_documents_guard_links BEFORE UPDATE ON hr_employee_documents
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_hr_vacations_guard_links BEFORE UPDATE ON hr_vacations
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();
CREATE TRIGGER trg_hr_leaves_guard_links BEFORE UPDATE ON hr_leaves
FOR EACH ROW EXECUTE FUNCTION guard_nonowner_link_changes();

-- Only firm owners manage company-access links. Every link must stay inside
-- the user's firm, and ordinary users can only read their own assignments.
DROP POLICY IF EXISTS user_company_access_same_firm ON user_company_access;
CREATE POLICY user_company_access_select_scoped
ON user_company_access
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = user_company_access.user_id
      AND u.firm_id = app_current_firm_id()
  )
  AND (
    app_current_role() = 'firm_owner'
    OR user_id = app_current_user_id()
  )
);

CREATE POLICY user_company_access_insert_owner
ON user_company_access
FOR INSERT
WITH CHECK (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = user_company_access.user_id
      AND u.firm_id = app_current_firm_id()
  )
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = user_company_access.company_id
      AND c.firm_id = app_current_firm_id()
  )
);

CREATE POLICY user_company_access_update_owner
ON user_company_access
FOR UPDATE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = user_company_access.user_id
      AND u.firm_id = app_current_firm_id()
  )
)
WITH CHECK (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = user_company_access.user_id
      AND u.firm_id = app_current_firm_id()
  )
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = user_company_access.company_id
      AND c.firm_id = app_current_firm_id()
  )
);

CREATE POLICY user_company_access_delete_owner
ON user_company_access
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = user_company_access.user_id
      AND u.firm_id = app_current_firm_id()
  )
);

-- Companies and partner rows respect both the firm and the user's company
-- portfolio. Assignment of a responsible accountant must remain same-firm.
DROP POLICY IF EXISTS companies_select_firm_scoped ON companies;
DROP POLICY IF EXISTS companies_insert_firm_scoped ON companies;
DROP POLICY IF EXISTS companies_update_firm_scoped ON companies;
DROP POLICY IF EXISTS companies_delete_firm_owner_only ON companies;

CREATE POLICY companies_select_scoped
ON companies
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND app_user_can_access_company(id)
);

CREATE POLICY companies_insert_scoped
ON companies
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(id)
  AND (
    contador_responsavel_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = companies.contador_responsavel_id
        AND u.firm_id = app_current_firm_id()
    )
  )
);

CREATE POLICY companies_update_scoped
ON companies
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(id)
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(id)
  AND (
    contador_responsavel_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = companies.contador_responsavel_id
        AND u.firm_id = app_current_firm_id()
    )
  )
);

CREATE POLICY companies_delete_owner
ON companies
FOR DELETE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() = 'firm_owner'
);

DROP POLICY IF EXISTS company_partners_via_company ON company_partners;
CREATE POLICY company_partners_select_scoped
ON company_partners
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_partners.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
);

CREATE POLICY company_partners_insert_staff
ON company_partners
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_partners.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
);

CREATE POLICY company_partners_update_staff
ON company_partners
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_partners.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_partners.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
);

CREATE POLICY company_partners_delete_owner
ON company_partners
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = company_partners.company_id
      AND c.firm_id = app_current_firm_id()
  )
);

-- Certificates are visible to permitted users but writable only by staff;
-- physical deletion is reserved for firm owners.
DROP POLICY IF EXISTS digital_certificates_select ON digital_certificates;
DROP POLICY IF EXISTS digital_certificates_write ON digital_certificates;
CREATE POLICY digital_certificates_select_scoped
ON digital_certificates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = digital_certificates.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
);

CREATE POLICY digital_certificates_insert_staff
ON digital_certificates
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = digital_certificates.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
);

CREATE POLICY digital_certificates_update_staff
ON digital_certificates
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = digital_certificates.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = digital_certificates.company_id
      AND c.firm_id = app_current_firm_id()
      AND app_user_can_access_company(c.id)
  )
);

CREATE POLICY digital_certificates_delete_owner
ON digital_certificates
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = digital_certificates.company_id
      AND c.firm_id = app_current_firm_id()
  )
);

-- Clients and child records keep their firm and company boundaries on writes.
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_write_staff_only ON clients;
CREATE POLICY clients_select_scoped
ON clients
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND app_user_can_access_company(company_id)
);

CREATE POLICY clients_insert_staff
ON clients
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = clients.company_id
        AND c.firm_id = app_current_firm_id()
    )
  )
);

CREATE POLICY clients_update_staff
ON clients
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = clients.company_id
        AND c.firm_id = app_current_firm_id()
    )
  )
);

CREATE POLICY clients_delete_owner
ON clients
FOR DELETE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() = 'firm_owner'
);

DROP POLICY IF EXISTS client_contacts_via_client ON client_contacts;
CREATE POLICY client_contacts_select_staff
ON client_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_contacts.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_contacts_insert_staff
ON client_contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_contacts.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_contacts_update_staff
ON client_contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_contacts.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_contacts.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_contacts_delete_owner
ON client_contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_contacts.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_current_role() = 'firm_owner'
  )
);

DROP POLICY IF EXISTS client_documents_via_client ON client_documents;
CREATE POLICY client_documents_select_staff
ON client_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_documents_insert_staff
ON client_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_documents_update_staff
ON client_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_documents_delete_owner
ON client_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_current_role() = 'firm_owner'
  )
);

DROP POLICY IF EXISTS client_history_via_client ON client_history_entries;
CREATE POLICY client_history_select_staff
ON client_history_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_history_entries.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_history_insert_staff
ON client_history_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_history_entries.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_history_update_staff
ON client_history_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_history_entries.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_history_entries.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND app_current_role() IN ('firm_owner', 'accountant')
  )
);
CREATE POLICY client_history_delete_owner
ON client_history_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = client_history_entries.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_current_role() = 'firm_owner'
  )
);

-- Fiscal records and invoices inherit assigned-company scope. Only firm
-- owners may physically delete them or their line items.
DROP POLICY IF EXISTS tax_obligations_select ON tax_obligations;
DROP POLICY IF EXISTS tax_obligations_write_staff_only ON tax_obligations;
CREATE POLICY tax_obligations_select_scoped
ON tax_obligations
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND app_user_can_access_company(company_id)
);
CREATE POLICY tax_obligations_insert_staff
ON tax_obligations
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = tax_obligations.company_id
      AND c.firm_id = app_current_firm_id()
  )
);
CREATE POLICY tax_obligations_update_staff
ON tax_obligations
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = tax_obligations.company_id
      AND c.firm_id = app_current_firm_id()
  )
);
CREATE POLICY tax_obligations_delete_owner
ON tax_obligations
FOR DELETE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() = 'firm_owner'
);

DROP POLICY IF EXISTS invoices_select ON invoices;
DROP POLICY IF EXISTS invoices_write_staff_only ON invoices;
CREATE POLICY invoices_select_scoped
ON invoices
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND app_user_can_access_company(company_id)
);
CREATE POLICY invoices_insert_staff
ON invoices
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = invoices.company_id
      AND c.firm_id = app_current_firm_id()
  )
);
CREATE POLICY invoices_update_staff
ON invoices
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = invoices.company_id
      AND c.firm_id = app_current_firm_id()
  )
);
CREATE POLICY invoices_delete_owner
ON invoices
FOR DELETE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() = 'firm_owner'
);

DROP POLICY IF EXISTS invoice_items_select ON invoice_items;
DROP POLICY IF EXISTS invoice_items_write_staff_only ON invoice_items;
CREATE POLICY invoice_items_select_scoped
ON invoice_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.firm_id = app_current_firm_id()
      AND app_user_can_access_company(i.company_id)
  )
);
CREATE POLICY invoice_items_insert_staff
ON invoice_items
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.firm_id = app_current_firm_id()
      AND app_user_can_access_company(i.company_id)
  )
);
CREATE POLICY invoice_items_update_staff
ON invoice_items
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.firm_id = app_current_firm_id()
      AND app_user_can_access_company(i.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.firm_id = app_current_firm_id()
      AND app_user_can_access_company(i.company_id)
  )
);
CREATE POLICY invoice_items_delete_owner
ON invoice_items
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_items.invoice_id
      AND i.firm_id = app_current_firm_id()
  )
);

-- Portal reads follow company assignments; accounting staff writes remain
-- limited to the assigned portfolio.
DROP POLICY IF EXISTS portal_documents_select ON portal_documents;
DROP POLICY IF EXISTS portal_documents_write_staff_only ON portal_documents;
CREATE POLICY portal_documents_select_scoped
ON portal_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
);
CREATE POLICY portal_documents_insert_staff
ON portal_documents
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
);
CREATE POLICY portal_documents_update_staff
ON portal_documents
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_documents.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
);
CREATE POLICY portal_documents_delete_owner
ON portal_documents
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_documents.client_id
      AND cl.firm_id = app_current_firm_id()
  )
);

DROP POLICY IF EXISTS portal_guides_select ON portal_guides;
DROP POLICY IF EXISTS portal_guides_update_by_client ON portal_guides;
DROP POLICY IF EXISTS portal_guides_write_staff_only ON portal_guides;
CREATE POLICY portal_guides_select_scoped
ON portal_guides
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
);
CREATE POLICY portal_guides_insert_staff
ON portal_guides
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND (
        portal_guides.tax_obligation_id IS NULL
        OR EXISTS (
          SELECT 1 FROM tax_obligations o
          WHERE o.id = portal_guides.tax_obligation_id
            AND o.firm_id = app_current_firm_id()
            AND o.company_id IS NOT DISTINCT FROM cl.company_id
        )
      )
  )
);
CREATE POLICY portal_guides_update_staff
ON portal_guides
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND (
        portal_guides.tax_obligation_id IS NULL
        OR EXISTS (
          SELECT 1 FROM tax_obligations o
          WHERE o.id = portal_guides.tax_obligation_id
            AND o.firm_id = app_current_firm_id()
            AND o.company_id IS NOT DISTINCT FROM cl.company_id
        )
      )
  )
);
CREATE POLICY portal_guides_update_manager
ON portal_guides
FOR UPDATE
USING (
  app_current_role() = 'company_manager'
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_manage_company(cl.company_id)
  )
)
WITH CHECK (
  app_current_role() = 'company_manager'
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_manage_company(cl.company_id)
      AND (
        tax_obligation_id IS NULL
        OR EXISTS (
          SELECT 1 FROM tax_obligations o
          WHERE o.id = portal_guides.tax_obligation_id
            AND o.firm_id = app_current_firm_id()
            AND o.company_id IS NOT DISTINCT FROM cl.company_id
        )
      )
  )
);
CREATE POLICY portal_guides_delete_owner
ON portal_guides
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_guides.client_id
      AND cl.firm_id = app_current_firm_id()
  )
);

CREATE OR REPLACE FUNCTION guard_portal_guide_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF app_is_privileged_database_role()
     OR app_current_role() IN ('firm_owner', 'accountant') THEN
    RETURN NEW;
  END IF;

  IF app_current_role() = 'company_manager'
     AND (to_jsonb(NEW) - ARRAY['pago', 'paid_at', 'updated_at'])
         IS NOT DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['pago', 'paid_at', 'updated_at'])
     AND NEW.pago IS TRUE
     AND EXISTS (
       SELECT 1 FROM clients cl
       WHERE cl.id = OLD.client_id
         AND cl.firm_id = app_current_firm_id()
         AND app_user_can_manage_company(cl.company_id)
     ) THEN
    NEW.paid_at := now();
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Somente equipe autorizada pode alterar estes campos da guia'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_guides_guard_update ON portal_guides;
CREATE TRIGGER trg_portal_guides_guard_update
BEFORE UPDATE ON portal_guides
FOR EACH ROW
EXECUTE FUNCTION guard_portal_guide_update();

DROP POLICY IF EXISTS portal_messages_select ON portal_messages;
DROP POLICY IF EXISTS portal_messages_insert ON portal_messages;
CREATE POLICY portal_messages_select_scoped
ON portal_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_messages.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
  )
);
CREATE POLICY portal_messages_insert_scoped
ON portal_messages
FOR INSERT
WITH CHECK (
  sender_user_id = app_current_user_id()
  AND EXISTS (
    SELECT 1 FROM clients cl
    WHERE cl.id = portal_messages.client_id
      AND cl.firm_id = app_current_firm_id()
      AND app_user_can_access_company(cl.company_id)
      AND (
        (
          app_current_role() IN ('firm_owner', 'accountant')
          AND remetente = 'escritorio'
        )
        OR (
          app_current_role() IN ('company_manager', 'company_user')
          AND remetente = 'cliente'
        )
      )
  )
);

-- HR read/write policies retain firm and assigned-company scope. Destructive
-- operations are owner-only, matching the role matrix in migration 012.
DROP POLICY IF EXISTS hr_departments_tenant_isolation ON hr_departments;
DROP POLICY IF EXISTS hr_employees_tenant_isolation ON hr_employees;
DROP POLICY IF EXISTS hr_employee_documents_tenant_isolation ON hr_employee_documents;
DROP POLICY IF EXISTS hr_vacations_tenant_isolation ON hr_vacations;
DROP POLICY IF EXISTS hr_leaves_tenant_isolation ON hr_leaves;
DROP POLICY IF EXISTS hr_departments_select_access ON hr_departments;
DROP POLICY IF EXISTS hr_departments_insert_staff ON hr_departments;
DROP POLICY IF EXISTS hr_departments_update_staff ON hr_departments;
DROP POLICY IF EXISTS hr_departments_delete_staff ON hr_departments;
DROP POLICY IF EXISTS hr_employees_select_access ON hr_employees;
DROP POLICY IF EXISTS hr_employees_insert_staff ON hr_employees;
DROP POLICY IF EXISTS hr_employees_update_staff ON hr_employees;
DROP POLICY IF EXISTS hr_employees_delete_staff ON hr_employees;
DROP POLICY IF EXISTS hr_employee_documents_select_access ON hr_employee_documents;
DROP POLICY IF EXISTS hr_employee_documents_insert_staff ON hr_employee_documents;
DROP POLICY IF EXISTS hr_employee_documents_update_staff ON hr_employee_documents;
DROP POLICY IF EXISTS hr_employee_documents_delete_staff ON hr_employee_documents;
DROP POLICY IF EXISTS hr_vacations_select_access ON hr_vacations;
DROP POLICY IF EXISTS hr_vacations_insert_staff ON hr_vacations;
DROP POLICY IF EXISTS hr_vacations_update_staff ON hr_vacations;
DROP POLICY IF EXISTS hr_vacations_delete_staff ON hr_vacations;
DROP POLICY IF EXISTS hr_leaves_select_access ON hr_leaves;
DROP POLICY IF EXISTS hr_leaves_insert_staff ON hr_leaves;
DROP POLICY IF EXISTS hr_leaves_update_staff ON hr_leaves;
DROP POLICY IF EXISTS hr_leaves_delete_staff ON hr_leaves;

CREATE POLICY hr_departments_select_scoped
ON hr_departments
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND app_user_can_access_company(company_id)
);
CREATE POLICY hr_departments_insert_staff
ON hr_departments
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = hr_departments.company_id
      AND c.firm_id = app_current_firm_id()
  )
);
CREATE POLICY hr_departments_update_staff
ON hr_departments
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = hr_departments.company_id
      AND c.firm_id = app_current_firm_id()
  )
);
CREATE POLICY hr_departments_delete_owner
ON hr_departments
FOR DELETE
USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');

CREATE POLICY hr_employees_select_scoped
ON hr_employees
FOR SELECT
USING (
  firm_id = app_current_firm_id()
  AND app_user_can_access_company(company_id)
);
CREATE POLICY hr_employees_insert_staff
ON hr_employees
FOR INSERT
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = hr_employees.company_id
      AND c.firm_id = app_current_firm_id()
  )
  AND (
    department_id IS NULL
    OR EXISTS (
      SELECT 1 FROM hr_departments d
      WHERE d.id = hr_employees.department_id
        AND d.company_id = hr_employees.company_id
        AND d.firm_id = app_current_firm_id()
    )
  )
);
CREATE POLICY hr_employees_update_staff
ON hr_employees
FOR UPDATE
USING (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
)
WITH CHECK (
  firm_id = app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND app_user_can_access_company(company_id)
  AND EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = hr_employees.company_id
      AND c.firm_id = app_current_firm_id()
  )
  AND (
    department_id IS NULL
    OR EXISTS (
      SELECT 1 FROM hr_departments d
      WHERE d.id = hr_employees.department_id
        AND d.company_id = hr_employees.company_id
        AND d.firm_id = app_current_firm_id()
    )
  )
);
CREATE POLICY hr_employees_delete_owner
ON hr_employees
FOR DELETE
USING (firm_id = app_current_firm_id() AND app_current_role() = 'firm_owner');

CREATE POLICY hr_employee_documents_select_scoped
ON hr_employee_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_employee_documents_insert_staff
ON hr_employee_documents
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_employee_documents_update_staff
ON hr_employee_documents
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_employee_documents_delete_owner
ON hr_employee_documents
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = app_current_firm_id()
  )
);

CREATE POLICY hr_vacations_select_scoped
ON hr_vacations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_vacations_insert_staff
ON hr_vacations
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_vacations_update_staff
ON hr_vacations
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_vacations_delete_owner
ON hr_vacations
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = app_current_firm_id()
  )
);

CREATE POLICY hr_leaves_select_scoped
ON hr_leaves
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_leaves_insert_staff
ON hr_leaves
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_leaves_update_staff
ON hr_leaves
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = app_current_firm_id()
      AND app_user_can_access_company(e.company_id)
  )
);
CREATE POLICY hr_leaves_delete_owner
ON hr_leaves
FOR DELETE
USING (
  app_current_role() = 'firm_owner'
  AND EXISTS (
    SELECT 1 FROM hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = app_current_firm_id()
  )
);

-- Audit rows are written by trusted row triggers, not directly by the app role.
-- Schema-qualify application tables so SECURITY DEFINER functions need not
-- trust the writable public or temporary schemas in their search_path.
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid;
  v_firm uuid;
BEGIN
  BEGIN
    v_actor := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    BEGIN
      v_firm := (to_jsonb(NEW) ->> 'firm_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_firm := NULL;
    END;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, new_values)
    VALUES (v_firm, v_actor, 'insert', TG_TABLE_NAME, (to_jsonb(NEW) ->> 'id')::uuid, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN
      v_firm := (to_jsonb(NEW) ->> 'firm_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_firm := NULL;
    END;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values)
    VALUES (v_firm, v_actor, 'update', TG_TABLE_NAME, (to_jsonb(NEW) ->> 'id')::uuid, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      v_firm := (to_jsonb(OLD) ->> 'firm_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_firm := NULL;
    END;
    INSERT INTO public.audit_logs (firm_id, actor_user_id, action, entity_table, entity_id, old_values)
    VALUES (v_firm, v_actor, 'delete', TG_TABLE_NAME, (to_jsonb(OLD) ->> 'id')::uuid, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION audit_digital_certificates_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor uuid;
  v_firm uuid;
BEGIN
  BEGIN
    v_actor := current_setting('app.current_user_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

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

CREATE OR REPLACE FUNCTION audit_users_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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

ALTER FUNCTION audit_trigger_fn() SECURITY DEFINER;
ALTER FUNCTION audit_trigger_fn() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION audit_digital_certificates_trigger_fn() SECURITY DEFINER;
ALTER FUNCTION audit_digital_certificates_trigger_fn() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION audit_users_trigger_fn() SECURITY DEFINER;
ALTER FUNCTION audit_users_trigger_fn() SET search_path = pg_catalog, pg_temp;
REVOKE INSERT ON audit_logs FROM mil_app;
