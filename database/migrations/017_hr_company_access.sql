-- ============================================================
-- 017_hr_company_access.sql
-- Restringe leitura de RH por empresa e mantém escrita somente para equipe.
-- ============================================================

DROP POLICY hr_departments_tenant_isolation ON hr_departments;
DROP POLICY hr_employees_tenant_isolation ON hr_employees;
DROP POLICY hr_employee_documents_tenant_isolation ON hr_employee_documents;
DROP POLICY hr_vacations_tenant_isolation ON hr_vacations;
DROP POLICY hr_leaves_tenant_isolation ON hr_leaves;

CREATE POLICY hr_departments_select_access
ON hr_departments
FOR SELECT
USING (
    firm_id = app_current_firm_id()
    AND (
        app_current_role() IN ('firm_owner', 'accountant')
        OR app_user_has_company_access(company_id)
    )
);

CREATE POLICY hr_departments_insert_staff
ON hr_departments
FOR INSERT
WITH CHECK (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner', 'accountant')
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
)
WITH CHECK (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner', 'accountant')
    AND EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = hr_departments.company_id
          AND c.firm_id = app_current_firm_id()
    )
);

CREATE POLICY hr_departments_delete_staff
ON hr_departments
FOR DELETE
USING (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner', 'accountant')
);

CREATE POLICY hr_employees_select_access
ON hr_employees
FOR SELECT
USING (
    firm_id = app_current_firm_id()
    AND (
        app_current_role() IN ('firm_owner', 'accountant')
        OR app_user_has_company_access(company_id)
    )
);

CREATE POLICY hr_employees_insert_staff
ON hr_employees
FOR INSERT
WITH CHECK (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner', 'accountant')
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
)
WITH CHECK (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner', 'accountant')
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

CREATE POLICY hr_employees_delete_staff
ON hr_employees
FOR DELETE
USING (
    firm_id = app_current_firm_id()
    AND app_current_role() IN ('firm_owner', 'accountant')
);

CREATE POLICY hr_employee_documents_select_access
ON hr_employee_documents
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
          AND (
              app_current_role() IN ('firm_owner', 'accountant')
              OR app_user_has_company_access(e.company_id)
          )
    )
);

CREATE POLICY hr_employee_documents_insert_staff
ON hr_employee_documents
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_employee_documents_update_staff
ON hr_employee_documents
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_employee_documents_delete_staff
ON hr_employee_documents
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_vacations_select_access
ON hr_vacations
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
          AND (
              app_current_role() IN ('firm_owner', 'accountant')
              OR app_user_has_company_access(e.company_id)
          )
    )
);

CREATE POLICY hr_vacations_insert_staff
ON hr_vacations
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_vacations_update_staff
ON hr_vacations
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_vacations_delete_staff
ON hr_vacations
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_leaves_select_access
ON hr_leaves
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
          AND (
              app_current_role() IN ('firm_owner', 'accountant')
              OR app_user_has_company_access(e.company_id)
          )
    )
);

CREATE POLICY hr_leaves_insert_staff
ON hr_leaves
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_leaves_update_staff
ON hr_leaves
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

CREATE POLICY hr_leaves_delete_staff
ON hr_leaves
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
          AND app_current_role() IN ('firm_owner', 'accountant')
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
    hr_departments,
    hr_employees,
    hr_employee_documents,
    hr_vacations,
    hr_leaves
TO mil_app;

GRANT ALL ON
    hr_departments,
    hr_employees,
    hr_employee_documents,
    hr_vacations,
    hr_leaves
TO mil_platform_admin;
