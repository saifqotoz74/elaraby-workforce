-- ============================================================================
-- Elaraby Connect — Enterprise PostgreSQL Production Schema
-- Version: 1.0.0
-- Standards: Strict Referential Integrity, Multi-Column Indexes, Check Constraints
-- ============================================================================

-- Schema Version Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Monotonic Counters Table (replaces in-memory / JSON counter sequence)
CREATE TABLE IF NOT EXISTS counters (
    collection VARCHAR(64) PRIMARY KEY,
    current_value BIGINT NOT NULL DEFAULT 100
);

-- Tenants Master Configuration Table (Multi-Tenant White-Label Architecture)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(64) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_name_ar VARCHAR(255) NOT NULL,
    primary_color VARCHAR(16) NOT NULL DEFAULT '#0B63B4',
    primary_light_color VARCHAR(16) NOT NULL DEFAULT '#1D7ED6',
    primary_soft_color VARCHAR(16) NOT NULL DEFAULT '#E8F2FB',
    support_hotline VARCHAR(50) DEFAULT '19319',
    identity_mode VARCHAR(50) NOT NULL DEFAULT 'egyptian_national_id',
    logo_url VARCHAR(500),
    sms_provider VARCHAR(50) NOT NULL DEFAULT 'mock',
    sms_sender_id VARCHAR(50) NOT NULL DEFAULT 'Workforce',
    sms_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_employees INTEGER NOT NULL DEFAULT 500 CHECK (max_employees > 0),
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'enterprise',
    subscription_expires_at TIMESTAMPTZ,
    features JSONB NOT NULL DEFAULT '{"hasShifts": true, "hasPayroll": true, "hasVacations": true, "hasBuses": true, "hasBenefits": true, "hasSummerTrips": true, "hasWhistleblower": true, "hasSurveys": true, "hasMedicalNetwork": true}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Institutional Tenant
INSERT INTO tenants (id, slug, company_name, company_name_ar, primary_color, support_hotline, identity_mode)
VALUES ('elaraby', 'elaraby', 'Elaraby Group', 'مجموعة العربي', '#0B63B4', '19319', 'egyptian_national_id')
ON CONFLICT (id) DO NOTHING;

-- Employees Master Table
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE RESTRICT,
    national_id VARCHAR(64),
    phone VARCHAR(20),
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    email VARCHAR(255),
    department VARCHAR(100),
    department_en VARCHAR(100),
    job_title VARCHAR(150),
    job_title_en VARCHAR(150),
    factory VARCHAR(100),
    avatar VARCHAR(500),
    pin_hash VARCHAR(255),
    vacation_balance NUMERIC(5, 1) NOT NULL DEFAULT 21.0 CHECK (vacation_balance >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    role VARCHAR(50) NOT NULL DEFAULT 'employee',
    scope_factory VARCHAR(100),
    scope_department VARCHAR(100),
    token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version >= 1),
    hired_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_employees_tenant_national_id UNIQUE (tenant_id, national_id),
    CONSTRAINT uq_employees_tenant_phone UNIQUE (tenant_id, phone)
);

-- Employee Requests (Leave, Permission, Mission, Cancellation)
CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    ref_number VARCHAR(64) UNIQUE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'inReview' 
        CHECK (status IN ('inReview', 'pending', 'approved', 'rejected', 'cancelled')),
    days NUMERIC(5, 1) NOT NULL DEFAULT 1.0 CHECK (days > 0),
    start_date VARCHAR(30),
    end_date VARCHAR(30),
    date VARCHAR(30),
    reason TEXT,
    rejection_reason TEXT,
    decision_by VARCHAR(64),
    decided_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payroll Statements
CREATE TABLE IF NOT EXISTS payroll (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
    breakdown JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'published',
    published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payroll_emp_month_year UNIQUE (employee_id, month, year)
);

-- Weekly Shift Rosters
CREATE TABLE IF NOT EXISTS roster (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start VARCHAR(30) NOT NULL,
    shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_roster_emp_week UNIQUE (employee_id, week_start)
);

-- Corporate Trips Catalog & Bookings
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    destination VARCHAR(255),
    date VARCHAR(50),
    seats_total INTEGER NOT NULL DEFAULT 50 CHECK (seats_total >= 0),
    booked_employee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Corporate Benefits Catalog
