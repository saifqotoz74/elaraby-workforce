# ARCHITECTURE AUDIT REPORT: Workforce OS

**Classification**: Architecture Review & Technical Debt Analysis  
**Auditor**: Principal Enterprise Architect  
**Date**: September 22, 2026  
**Target**: `Workforce OS` (`server/`, `lib/`, `server/admin/`, `server/ess/`)  

---

## 1. Architectural Overview & Context

Workforce OS is designed as a hybrid enterprise suite servicing both factory-floor blue-collar workers (via Flutter mobile app and tablet kiosk terminals) and corporate HR/operations administrators (via web management portals).

The architecture spans three primary tiers:
1. **Edge Clients**: Flutter cross-platform mobile application, Tablet Kiosk app, Admin Web SPA, and ESS Web Portal.
2. **Application Server**: Node.js/Express monolithic service exposing REST endpoints, Server-Sent Events (SSE) pub/sub backplane, and PDF/CSV report generation engines.
3. **Persistence Layer**: An active in-memory JavaScript object graph backed by atomic JSON disk flushes, with an unwired relational PostgreSQL migration layer.

---

## 2. Discovered Architecture vs. Claimed Architecture

```text
=========================================================================================
                           CLAIMED ARCHITECTURE (Documentation)
=========================================================================================
[Flutter Mobile]   [Admin Web]
       │                │
       ▼                ▼
   [Express API Gateway & Microservices]
       │
       ▼
   [PostgreSQL 15+ Relational DB with ACID Transactions & Connection Pooling]
   [Redis 7+ Pub/Sub Backplane & Distributed Rate Limiting]

=========================================================================================
                           ACTUAL ARCHITECTURE (Source Code)
=========================================================================================
[Flutter Mobile]   [Admin Web]   [ESS Web]
       │                │            │
       ▼                ▼            ▼
   [Express Monolith (Single-Threaded Node.js Process)]
       │
       ▼ (Direct RAM Read/Write via db())
   +-------------------------------------------------------------------------------+
   | server/src/db.js (In-Memory JSON Object Graph)                                |
   | - State lives in Node.js V8 Heap memory                                       |
   | - Mutation: lock.acquire() -> JSON clone -> mutate -> fs.writeFileSync()      |
   | - Multi-tenancy: In-memory JavaScript Array.filter() by tenantId              |
   +-------------------------------------------------------------------------------+
       ╎
       ╎ (Disconnected / Not Called by Admin or Employee Routes)
       ▼
   [server/src/db/postgres.js & server/src/db/migrationRunner.js]
   - Fully written SQL DDL, tables, constraints, and pool logic exist
   - ZERO routes in server/src/routes/admin.js query this layer!
   - ZERO routes in server/src/routes/employee.js query this layer!
=========================================================================================
```

### Key Architectural Dichotomy
The repository contains two divergent persistence paradigms:
1. **The Active Operational Engine (`server/src/db.js`)**: All functional route controllers (`routes/admin.js`, `routes/employee.js`, `routes/auth.js`) invoke `const { data, transaction } = require('../db')`. This executes reads against RAM arrays and writes via synchronous whole-database cloning.
2. **The Dormant Relational Engine (`server/src/db/postgres.js`)**: An industrial-grade PostgreSQL pool and relational repository layer has been coded and verified with tests (`server/test/postgres_migration.test.js`), but **it is not imported or utilized by the production route handlers**.

---

## 3. Mobile Architecture (Flutter)

### 3.1 State Management Bifurcation
The mobile application exhibits a split personality in state management:
* **Modern Tier (Riverpod 2.6.1)**: Features such as `RequestsNotifier`, `SalaryNotifier`, and `SettingsNotifier` use clean `StateNotifier` / `AsyncNotifier` patterns with immutable state classes (`UiState`).
* **Legacy God-Class Tier (`backend.dart`)**: Located at `lib/core/network/backend.dart`, this 250+ line monolithic class acts as a single point of failure, mixing HTTP routing, mock data injection, in-memory caching, and local storage access without dependency injection.
* **Direct Widget State Tier (`setState`)**: Features such as `KioskScreen`, `MyRosterScreen`, and `HseHomeScreen` bypass Riverpod providers and manage complex timers, network state, and business logic directly inside Flutter `StatefulWidget` classes.

