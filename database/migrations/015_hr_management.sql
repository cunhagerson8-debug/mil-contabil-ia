-- ============================================================
-- 015_hr_management.sql
-- MIL Contábil IA - Gestão de RH
-- ============================================================

-- ------------------------------------------------------------
-- Departamentos / Setores
-- ------------------------------------------------------------

CREATE TABLE hr_departments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id     uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_departments_firm
    ON hr_departments(firm_id);

CREATE INDEX idx_hr_departments_company
    ON hr_departments(company_id);


-- ------------------------------------------------------------
-- Colaboradores
-- ------------------------------------------------------------

CREATE TABLE hr_employees (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id         uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id   uuid REFERENCES hr_departments(id) ON DELETE SET NULL,

    name            text NOT NULL,
    cpf             text NOT NULL,
    email           text,
    phone           text,

    job_title       text,
    registration    text,

    admission_date  date NOT NULL,
    termination_date date,

    salary          numeric(14,2),

    employment_type text NOT NULL DEFAULT 'clt',

    status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN (
                        'active',
                        'vacation',
                        'leave',
                        'terminated'
                    )),

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,

    CONSTRAINT uq_hr_employee_cpf_per_firm
        UNIQUE (firm_id, cpf)
);

CREATE INDEX idx_hr_employees_firm
    ON hr_employees(firm_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_hr_employees_company
    ON hr_employees(company_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_hr_employees_status
    ON hr_employees(company_id, status)
    WHERE deleted_at IS NULL;


-- ------------------------------------------------------------
-- Documentos dos colaboradores
-- ------------------------------------------------------------

CREATE TABLE hr_employee_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,

    document_type   text NOT NULL,
    document_name   text NOT NULL,
    file_url        text,

    expiration_date date,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending',
                        'valid',
                        'expired'
                    )),

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_employee_documents_employee
    ON hr_employee_documents(employee_id);

CREATE INDEX idx_hr_employee_documents_expiration
    ON hr_employee_documents(expiration_date);


-- ------------------------------------------------------------
-- Férias
-- ------------------------------------------------------------

CREATE TABLE hr_vacations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,

    acquisition_start date NOT NULL,
    acquisition_end   date NOT NULL,

    vacation_start    date,
    vacation_end      date,

    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending',
                        'scheduled',
                        'in_progress',
                        'completed',
                        'cancelled'
                    )),

    notes           text,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_vacations_employee
    ON hr_vacations(employee_id);

CREATE INDEX idx_hr_vacations_start
    ON hr_vacations(vacation_start);


-- ------------------------------------------------------------
-- Afastamentos
-- ------------------------------------------------------------

CREATE TABLE hr_leaves (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,

    leave_type      text NOT NULL,
    start_date      date NOT NULL,
    end_date        date,

    reason          text,
    document_url    text,

    status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN (
                        'scheduled',
                        'active',
                        'completed',
                        'cancelled'
                    )),

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_leaves_employee
    ON hr_leaves(employee_id);

CREATE INDEX idx_hr_leaves_dates
    ON hr_leaves(start_date, end_date);


-- ------------------------------------------------------------
-- Comentários
-- ------------------------------------------------------------

COMMENT ON TABLE hr_departments IS
    'Departamentos e setores das empresas atendidas pelo escritório';

COMMENT ON TABLE hr_employees IS
    'Colaboradores das empresas atendidas pelo escritório';

COMMENT ON TABLE hr_employee_documents IS
    'Documentos vinculados aos colaboradores';

COMMENT ON TABLE hr_vacations IS
    'Controle de períodos aquisitivos e férias dos colaboradores';

COMMENT ON TABLE hr_leaves IS
    'Controle de afastamentos dos colaboradores';
    -- ============================================================
-- Segurança RLS - Gestão de RH
-- ============================================================

ALTER TABLE hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_leaves ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- Departamentos
-- ------------------------------------------------------------

CREATE POLICY hr_departments_tenant_isolation
ON hr_departments
USING (
    firm_id = app_current_firm_id()
)
WITH CHECK (
    firm_id = app_current_firm_id()
);


-- ------------------------------------------------------------
-- Colaboradores
-- ------------------------------------------------------------

CREATE POLICY hr_employees_tenant_isolation
ON hr_employees
USING (
    firm_id = app_current_firm_id()
)
WITH CHECK (
    firm_id = app_current_firm_id()
);


-- ------------------------------------------------------------
-- Documentos dos colaboradores
-- ------------------------------------------------------------

CREATE POLICY hr_employee_documents_tenant_isolation
ON hr_employee_documents
USING (
    EXISTS (
        SELECT 1
        FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM hr_employees e
        WHERE e.id = hr_employee_documents.employee_id
          AND e.firm_id = app_current_firm_id()
    )
);


-- ------------------------------------------------------------
-- Férias
-- ------------------------------------------------------------

CREATE POLICY hr_vacations_tenant_isolation
ON hr_vacations
USING (
    EXISTS (
        SELECT 1
        FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM hr_employees e
        WHERE e.id = hr_vacations.employee_id
          AND e.firm_id = app_current_firm_id()
    )
);


-- ------------------------------------------------------------
-- Afastamentos
-- ------------------------------------------------------------

CREATE POLICY hr_leaves_tenant_isolation
ON hr_leaves
USING (
    EXISTS (
        SELECT 1
        FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM hr_employees e
        WHERE e.id = hr_leaves.employee_id
          AND e.firm_id = app_current_firm_id()
    )
);