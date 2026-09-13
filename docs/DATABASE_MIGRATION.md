# Database Migration Guide: JSON to PostgreSQL

**System:** Elaraby Workforce Database Layer  
**Target:** PostgreSQL 14+ (Recommended: PostgreSQL 16 on RDS / Azure Flexible / Cloud SQL)  
**Migration Tool:** `server/scripts/migrate-json-to-postgres.js`  
**DDL Source:** `server/src/db/schema.sql`  
**Repository Layer:** `server/src/db/repository.js`  

---

## 1. Relational Schema Architecture

The relational schema replaces the single unstructured `db.json` document with normalized, ACID-compliant relational tables:

```text
┌───────────────────────┐         ┌───────────────────────┐
│       tenants         │◄───┐    │       departments     │
├───────────────────────┤    │    ├───────────────────────┤
│ id (VARCHAR PK)       │    │    │ id (VARCHAR PK)       │
│ name (VARCHAR)        │    │    │ tenant_id (FK)        │
│ is_active (BOOLEAN)   │    │    │ name (VARCHAR)        │
└───────────────────────┘    │    └───────────┬───────────┘
                             │                │
                             │                │
┌───────────────────────┐    │    ┌───────────▼───────────┐
│   vacation_balances   │    │    │       employees       │
├───────────────────────┤    │    ├───────────────────────┤
│ employee_id (FK PK)   │    │    │ id (VARCHAR PK)       │
│ annual (INT >= 0)     │    └───┼┤ tenant_id (FK)        │
│ casual (INT >= 0)     │         │ department_id (FK)    │
│ sick (INT >= 0)       │         │ full_name (VARCHAR)   │
└───────────────────────┘         │ email (VARCHAR UNIQUE)│
                                  │ national_id (VARCHAR) │
                                  │ role (VARCHAR)        │
                                  └───────────┬───────────┘
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
            ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
            │     requests      │   │    attendances    │   │      payrolls     │
            ├───────────────────┤   ├───────────────────┤   ├───────────────────┤
            │ id (VARCHAR PK)   │   │ id (VARCHAR PK)   │   │ id (VARCHAR PK)   │
            │ employee_id (FK)  │   │ employee_id (FK)  │   │ employee_id (FK)  │
            │ type (VARCHAR)    │   │ date (DATE)       │   │ month (INT)       │
            │ status (VARCHAR)  │   │ check_in (TIME)   │   │ year (INT)        │
            │ start_date (DATE) │   │ check_out (TIME)  │   │ net_salary (NUM)  │
            └───────────────────┘   └───────────────────┘   └───────────────────┘
```

### 1.1 Indexes for High-Concurrency Lookups

The DDL incorporates specific B-tree indexes designed for high-concurrency workforce operations:
* `idx_employees_tenant_dept` (`tenant_id`, `department_id`): Rapid department roster querying.
* `idx_requests_employee_status` (`employee_id`, `status`): Rapid leave balance calculation & pending approval retrieval.
* `idx_attendances_emp_date` (`employee_id`, `date`): Unique day attendance lookup; prevents duplicate punch records.
* `idx_payrolls_emp_period` (`employee_id`, `year`, `month`): Unique monthly payslip lookup.
* `idx_notifications_user_read` (`user_id`, `is_read`): Instant retrieval of unread notifications.

---

## 2. Migration Execution Modes

The migration script supports 4 deterministic operation modes:

```bash
cd server

# 1. Validation Only: Inspect db.json structure, types, and referential integrity
node scripts/migrate-json-to-postgres.js --validate

# 2. Dry-Run: Simulate table transformations without writing to PostgreSQL
node scripts/migrate-json-to-postgres.js --dry-run

# 3. Live Execution: Execute DDL, normalize data, and insert with batch transactions
node scripts/migrate-json-to-postgres.js --execute

# 4. Verification: Run record-count parity and integrity checks between source & destination
node scripts/migrate-json-to-postgres.js --verify
```

### 2.1 Sample Migration Output
```text
=== ELARABY WORKFORCE: JSON -> POSTGRESQL MIGRATION UTILITY ===
Mode: Live Execution (--execute)
Target DB: postgresql://postgres:***@localhost:5432/elaraby_workforce

✔ [1/6] Schema DDL verified. All tables and indexes active.
✔ [2/6] Tenants migrated: 1 record(s).
✔ [3/6] Employees migrated: 13 record(s).
✔ [4/6] Vacation balances initialized: 13 record(s).
✔ [5/6] Workflow requests migrated: 107 record(s).
✔ [6/6] Attendance & Payroll records migrated: 100% integrity.
Migration Complete: 0 Errors, 0 Mismatches.
```

---

## 3. Dual-Read & Zero-Downtime Cutover Strategy

The platform implements a controlled 4-stage transition:

### Stage 1: Dual-Mode Repository (`DUAL_READ`)
* `server/src/db/repository.js` checks `process.env.DATABASE_URL`.
* If PostgreSQL is configured, queries route to PostgreSQL connection pool (`server/src/db/postgres.js`).
* If PostgreSQL is unavailable or unconfigured, the repository transparently falls back to local JSON memory store for development and local testing.

### Stage 2: Parallel Write Validation
* Data is written to PostgreSQL inside an ACID transaction.
* Read queries verify parity against secondary mirror.

### Stage 3: Cutover to PostgreSQL Authority (`PERSISTENCE_DRIVER=postgres`)
* Set `PERSISTENCE_DRIVER=postgres` in `.env`.
* PostgreSQL becomes the authoritative primary source of truth.
* JSON store is switched to read-only archival mode.

### Stage 4: Decommissioning JSON
* `server/data/db.json` is preserved as a timestamped cold archive in `server/backups/`.
* API runs entirely on PostgreSQL.

---

## 4. Rollback Procedure

If unexpected database anomalies occur during cutover:
1. Set `PERSISTENCE_DRIVER=json` in environment variables.
2. Restart API containers: `docker compose restart api`.
3. The repository immediately rebinds to local store without service disruption.
4. Export updated PostgreSQL delta and reconcile back into JSON store.