### 3.2 Decoupled Client-Side Mocking (The "Ghost Feature" Flaw)
Several mobile screens simulate business functionality locally without querying the backend API:
1. **Shift Roster (`my_roster_screen.dart:38-42`)**:
   Shifts are calculated locally using `final shiftCode = shifts[(i + weekOffset.abs()) % shifts.length];`. This ignores real shifts published by HR managers on the backend roster solver.
2. **Tablet Kiosk (`kiosk_screen.dart:21-32`)**:
   Machine statuses and work orders are statically hardcoded in widget state lists, despite a dedicated backend `/api/employee/kiosk/overview` endpoint existing in `server/src/routes/employee.js`.
3. **HSE Management (`hse_home_screen.dart:48-140`)**:
   Permits and LTI days are hardcoded client-side, while a fully tested `server/src/services/hseService.js` exists on the server.

---

## 4. Frontend Web Architecture (Admin & ESS)

### 4.1 Admin Web Architecture (`server/admin/`)
* **Design**: Vanilla ES6 JavaScript modules with no external bundler (Webpack/Vite), leveraging native browser ESM loading (`<script type="module">`).
* **State Management**: Reactive in-memory `Store` publishing change events to subscribers.
* **Routing**: Hash-based client-side router (`HashRouter.js`) with permission guards.
* **Component Model**: Reusable components (`DataTable`, `StatCard`, `Modal`, `FilterBar`) instantiated dynamically and mounted to DOM elements.
* **Architectural Flaw**: Incomplete sanitization in `DataTable.js` (SEC-002) renders innerHTML from untrusted column strings.

### 4.2 ESS Web Architecture (`server/ess/`)
* **Design**: Minimalist single-page interface with static tabs.
* **Architectural Flaw**: Lacks a real API client. The login button unhides the dashboard immediately via client-side DOM class toggling (AUTH-002) without establishing an authenticated session with the Express backend.

---

## 5. Multi-Tenant Architecture & Data Isolation

### 5.1 Multi-Tenant Design Strengths
The multi-tenant resolution pipeline in `server/src/middleware/tenant.js` is elegantly structured:
1. Evaluates incoming `x-tenant-id` header, query parameter, or subdomain host.
2. Attaches `req.tenantId` to the AsyncLocalStorage execution context.
3. Propagates the tenant scope across logging, SSE channels, and rate-limiting buckets.

### 5.2 Multi-Tenant Structural Flaws
* **Bypass via Static Master Account (AUTH-001)**: The tenant boundary is hard-compromised by `masterAccountService.js`, which allows a single hardcoded phone/OTP to penetrate any tenant boundary indiscriminately.
* **Memory Contamination Risk**: Because all tenant records reside in a single shared JavaScript object (`_data.employees`, `_data.requests`), a single logic bug in an `Array.filter()` predicate can instantly leak cross-tenant records to unauthorized users.

---

## 6. Architectural Refactoring Recommendations

```text
+-------------------------------------------------------------------------------+
|                        ARCHITECTURAL ROADMAP                                  |
+-------------------------------------------------------------------------------+
  Phase 1: Persistence Realignment
  - Deprecate server/src/db.js RAM storage.
  - Route all admin and employee controllers through server/src/db/postgres.js.
  - Establish connection pool pooling with pg-pool.

  Phase 2: Mobile Client Harmonization
  - Eliminate lib/core/network/backend.dart completely.
  - Move Kiosk, Roster, and HSE screens from local setState to Riverpod AsyncNotifiers.
  - Bind mobile screens to live server endpoints.

  Phase 3: Security & Identity Decoupling
  - Remove masterAccountService.js and hardcoded admin bypasses.
  - Implement standard OAuth2 / JWT stateless refresh token rotation.
+-------------------------------------------------------------------------------+
```
