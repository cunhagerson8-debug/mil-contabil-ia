-- HR permissions are independent from user_company_access and default to deny.
-- Apply together with the API release that uses hr_employee_sensitive_data.

ALTER TABLE hr_employees
  ADD CONSTRAINT uq_hr_employees_tenant_key UNIQUE (id, firm_id, company_id);

CREATE TABLE hr_employee_sensitive_data (
  employee_id uuid PRIMARY KEY,
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  cpf text NOT NULL,
  salary numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_hr_employee_sensitive_scope
    FOREIGN KEY (employee_id, firm_id, company_id)
    REFERENCES hr_employees(id, firm_id, company_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT uq_hr_employee_sensitive_cpf_per_firm UNIQUE (firm_id, cpf)
);

INSERT INTO hr_employee_sensitive_data (employee_id, firm_id, company_id, cpf, salary)
SELECT id, firm_id, company_id, cpf, salary
FROM hr_employees;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM hr_employees e
    LEFT JOIN hr_employee_sensitive_data s ON s.employee_id = e.id
    WHERE s.employee_id IS NULL OR s.cpf IS DISTINCT FROM e.cpf OR s.salary IS DISTINCT FROM e.salary
  ) THEN
    RAISE EXCEPTION 'RH sensitive-data backfill verification failed.';
  END IF;
END;
$$;

ALTER TABLE hr_employees
  DROP CONSTRAINT uq_hr_employee_cpf_per_firm,
  DROP COLUMN cpf,
  DROP COLUMN salary;

CREATE TABLE user_company_hr_permissions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  can_read_employees boolean NOT NULL DEFAULT false,
  can_read_sensitive_data boolean NOT NULL DEFAULT false,
  can_read_documents boolean NOT NULL DEFAULT false,
  can_manage_employees boolean NOT NULL DEFAULT false,
  can_manage_documents boolean NOT NULL DEFAULT false,
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id),
  CONSTRAINT chk_hr_sensitive_requires_employee_read
    CHECK (NOT can_read_sensitive_data OR can_read_employees),
  CONSTRAINT chk_hr_documents_require_employee_read
    CHECK (NOT can_read_documents OR can_read_employees),
  CONSTRAINT chk_hr_manage_requires_read
    CHECK (
      (NOT can_manage_employees OR (can_read_employees AND can_read_sensitive_data))
      AND (NOT can_manage_documents OR (can_read_employees AND can_read_documents))
    ),
  CONSTRAINT chk_hr_permission_not_empty
    CHECK (
      can_read_employees OR can_read_sensitive_data OR can_read_documents
      OR can_manage_employees OR can_manage_documents
    )
);

ALTER TABLE user_company_hr_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_hr_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_sensitive_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_sensitive_data FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_user_has_hr_permission(
  p_company_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_company_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = p_company_id
          AND c.firm_id = public.app_current_firm_id()
      )
      THEN false
    WHEN public.app_current_role() IN ('firm_owner', 'accountant')
      THEN public.app_user_can_access_company(p_company_id)
    WHEN public.app_current_role() NOT IN ('company_manager', 'company_user')
      THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_company_hr_permissions p
      WHERE p.user_id = public.app_current_user_id()
        AND p.company_id = p_company_id
        AND CASE p_permission
          WHEN 'employee.read' THEN p.can_read_employees
          WHEN 'employee.sensitive.read' THEN p.can_read_sensitive_data
          WHEN 'employee.manage' THEN p.can_manage_employees
          WHEN 'employee.documents.read' THEN p.can_read_documents
          WHEN 'employee.documents.manage' THEN p.can_manage_documents
          ELSE false
        END
    )
  END;
$$;

REVOKE ALL ON FUNCTION app_user_has_hr_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_user_has_hr_permission(uuid, text) TO mil_app;

CREATE POLICY user_company_hr_permissions_select
ON user_company_hr_permissions
FOR SELECT
USING (
  user_id = public.app_current_user_id()
  OR (
    public.app_current_role() = 'firm_owner'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = user_company_hr_permissions.company_id
        AND c.firm_id = public.app_current_firm_id()
    )
  )
  OR current_user = 'mil_platform_admin'
);

