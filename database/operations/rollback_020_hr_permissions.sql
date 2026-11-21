-- Manual rollback for 020_hr_permissions.sql.
-- Do not put this file in database/migrations: the migration runner auto-runs
-- every .sql file in that directory.
-- Run only after stopping the updated API and only when no HR grants remain.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_company_hr_permissions) THEN
    RAISE EXCEPTION
      'Rollback blocked: export or revoke every company-specific HR grant first.';
  END IF;
END;
$$;

ALTER TABLE public.hr_employees
  ADD COLUMN cpf text,
  ADD COLUMN salary numeric(14,2);

UPDATE public.hr_employees e
SET cpf = s.cpf,
    salary = s.salary
FROM public.hr_employee_sensitive_data s
WHERE s.employee_id = e.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.hr_employees WHERE cpf IS NULL) THEN
    RAISE EXCEPTION 'Rollback blocked: sensitive employee data is incomplete.';
  END IF;
END;
$$;

ALTER TABLE public.hr_employees
  ALTER COLUMN cpf SET NOT NULL,
  ADD CONSTRAINT uq_hr_employee_cpf_per_firm UNIQUE (firm_id, cpf);

DROP POLICY IF EXISTS hr_departments_select_scoped ON public.hr_departments;
CREATE POLICY hr_departments_select_rollback_staff
ON public.hr_departments
FOR SELECT
USING (
  firm_id = public.app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND public.app_user_can_access_company(company_id)
);

DROP POLICY IF EXISTS hr_employees_select_scoped ON public.hr_employees;
CREATE POLICY hr_employees_select_rollback_staff
ON public.hr_employees
FOR SELECT
USING (
  firm_id = public.app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND public.app_user_can_access_company(company_id)
);

DROP POLICY IF EXISTS hr_employees_insert_staff ON public.hr_employees;
CREATE POLICY hr_employees_insert_rollback_staff
ON public.hr_employees
FOR INSERT
WITH CHECK (
  firm_id = public.app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND public.app_user_can_access_company(company_id)
);

DROP POLICY IF EXISTS hr_employees_update_staff ON public.hr_employees;
CREATE POLICY hr_employees_update_rollback_staff
ON public.hr_employees
FOR UPDATE
USING (
  firm_id = public.app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND public.app_user_can_access_company(company_id)
)
WITH CHECK (
  firm_id = public.app_current_firm_id()
  AND app_current_role() IN ('firm_owner', 'accountant')
  AND public.app_user_can_access_company(company_id)
);

DROP POLICY IF EXISTS hr_employee_documents_select_scoped ON public.hr_employee_documents;
CREATE POLICY hr_employee_documents_select_rollback_staff
ON public.hr_employee_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND app_current_role() IN ('firm_owner', 'accountant')
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_employee_documents_insert_staff ON public.hr_employee_documents;
CREATE POLICY hr_employee_documents_insert_rollback_staff
ON public.hr_employee_documents
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_employee_documents_update_staff ON public.hr_employee_documents;
CREATE POLICY hr_employee_documents_update_rollback_staff
ON public.hr_employee_documents
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_employee_documents.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_vacations_select_scoped ON public.hr_vacations;
CREATE POLICY hr_vacations_select_rollback_staff
ON public.hr_vacations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND app_current_role() IN ('firm_owner', 'accountant')
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_vacations_insert_staff ON public.hr_vacations;
CREATE POLICY hr_vacations_insert_rollback_staff
ON public.hr_vacations
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_vacations_update_staff ON public.hr_vacations;
CREATE POLICY hr_vacations_update_rollback_staff
ON public.hr_vacations
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_vacations.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_leaves_select_scoped ON public.hr_leaves;
CREATE POLICY hr_leaves_select_rollback_staff
ON public.hr_leaves
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND app_current_role() IN ('firm_owner', 'accountant')
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_leaves_insert_staff ON public.hr_leaves;
CREATE POLICY hr_leaves_insert_rollback_staff
ON public.hr_leaves
FOR INSERT
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
);

DROP POLICY IF EXISTS hr_leaves_update_staff ON public.hr_leaves;
CREATE POLICY hr_leaves_update_rollback_staff
ON public.hr_leaves
FOR UPDATE
USING (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
)
WITH CHECK (
  app_current_role() IN ('firm_owner', 'accountant')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = hr_leaves.employee_id
      AND e.firm_id = public.app_current_firm_id()
      AND public.app_user_can_access_company(e.company_id)
  )
);

REVOKE SELECT ON public.hr_employees FROM PUBLIC, mil_app;
REVOKE SELECT (
  id, firm_id, company_id, department_id, name, email, phone, job_title,
  registration, admission_date, termination_date, employment_type, status,
  created_at, updated_at, deleted_at
) ON public.hr_employees FROM mil_app;
GRANT SELECT ON public.hr_employees TO mil_app;

DROP TRIGGER IF EXISTS trg_hr_company_permissions_audit ON public.user_company_hr_permissions;
DROP FUNCTION IF EXISTS public.hr_company_permissions_audit_trigger();
DROP FUNCTION IF EXISTS public.app_user_has_hr_permission(uuid, text);
DROP TABLE public.user_company_hr_permissions;
DROP TABLE public.hr_employee_sensitive_data;
ALTER TABLE public.hr_employees DROP CONSTRAINT uq_hr_employees_tenant_key;

DELETE FROM public.schema_migrations
WHERE filename = '020_hr_permissions.sql';

COMMIT;
