# ACTION PLAN: Workforce OS Remediation Matrix

**Auditor**: Senior Software Architect & Lead Security Auditor  
**Date**: September 22, 2026  
**Status**: Ready for Engineering Orchestration  

---

## 1. Remediation Priority Matrix

```text
+-------------------------------------------------------------------------------+
|  PRIORITY   | COUNT | TARGET TIMELINE     | SCOPE                             |
+-------------------------------------------------------------------------------+
|  P0         |   3   | Immediate (Blocker) | Critical Security & Data Loss     |
|  P1         |   4   | Before Production   | High Stability, Mobile & XSS      |
|  P2         |   4   | Sprint 1            | Architecture, Performance, Mocks  |
|  P3         |   3   | Sprint 2            | Dependencies, Fonts, Docs         |
+-------------------------------------------------------------------------------+
```

---

## 2. Priority Levels

### P0: Immediate Blockers (Critical Security & Data Loss)
* **SEC-001**: Remove hardcoded admin fallback credentials (`elaraby2026`, `Admin@12345`) in `server/src/routes/admin.js:55-63`.
* **AUTH-001**: Delete universal master account backdoor (`123456`, `1234`) in `server/src/services/masterAccountService.js`.
* **DATA-001**: Terminate ephemeral `/tmp` storage path on Vercel serverless in `server/src/config.js:142-155` and `server/src/db.js:25`.

### P1: Before Production (High-Impact Reliability & Compliance)
* **IOS-001**: Add missing `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, and `NSPhotoLibraryUsageDescription` to `ios/Runner/Info.plist`.
* **AND-001**: Enable `minifyEnabled true`, `shrinkResources true`, and configure release signing in `android/app/build.gradle:105-110`.
* **SEC-002**: Sanitize HTML output with DOMPurify in `server/admin/js/components/DataTable.js:77-82`.
* **PERF-001**: Transition operational writes from synchronous whole-database JSON cloning to PostgreSQL async queries via `server/src/db/postgres.js`.

### P2: Engineering Improvements (Medium-Impact Debt & Decoupled State)
* **ARCH-001**: Refactor and delete the legacy `lib/core/network/backend.dart` god class in favor of modern Riverpod repositories.
* **MOCK-001**: Connect `MyRosterScreen`, `KioskScreen`, and `HseHomeScreen` to live backend REST endpoints.
* **PERF-002**: Isolate 1Hz clock timer in `lib/features/kiosk/presentation/screens/kiosk_screen.dart:37-41` into a self-contained leaf widget.
* **AUTH-002**: Add server-side authentication validation to ESS web login in `server/ess/ess.js:9-13`.

### P3: Optional Improvements (Low-Impact Optimizations)
* **DEP-001**: Upgrade outdated dependencies in `pubspec.yaml` and prune discontinued packages.
* **FONT-001**: Bundle Arabic font fallback (Cairo/Amiri) for mobile PDF payslip rendering.
* **DOC-001**: Reconcile architectural documentation in `README.md` with active runtime reality.

---

## 3. Orchestrator Handoff Specification

For automated task execution systems (e.g. `project-orchestrator`), each task is specified with machine-readable criteria:

### Task P0-1: Remediate Administrative Backdoors
* **Finding ID**: SEC-001
* **Severity**: CRITICAL
* **Category**: Security / Broken Authentication
* **Affected Files**: `server/src/routes/admin.js`, `server/test/admin_auth.test.js`
* **Root Cause**: Hardcoded developer fallback credentials in login controller.
* **Recommended Remediation**: Remove the `isElarabyAdmin` check. Query `db.data().adminUsers` and compare passwords with `bcrypt.compare`.
* **Dependencies**: None.
* **Validation Criteria**: `curl -X POST http://localhost:4000/api/admin/login -d '{"username":"admin","password":"Admin@12345"}'` returns HTTP 401.

### Task P0-2: Eliminate Master Account Universal Bypass
* **Finding ID**: AUTH-001
* **Severity**: CRITICAL
* **Category**: Security / Multi-Tenant Isolation
* **Affected Files**: `server/src/services/masterAccountService.js`, `server/src/routes/auth.js`, `server/test/master_account.test.js`
* **Root Cause**: Virtual master account injects bypass credentials across all tenant boundaries.
* **Recommended Remediation**: Deprecate `masterAccountService.js`. Update tests to assert that `MASTER_OTP` and `MASTER_PIN` are rejected as invalid credentials.
* **Dependencies**: Task P0-1.
* **Validation Criteria**: `npm test` passes with zero master account bypass capabilities.

### Task P0-3: Prevent Ephemeral Data Loss on Vercel
* **Finding ID**: DATA-001
* **Severity**: CRITICAL
* **Category**: Database / Operational Durability
* **Affected Files**: `server/src/config.js`, `server/src/db.js`, `vercel.json`
* **Root Cause**: Serverless runtime default points database to transient `/tmp`.
* **Recommended Remediation**: Require valid `DATABASE_URL` for production boots, including Vercel. If running on Vercel without `DATABASE_URL`, throw fatal configuration error on startup.
* **Dependencies**: None.
* **Validation Criteria**: Starting server with `VERCEL=1` without `DATABASE_URL` refuses to serve traffic.

### Task P1-1: Add Missing iOS Privacy Descriptions
* **Finding ID**: IOS-001
* **Severity**: HIGH
* **Category**: Mobile / Apple Compliance
* **Affected Files**: `ios/Runner/Info.plist`
* **Root Cause**: Missing iOS permission strings for camera, location, and photo library.
* **Recommended Remediation**: Add `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, and `NSPhotoLibraryUsageDescription`.
* **Dependencies**: None.
* **Validation Criteria**: Launching mobile app in iOS simulator and requesting QR punch does not crash with `SIGABRT`.

### Task P1-2: Enable Android Release Code Shrinking & Keystore
* **Finding ID**: AND-001
* **Severity**: HIGH
* **Category**: Mobile / Security
* **Affected Files**: `android/app/build.gradle`
* **Root Cause**: Incomplete release build configuration.
* **Recommended Remediation**: Set `minifyEnabled true`, `shrinkResources true`, and point to production keystore.
* **Dependencies**: None.
* **Validation Criteria**: `flutter build apk --release` produces obfuscated APK without build errors.

### Task P1-3: Sanitize Admin DataTable HTML
* **Finding ID**: SEC-002
* **Severity**: HIGH
* **Category**: Security / XSS
* **Affected Files**: `server/admin/js/components/DataTable.js`
* **Root Cause**: Direct assignment to `td.innerHTML` without sanitization.
* **Recommended Remediation**: Import `DOMPurify` or replace `innerHTML` assignment with safe DOM construction.
* **Dependencies**: None.
* **Validation Criteria**: Column containing `<img src=x onerror=alert(1)>` renders text safely without executing JavaScript.

### Task P1-4: Connect PostgreSQL Persistence to Express Route Handlers
* **Finding ID**: PERF-001
* **Severity**: HIGH
* **Category**: Architecture / Performance
* **Affected Files**: `server/src/routes/admin.js`, `server/src/routes/employee.js`, `server/src/db/postgres.js`
* **Root Cause**: Routes query in-memory JSON DB (`server/src/db.js`) instead of PostgreSQL repository.
* **Recommended Remediation**: Migrate route handlers to query PostgreSQL repository asynchronously when `DATABASE_URL` is present.
* **Dependencies**: Task P0-3.
* **Validation Criteria**: Route mutations write directly to PostgreSQL tables without event loop latency.