CREATE TABLE IF NOT EXISTS benefits (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    category VARCHAR(100),
    discount VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Corporate Announcements
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    body TEXT NOT NULL,
    body_en TEXT,
    date VARCHAR(50),
    author VARCHAR(100),
    category VARCHAR(50),
    target_factory VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- News Feed
CREATE TABLE IF NOT EXISTS news (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    body TEXT NOT NULL,
    body_en TEXT,
    image_url VARCHAR(500),
    date VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Targeted Employee Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    body TEXT NOT NULL,
    body_en TEXT,
    category VARCHAR(50),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Anonymous Workplace Concerns / Whistleblower System
CREATE TABLE IF NOT EXISTS concerns (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby' REFERENCES tenants(id) ON DELETE CASCADE,
    ref_number VARCHAR(64) UNIQUE,
    category VARCHAR(100),
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    attachment_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Security & HR Audit Log Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'elaraby',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor VARCHAR(100),
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    target VARCHAR(100),
    details JSONB DEFAULT '{}'::jsonb,
    ip VARCHAR(50),
    factory VARCHAR(100)
);

-- Push Notification Device Tokens
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Synchronized App Version Configuration
CREATE TABLE IF NOT EXISTS app_version_config (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'current',
    min_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    latest_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    current_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    force_update BOOLEAN NOT NULL DEFAULT FALSE,
    title VARCHAR(255) DEFAULT 'تحديث جديد متوفر',
    title_en VARCHAR(255) DEFAULT 'Update Available',
    message TEXT,
    message_en TEXT,
    update_url VARCHAR(500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Enterprise Performance & Filtering Indexes
-- ============================================================================

-- Employee Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_employees_national_id ON employees(national_id);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);
CREATE INDEX IF NOT EXISTS idx_employees_factory ON employees(factory);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);

-- Request Lookup & Filter Indexes
CREATE INDEX IF NOT EXISTS idx_requests_employee_id ON requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON requests(type);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_emp_status ON requests(employee_id, status);

-- Payroll Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_year_month ON payroll(year, month);

-- Roster Indexes
CREATE INDEX IF NOT EXISTS idx_roster_employee_id ON roster(employee_id);
CREATE INDEX IF NOT EXISTS idx_roster_week ON roster(week_start);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_employee_id ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_emp_read ON notifications(employee_id, read);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_factory ON audit_logs(factory);

-- Push Tokens Indexes
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_employee_id ON fcm_tokens(employee_id);

-- Multi-Tenant Partitioning Indexes
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requests_tenant_id ON requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tenant_id ON payroll(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roster_tenant_id ON roster(tenant_id);
CREATE INDEX IF NOT EXISTS idx_concerns_tenant_id ON concerns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_id ON announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trips_tenant_id ON trips(tenant_id);
CREATE INDEX IF NOT EXISTS idx_benefits_tenant_id ON benefits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- ============================================================================
-- Extended Multi-Tenant Enterprise Tables
-- ============================================================================

-- Loans & Salary Advances Table
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

CREATE INDEX IF NOT EXISTS idx_loans_tenant_id ON loans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant_employee ON loans (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant_status ON loans (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_ref_num ON loans (reference_number);

-- Attendance Punches Table
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

CREATE INDEX IF NOT EXISTS idx_punches_tenant_id ON attendance_punches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_punches_tenant_emp_time ON attendance_punches (tenant_id, employee_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_punches_tenant_time ON attendance_punches (tenant_id, punched_at DESC);

-- Overtime Requests Table
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

CREATE INDEX IF NOT EXISTS idx_overtime_tenant_id ON overtime_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_overtime_tenant_emp ON overtime_requests (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_tenant_status ON overtime_requests (tenant_id, status);

-- Bus Fleet Routes Table
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

CREATE INDEX IF NOT EXISTS idx_bus_routes_tenant_id ON bus_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bus_routes_tenant_active ON bus_routes (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bus_routes_code ON bus_routes (tenant_id, code);

-- Bus Stops Table
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

-- Bus Bookings Table
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

CREATE INDEX IF NOT EXISTS idx_bus_bookings_tenant_id ON bus_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bus_bookings_tenant_emp ON bus_bookings (tenant_id, employee_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bus_bookings_tenant_route ON bus_bookings (tenant_id, route_id, booking_date);

-- ============================================================================
-- Enterprise Multi-Tenant Row Level Security (RLS) Policies
-- Enforces kernel-level cross-tenant isolation in PostgreSQL.
-- Session parameter: SET LOCAL app.current_tenant_id = 'elaraby';
-- Bypass flag:       SET LOCAL app.is_super_admin = 'true';
-- ============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests FORCE ROW LEVEL SECURITY;

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll FORCE ROW LEVEL SECURITY;

ALTER TABLE roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster FORCE ROW LEVEL SECURITY;

ALTER TABLE concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE concerns FORCE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips FORCE ROW LEVEL SECURITY;

ALTER TABLE benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefits FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

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
    -- Drop old policies to re-create strict default-deny policies
    DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
    DROP POLICY IF EXISTS tenant_isolation_requests ON requests;
    DROP POLICY IF EXISTS tenant_isolation_payroll ON payroll;
    DROP POLICY IF EXISTS tenant_isolation_roster ON roster;
    DROP POLICY IF EXISTS tenant_isolation_concerns ON concerns;
    DROP POLICY IF EXISTS tenant_isolation_notifications ON notifications;
    DROP POLICY IF EXISTS tenant_isolation_announcements ON announcements;
    DROP POLICY IF EXISTS tenant_isolation_trips ON trips;
    DROP POLICY IF EXISTS tenant_isolation_benefits ON benefits;
    DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
    DROP POLICY IF EXISTS tenant_isolation_loans ON loans;
    DROP POLICY IF EXISTS tenant_isolation_attendance ON attendance_punches;
    DROP POLICY IF EXISTS tenant_isolation_overtime ON overtime_requests;
    DROP POLICY IF EXISTS tenant_isolation_bus_routes ON bus_routes;
    DROP POLICY IF EXISTS tenant_isolation_bus_bookings ON bus_bookings;

    -- Strict Kernel-Enforced Policies (Deny by default if app.current_tenant_id is unset)
    CREATE POLICY tenant_isolation_employees ON employees
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_requests ON requests
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_payroll ON payroll
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_roster ON roster
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_concerns ON concerns
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_notifications ON notifications
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_announcements ON announcements
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
        OR is_global = TRUE
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_trips ON trips
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_benefits ON benefits
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

    CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR current_setting('app.is_super_admin', true) = 'true'
    );

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