CREATE POLICY user_company_hr_permissions_insert
ON user_company_hr_permissions
FOR INSERT
WITH CHECK (
  current_user = 'mil_platform_admin'
  OR (
    public.app_current_role() = 'firm_owner'
    AND granted_by = public.app_current_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.companies c ON c.id = user_company_hr_permissions.company_id
      WHERE u.id = user_company_hr_permissions.user_id
        AND u.firm_id = public.app_current_firm_id()
        AND u.role IN ('company_manager', 'company_user')
        AND c.firm_id = public.app_current_firm_id()
    )
  )
);

CREATE POLICY user_company_hr_permissions_update
ON user_company_hr_permissions
FOR UPDATE
USING (
  current_user = 'mil_platform_admin'
  OR (
    public.app_current_role() = 'firm_owner'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.companies c ON c.id = user_company_hr_permissions.company_id
      WHERE u.id = user_company_hr_permissions.user_id
        AND u.firm_id = public.app_current_firm_id()
        AND u.role IN ('company_manager', 'company_user')
        AND c.firm_id = public.app_current_firm_id()
    )
  )
)
WITH CHECK (
  current_user = 'mil_platform_admin'
  OR (
    public.app_current_role() = 'firm_owner'
    AND granted_by = public.app_current_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.companies c ON c.id = user_company_hr_permissions.company_id
      WHERE u.id = user_company_hr_permissions.user_id
        AND u.firm_id = public.app_current_firm_id()
        AND u.role IN ('company_manager', 'company_user')
        AND c.firm_id = public.app_current_firm_id()
    )
  )
);

CREATE POLICY user_company_hr_permissions_delete
ON user_company_hr_permissions
FOR DELETE
USING (
  current_user = 'mil_platform_admin'
  OR (
    public.app_current_role() = 'firm_owner'
    AND EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.companies c ON c.id = user_company_hr_permissions.company_id
      WHERE u.id = user_company_hr_permissions.user_id
        AND u.firm_id = public.app_current_firm_id()
        AND u.role IN ('company_manager', 'company_user')
        AND c.firm_id = public.app_current_firm_id()
    )
  )
);

CREATE POLICY hr_employee_sensitive_data_select
ON hr_employee_sensitive_data
FOR SELECT
USING (
  current_user = 'mil_platform_admin'
  OR (
    firm_id = public.app_current_firm_id()
    AND public.app_user_has_hr_permission(company_id, 'employee.sensitive.read')
  )
);

CREATE POLICY hr_employee_sensitive_data_insert
ON hr_employee_sensitive_data
FOR INSERT
WITH CHECK (
  current_user = 'mil_platform_admin'
  OR (
    firm_id = public.app_current_firm_id()
    AND public.app_user_has_hr_permission(company_id, 'employee.manage')
  )
);

CREATE POLICY hr_employee_sensitive_data_update
ON hr_employee_sensitive_data
FOR UPDATE
USING (
  current_user = 'mil_platform_admin'
  OR (
    firm_id = public.app_current_firm_id()
    AND public.app_user_has_hr_permission(company_id, 'employee.manage')
  )
)
WITH CHECK (
  current_user = 'mil_platform_admin'
  OR (
    firm_id = public.app_current_firm_id()
    AND public.app_user_has_hr_permission(company_id, 'employee.manage')
  )
);

DROP POLICY IF EXISTS hr_departments_select_scoped ON hr_departments;
CREATE POLICY hr_departments_select_scoped
ON hr_departments
FOR SELECT
USING (
  firm_id = public.app_current_firm_id()
  AND public.app_user_has_hr_permission(company_id, 'employee.read')
);

DROP POLICY IF EXISTS hr_employees_select_scoped ON hr_employees;
CREATE POLICY hr_employees_select_scoped
ON hr_employees
FOR SELECT
USING (
  firm_id = public.app_current_firm_id()
  AND public.app_user_has_hr_permission(company_id, 'employee.read')
);

DROP POLICY IF EXISTS hr_employees_insert_staff ON hr_employees;
CREATE POLICY hr_employees_insert_staff
ON hr_employees
FOR INSERT
WITH CHECK (
  firm_id = public.app_current_firm_id()
  AND public.app_user_has_hr_permission(company_id, 'employee.manage')
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = hr_employees.company_id
      AND c.firm_id = public.app_current_firm_id()
  )
  AND (
    department_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.hr_departments d
      WHERE d.id = hr_employees.department_id
        AND d.company_id = hr_employees.company_id
        AND d.firm_id = public.app_current_firm_id()
    )
  )
);

