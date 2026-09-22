-- ============================================================================
-- Workforce OS — Enterprise Migration 003: HSE and Kiosk / Shop Floor Domains
-- Domains: HSE Permits, HSE Incidents, HSE PPE Inspections,
--          Machines, Work Orders, Machine Stoppages
-- Standards: Strict Multi-Tenant Referential Integrity, Composite Keys, RLS, Indexes
-- ============================================================================

-- Record Migration
INSERT INTO schema_migrations (version, name)
VALUES (3, '003_hse_and_kiosk_domains')
ON CONFLICT (version) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. HSE Permits Table (Permit to Work / تصاريح العمل)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hse_permits (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    line VARCHAR(100),
    description TEXT,
    precautions JSONB NOT NULL DEFAULT '[]'::jsonb,
    valid_until TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    reviewer VARCHAR(100),
    reason TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_permits_tenant_emp ON hse_permits (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_hse_permits_tenant_status ON hse_permits (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hse_permits_tenant_created ON hse_permits (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. HSE Incidents Table (الحوادث والبلاغات المهنية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hse_incidents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    reporter_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    line VARCHAR(100),
    severity VARCHAR(30) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    injury_reported BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_incidents_tenant_status ON hse_incidents (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hse_incidents_tenant_created ON hse_incidents (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hse_incidents_tenant_injury ON hse_incidents (tenant_id, injury_reported);

-- ----------------------------------------------------------------------------
-- 3. HSE PPE Inspections Table (فحوصات مهمات الوقاية الشخصية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hse_ppe_inspections (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    line VARCHAR(100) NOT NULL,
    checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
    compliance_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (compliance_score >= 0 AND compliance_score <= 100),
    inspector_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_ppe_tenant_line ON hse_ppe_inspections (tenant_id, line);
CREATE INDEX IF NOT EXISTS idx_hse_ppe_tenant_created ON hse_ppe_inspections (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Shop Floor Machines Table (ماكينات وخطوط الإنتاج)
-- Multiple tenants can have identical machine IDs without collision via (tenant_id, id)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    line VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'maintenance', 'idle')),
    stop_reason TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_machines_tenant_status ON machines (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_machines_tenant_line ON machines (tenant_id, line);

-- ----------------------------------------------------------------------------
-- 5. Production Work Orders Table (أوامر تشغيل الورش وخطوط الإنتاج)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_orders (
    id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    target_qty INTEGER NOT NULL CHECK (target_qty >= 0),
    completed_qty INTEGER NOT NULL DEFAULT 0 CHECK (completed_qty >= 0),
    line VARCHAR(100) NOT NULL,
    due_date VARCHAR(50),
    priority VARCHAR(30) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_status ON work_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_line ON work_orders (tenant_id, line);

-- ----------------------------------------------------------------------------
-- 6. Machine Stoppages Audit & History Table (سجل توقفات الماكينات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machine_stoppages (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    machine_id VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    employee_code VARCHAR(64),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id, machine_id) REFERENCES machines(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stoppages_tenant_machine ON machine_stoppages (tenant_id, machine_id);
CREATE INDEX IF NOT EXISTS idx_stoppages_tenant_status ON machine_stoppages (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_stoppages_tenant_reported ON machine_stoppages (tenant_id, reported_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Row Level Security & Multi-Tenant Defense-in-Depth Policies
-- ----------------------------------------------------------------------------
ALTER TABLE hse_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hse_permits FORCE ROW LEVEL SECURITY;

ALTER TABLE hse_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hse_incidents FORCE ROW LEVEL SECURITY;

ALTER TABLE hse_ppe_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hse_ppe_inspections FORCE ROW LEVEL SECURITY;

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines FORCE ROW LEVEL SECURITY;

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE machine_stoppages ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_stoppages FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS tenant_isolation_hse_permits ON hse_permits;
    DROP POLICY IF EXISTS tenant_isolation_hse_incidents ON hse_incidents;
    DROP POLICY IF EXISTS tenant_isolation_hse_ppe ON hse_ppe_inspections;
    DROP POLICY IF EXISTS tenant_isolation_machines ON machines;
    DROP POLICY IF EXISTS tenant_isolation_work_orders ON work_orders;
    DROP POLICY IF EXISTS tenant_isolation_stoppages ON machine_stoppages;

    CREATE POLICY tenant_isolation_hse_permits ON hse_permits
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_hse_incidents ON hse_incidents
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_hse_ppe ON hse_ppe_inspections
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_machines ON machines
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_work_orders ON work_orders
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_stoppages ON machine_stoppages
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );
END $$;
