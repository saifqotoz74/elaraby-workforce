-- ============================================================================
-- Elaraby Connect — Enterprise Migration 002: Extended Multi-Tenant Domains
-- Domains: Loans, Attendance Punches, Overtime Requests, Fleet Bus Routes & Bookings
-- Standards: Strict Referential Integrity, Multi-Column Indexes, Check Constraints, RLS
-- ============================================================================

-- Record Migration
INSERT INTO schema_migrations (version, name)
VALUES (2, '002_multi_tenant_extended_domains')
ON CONFLICT (version) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. Loans & Salary Advances Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reference_number VARCHAR(64) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('emergency_advance', 'social_loan')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    remaining_balance NUMERIC(12, 2) NOT NULL CHECK (remaining_balance >= 0),
    installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count > 0),
    paid_installments_count INTEGER NOT NULL DEFAULT 0 CHECK (paid_installments_count >= 0),
    monthly_installment NUMERIC(12, 2) NOT NULL CHECK (monthly_installment > 0),
    purpose VARCHAR(255) DEFAULT 'general',
    notes TEXT,
    currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'rejected', 'cancelled')),
    idempotency_key VARCHAR(128) UNIQUE,
    repayment_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loans_tenant_employee ON loans (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant_status ON loans (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_ref_num ON loans (reference_number);

-- ----------------------------------------------------------------------------
-- 2. Attendance Punches Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_punches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    punch_type VARCHAR(20) NOT NULL CHECK (punch_type IN ('check_in', 'check_out')),
    punched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lat NUMERIC(10, 6),
    lng NUMERIC(10, 6),
    geofence_id VARCHAR(100),
    is_out_of_bounds BOOLEAN NOT NULL DEFAULT FALSE,
    distance_meters INTEGER DEFAULT 0,
    verification_mode VARCHAR(50) NOT NULL DEFAULT 'gps' CHECK (verification_mode IN ('gps', 'qr', 'biometric', 'remote', 'manual')),
    device_id VARCHAR(128),
    ip_address VARCHAR(45),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_punches_tenant_emp_time ON attendance_punches (tenant_id, employee_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_punches_tenant_time ON attendance_punches (tenant_id, punched_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Overtime Requests Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS overtime_requests (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    hours NUMERIC(4, 2) NOT NULL CHECK (hours > 0),
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_overtime_tenant_emp ON overtime_requests (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_tenant_status ON overtime_requests (tenant_id, status);

-- ----------------------------------------------------------------------------
-- 4. Bus Fleet Routes Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_routes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    destination_complex VARCHAR(100) NOT NULL,
    destination_ar VARCHAR(255),
    vehicle_plate VARCHAR(50),
    vehicle_plate_en VARCHAR(50),
    bus_model VARCHAR(100),
    capacity INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
    driver_id VARCHAR(64),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    shift_id VARCHAR(50) DEFAULT 'morning',
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bus_routes_tenant_active ON bus_routes (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bus_routes_code ON bus_routes (tenant_id, code);

-- ----------------------------------------------------------------------------
-- 5. Bus Stops Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_stops (
    id VARCHAR(64) PRIMARY KEY,
    route_id VARCHAR(64) NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    lat NUMERIC(10, 6) NOT NULL,
    lng NUMERIC(10, 6) NOT NULL,
    scheduled_time VARCHAR(20) NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 1 CHECK (order_num > 0)
);

CREATE INDEX IF NOT EXISTS idx_bus_stops_route_order ON bus_stops (route_id, order_num ASC);

-- ----------------------------------------------------------------------------
-- 6. Bus Bookings Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_bookings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    route_id VARCHAR(64) NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    stop_id VARCHAR(64) REFERENCES bus_stops(id) ON DELETE SET NULL,
    direction VARCHAR(20) NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound', 'round_trip')),
    booking_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'boarded', 'no_show')),
    scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bus_bookings_tenant_emp ON bus_bookings (tenant_id, employee_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bus_bookings_tenant_route ON bus_bookings (tenant_id, route_id, booking_date);

-- ----------------------------------------------------------------------------
-- 7. Row Level Security & Defense-in-Depth Policies
-- ----------------------------------------------------------------------------
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans FORCE ROW LEVEL SECURITY;

ALTER TABLE attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_punches FORCE ROW LEVEL SECURITY;

ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_routes FORCE ROW LEVEL SECURITY;

ALTER TABLE bus_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_bookings FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS tenant_isolation_loans ON loans;
    DROP POLICY IF EXISTS tenant_isolation_attendance ON attendance_punches;
    DROP POLICY IF EXISTS tenant_isolation_overtime ON overtime_requests;
    DROP POLICY IF EXISTS tenant_isolation_bus_routes ON bus_routes;
    DROP POLICY IF EXISTS tenant_isolation_bus_bookings ON bus_bookings;

    CREATE POLICY tenant_isolation_loans ON loans
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_attendance ON attendance_punches
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_overtime ON overtime_requests
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    -- Bus routes allow shared consortium routes across tenants when is_shared = true
    CREATE POLICY tenant_isolation_bus_routes ON bus_routes
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR is_shared = TRUE
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_bus_bookings ON bus_bookings
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
