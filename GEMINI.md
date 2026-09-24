# Workforce OS — Enterprise Invariants & Architectural Rules

These rules are permanent operational invariants for Workforce OS across the Express backend, Admin Web portal, ESS portal, and Flutter mobile application.

---

## 1. Multi-Tenant Context Isolation (AsyncLocalStorage)
- All database queries, service calls, and background jobs MUST resolve `tenantId` from ambient context (`server/src/tenantContext.js`) via `AsyncLocalStorage`.
- NEVER pass `tenantId` as a mutable parameter across service boundaries.
- When performing super-admin impersonation, always reset global bypass flags (`isSuperAdmin = false`) immediately after execution to prevent cross-tenant boundary leakage.

---

## 2. Strict Banking & Payroll Encoding Separation
- **CSV Bank Exports (`/api/admin/reports/bank-export?format=csv`)**: MUST include the UTF-8 Byte Order Mark (`\uFEFF`) at byte offset 0 to guarantee accurate Arabic rendering in Microsoft Excel and ERPs.
- **Central Bank of Egypt (CBE WPS) & Fixed-Width Formats**: MUST strictly OMIT the Byte Order Mark (`\uFEFF`). Header line `01|...` and detail lines `02|...` must be joined strictly with CRLF (`\r\n`). Mainframe banking processors treat BOM as invalid characters and reject the transmission.

---

## 3. Test Idempotency & Collision-Free Entity Slugs
- When authoring tests that provision enterprise tenants or unique entities, ALWAYS use high-entropy unique slugs (e.g. `test_corp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`).
- NEVER use short time slices like `slice(-4)`, which cause HTTP 409 Conflict collisions on persistent test runs.

---

## 4. Unified Persistent Schema for All Services
- All domain modules (including Kiosk shop-floor and HSE services) MUST persist records in the unified schema (`server/src/schema.js` and `server/src/db.js`).
- NEVER store production or stateful data in module-level JavaScript in-memory constants (such as `MOCK_MACHINES`), which are wiped on restart and cause cross-tenant state bleeding.

---

## 5. Exhaustive UI State Pattern in Flutter (`UiState<T>`)
- Riverpod state notifiers in Flutter MUST use the sealed `UiState<T>` class (`lib/core/state/ui_state.dart`).
- All screen controllers MUST exhaustively handle all 6 UI states: `loading`, `success`, `error`, `empty`, `refreshing`, and `offline`.
- NEVER treat `null` as an error state or let unhandled UI states trigger blank screens.

---

## 6. Zero Ephemeral Secrets in Production
- In production environments (including Serverless, Vercel, and auto-scaled container clusters), `JWT_SECRET` MUST be set explicitly (minimum 32 characters).
- NEVER fall back to runtime-generated ephemeral secrets in memory (`crypto.randomBytes`), which cause random `401 Unauthorized` logouts across serverless container instances.

---

## 7. Zero Residual Ghost Identities in Client Storage
- Client storage models (such as `EmployeeProfile` in Flutter) MUST initialize with empty uninitialized defaults (`''`), NEVER hardcoded mock employee identities.
- Logging out, clearing sessions, or switching enterprise organizations MUST completely wipe employee state so that client devices never render residual identities from other tenants under network latency.