DROP POLICY IF EXISTS hr_employees_update_staff ON hr_employees;
CREATE POLICY hr_employees_update_staff
ON hr_employees
FOR UPDATE
USING (
  firm_id = public.app_current_firm_id()
  AND public.app_user_has_hr_permission(company_id, 'employee.manage')
)
WITH CHECK (
  firm_id = public.app_current_firm_id()
  AND public.app_user_has_hr_permission(company_id, 'employee.manage')
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = hr_employees.company_id
      AND c.firm_id = public.app_current_firm_id()
  )
  AND (
    department_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.hr_departments d
      WHERE d.id = hr_employees.department_id
        AND d.company_id = hr_employees.company_id
        AND d.firm_id = public.app_current_firm_id()
    )
  )
);

DROP POLICY IF EXISTS hr_employee_documents_select_scoped ON hr_employee_documents;
CREATE POLICY hr_employee_documents_select_scoped
ON hr_employee_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.documents.read')
  )
);

DROP POLICY IF EXISTS hr_employee_documents_insert_staff ON hr_employee_documents;
CREATE POLICY hr_employee_documents_insert_staff
ON hr_employee_documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.documents.manage')
  )
);

DROP POLICY IF EXISTS hr_employee_documents_update_staff ON hr_employee_documents;
CREATE POLICY hr_employee_documents_update_staff
ON hr_employee_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.documents.manage')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.documents.manage')
  )
);

DROP POLICY IF EXISTS hr_vacations_select_scoped ON hr_vacations;
CREATE POLICY hr_vacations_select_scoped
ON hr_vacations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.sensitive.read')
  )
);

DROP POLICY IF EXISTS hr_vacations_insert_staff ON hr_vacations;
CREATE POLICY hr_vacations_insert_staff
ON hr_vacations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.manage')
  )
);

DROP POLICY IF EXISTS hr_vacations_update_staff ON hr_vacations;
CREATE POLICY hr_vacations_update_staff
ON hr_vacations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.manage')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.manage')
  )
);

DROP POLICY IF EXISTS hr_leaves_select_scoped ON hr_leaves;
CREATE POLICY hr_leaves_select_scoped
ON hr_leaves
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.sensitive.read')
  )
);

DROP POLICY IF EXISTS hr_leaves_insert_staff ON hr_leaves;
CREATE POLICY hr_leaves_insert_staff
ON hr_leaves
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.manage')
  )
);

DROP POLICY IF EXISTS hr_leaves_update_staff ON hr_leaves;
CREATE POLICY hr_leaves_update_staff
ON hr_leaves
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.manage')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_has_hr_permission(e.company_id, 'employee.manage')
  )
);

ALTER TABLE hr_employee_sensitive_data
  ALTER COLUMN cpf SET NOT NULL;

REVOKE SELECT ON TABLE hr_employees FROM PUBLIC, mil_app;
GRANT SELECT (
  id, firm_id, company_id, department_id, name, email, phone, job_title,
  registration, admission_date, termination_date, employment_type, status,
  created_at, updated_at, deleted_at
) ON hr_employees TO mil_app;

REVOKE ALL ON user_company_hr_permissions, hr_employee_sensitive_data FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_company_hr_permissions TO mil_app;
GRANT SELECT, INSERT, UPDATE ON hr_employee_sensitive_data TO mil_app;
GRANT ALL ON user_company_hr_permissions, hr_employee_sensitive_data TO mil_platform_admin;

CREATE OR REPLACE FUNCTION hr_company_permissions_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_firm_id uuid;
  v_user_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  v_company_id := COALESCE(NEW.company_id, OLD.company_id);
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  SELECT c.firm_id INTO v_firm_id FROM public.companies c WHERE c.id = v_company_id;

  IF TG_OP <> 'INSERT' THEN
    v_old := to_jsonb(OLD) - 'granted_by';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new := to_jsonb(NEW) - 'granted_by';
  END IF;

  INSERT INTO public.audit_logs (
    firm_id, actor_user_id, action, entity_table, entity_id, old_values, new_values
  )
  VALUES (
    v_firm_id, public.app_current_user_id(), 'permission_change',
    'user_company_hr_permissions', v_user_id, v_old, v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION hr_company_permissions_audit_trigger() FROM PUBLIC;
CREATE TRIGGER trg_hr_company_permissions_audit
AFTER INSERT OR UPDATE OR DELETE ON user_company_hr_permissions
FOR EACH ROW EXECUTE FUNCTION hr_company_permissions_audit_trigger();
