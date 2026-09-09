# Elaraby Connect — Database & Persistence Specification

**Subsystem:** Backend Persistence Engine & Client Local Store  
**Engine:** Atomic Durability JSON Engine + Cloud Firestore Adapter  
**Version:** 1.0.0 (Production Database Architecture)  
**Date:** September 2026  

---

## 1. Architectural Overview

The Elaraby Connect backend persistence layer is engineered for absolute durability, transactional integrity, and O(1) indexed query performance without requiring complex external database server setups for standard deployments, while seamlessly bridging to Cloud Firestore in enterprise containerized or serverless environments.

```mermaid
graph TD
    API[Express Route Handlers]
    TX[Transaction Runner - Snapshot Isolation]
    Index[In-Memory Hash Indexes - O(1)]
    SchemaVal[Schema & Constraint Validator]
    Disk[Atomic File Writer: db.tmp -> db.json]
    Backup[Rotational Backup: db.backup.json]
    Firestore[Google Cloud Firestore Sync]

    API --> TX
    TX --> Index
    TX --> SchemaVal
    SchemaVal -->|Valid| Disk
    Disk --> Backup
    Disk -. Optional .-> Firestore
    SchemaVal -->|Violation| Rollback[Abort & Rollback Snapshot]
```

---

## 2. Relational Schema & Entity Definitions

### 2.1 Schema Entities

| Entity / Collection | Key | Fields | Constraints & Integrity |
| :--- | :--- | :--- | :--- |
| **`employees`** | `id` | `nationalId`, `phone`, `name`, `employeeCode`, `factory`, `department`, `position`, `supervisor`, `pinHash`, `vacationBalance`, `active`, `tokenVersion`, `createdAt` | `nationalId` is unique and 14 digits; `employeeCode` is unique; `vacationBalance >= 0`. |
| **`requests`** | `id` | `employeeId`, `type`, `title`, `refNumber`, `status`, `details`, `days`, `createdAt`, `decidedBy`, `decisionReason` | FK to `employees.id`; `status` in `['inReview', 'approved', 'rejected']`. |
| **`payroll`** | `id` | `employeeId`, `month`, `year`, `basic`, `allowances`, `deductions`, `net`, `currency`, `publishedAt` | FK to `employees.id`; numeric values non-negative; `net = basic + allowances - deductions`. |
| **`roster`** | `id` | `employeeId`, `weekStartDate`, `shifts` (7 entries: `day`, `shift`, `time`, `offDuty`) | FK to `employees.id`; exactly 7 days per weekly schedule. |
| **`concerns`** | `id` | `refNumber`, `category`, `details`, `attachedPhoto`, `createdAt`, `status` | Anonymous submission; zero PII linked. |
| **`announcements`** | `id` | `title`, `body`, `category`, `createdAt`, `expiresAt` | Pinned or priority notices broadcast to workforce. |
| **`news`** | `id` | `title`, `body`, `category`, `imageUrl`, `createdAt` | Company corporate news catalog. |
| **`benefits`** | `id` | `title`, `discount`, `category`, `description`, `validThrough` | Commercial retail and corporate discounts. |
| **`trips`** | `id` | `title`, `destination`, `date`, `seatsTotal`, `seatsBooked`, `bookedEmployeeIds` | `seatsBooked <= seatsTotal`; employee cannot double-book. |
| **`notifications`** | `id` | `employeeId`, `title`, `body`, `read`, `createdAt`, `imageUrl` | FK to `employees.id`. |
| **`auditLogs`** | `id` | `timestamp`, `action`, `actor`, `employeeId`, `metadata` | Append-only security audit trail. |

---

## 3. Transaction Runner & ACID Guarantees

### 3.1 Snapshot Isolation & Atomic Rollback
Located in `server/src/db.js`, the `transaction()` runner executes state mutations within a deep-cloned memory snapshot:

1. **Snapshot Creation:** `const snapshot = JSON.parse(JSON.stringify(_data));`
2. **Execution:** Mutator callback executes within the isolated context.
3. **Constraint Validation:** The entire mutated snapshot is verified through `validateConstraints(candidate)`:
   - Unique constraints (National ID, Employee Code, Request Reference Numbers).
   - Foreign key integrity (every `employeeId` references an active employee).
   - Domain invariants (vacation balances cannot be negative, trip seats cannot exceed capacity).
4. **Commit / Rollback:**
   - **On Success:** The candidate state becomes active and is committed atomically to disk.
   - **On Failure:** Any thrown error immediately discards the candidate state, preserving the initial snapshot with zero partial mutations.

---

## 4. Durability & Crash Resilience

### 4.1 Atomic Temporary File Replacement
Disk writes never overwrite `data/db.json` in-place:
1. State is serialized to `db.tmp.[PID].[TIMESTAMP]`.
2. `fs.flushSync` ensures bytes are flushed from OS kernel buffers to physical hardware.
3. `fs.renameSync` performs an atomic POSIX / NTFS metadata pointer swap replacing `db.json`.
4. Prior to commit, the previous valid state is rotated into `data/db.backup.json`. If primary file corruption is ever detected on boot, recovery automatically restores from the backup file.

---

## 5. High-Performance In-Memory Indexing

Located in `server/src/indexes.js`, the engine maintains high-speed hash indexes rebuilt on state changes:

* **`byNationalId`:** `Map<string, Employee>` — O(1) National ID lookups.
* **`byEmployeeCode`:** `Map<string, Employee>` — O(1) Employee Code lookups.
* **`requestsByEmployeeId`:** `Map<string, Request[]>` — O(1) request listing.
* **`payrollByEmployeeId`:** `Map<string, Payroll>` — O(1) salary slip retrieval.
* **`rosterByEmployeeId`:** `Map<string, Roster>` — O(1) shift schedule queries.

---

## 6. Schema Migrations Runner

Located in `server/src/migrations/runner.js`, schema upgrades are versioned, idempotent, and tracked in `schemaMigrations`:

1. **`001_initial_schema.js`:** Baseline collections, employee registry, counters, and initial admin seed.
2. **`002_add_payroll_and_token_version.js`:** Introduces `payroll` statements collection and `tokenVersion` for cryptographic session revocation.
3. **`003_add_integrity_and_indexes.js`:** Establishes foreign key consistency checks and indexes.
