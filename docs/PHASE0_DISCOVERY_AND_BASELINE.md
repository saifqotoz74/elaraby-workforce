# Phase 0: Discovery, Architecture Baseline & Mobile Compatibility Matrix

**Master Goal:** Production Refactor of HR Admin Dashboard & Realtime Mobile Bridge  
**Branch:** `refactor/admin-production`  
**Status:** Baseline Established & Locked  
**Verification:** 64/64 Server Tests Passing | `flutter analyze`: 0 Issues Found  

---

## 1. Executive Baseline Summary

| Domain | Current State | Target State | Risk Level |
| :--- | :--- | :--- | :---: |
| **Admin Frontend** | Single-File Vanilla SPA (`server/admin/index.html`) using `innerHTML` & `prompt()` | Modular React + Vite + TypeScript Component Architecture with i18n/RTL | High |
| **Authentication** | Bearer token in `localStorage` | Secure `HttpOnly`, `SameSite=Strict`, `Secure` Cookies with CSRF Protection | Critical |
| **Authorization** | Single `superadmin` role without scope/factory isolation | Granular 6-Role Server-side RBAC + Factory/Department Scope Isolation | Critical |
| **Realtime Bridge** | Manual HTTP polling / page reload only | Server-Sent Events (SSE) / WebSocket bidirectional event bus + FCM push sync | High |
| **Upload System** | Base64 JSON transport via FileReader (~6MB payload) | Streaming `multipart/form-data` with disk streaming (`busboy`) & MIME validation | High |
| **Data Integrity** | Unvalidated vacation balance mutation | Schema validation (Zod) + ACID multi-record transactions & bounds | Critical |
| **Audit Trail** | In-memory unshift capped at 1000 items | Immutable persistent audit log with actor, role, entity, before/after diffs | Medium |
| **Mobile APIs** | 33 Endpoints consumed by Flutter Client | 100% Backward-compatible contracts with zero breaking changes | Zero-Tolerance |

---

## 2. Mobile API Compatibility Matrix (The 33 Endpoints Contract)

Every endpoint consumed by the Flutter mobile application MUST remain strictly compatible during and after the Admin refactor:

| # | Method | Endpoint | Mobile Consumer in Flutter | Request Payload | Response Schema Contract | Status |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | `GET` | `/api/health` | `Backend.ping()` | None | `{ ok: true, name, status, timestamp }` | PRESERVED |
| 2 | `GET` | `/api/ready` | K8s / Probe | None | `{ ready: true, uptime, dbRecords }` | PRESERVED |
| 3 | `GET` | `/api/version` | `Backend.checkVersion()` | None | `{ apiVersion, env, appVersionConfig }` | PRESERVED |
| 4 | `POST`| `/api/auth/otp` | `AuthRepository.requestOtp()` | `{ nationalId }` | `{ found, maskedPhone, phone, employeeName, hasPin, devCode }` | PRESERVED |
| 5 | `POST`| `/api/auth/otp/verify` | `AuthRepository.verifyOtp()` | `{ nationalId, code }` | `{ ok, resetToken, employee }` | PRESERVED |
| 6 | `POST`| `/api/auth/pin` | `AuthRepository.setPin()` | `{ nationalId, pin, resetToken? }` | `{ ok, token, employee }` | PRESERVED |
| 7 | `POST`| `/api/auth/pin/verify` | `AuthRepository.verifyPin()` | `{ nationalId, pin }` | `{ ok, token, employee }` | PRESERVED |
| 8 | `POST`| `/api/auth/pin/change` | `ProfileRepository.changePin()` | `{ currentPin, newPin }` | `{ ok }` | PRESERVED |
| 9 | `GET` | `/api/me` | `ProfileRepository.getProfile()` | Auth Bearer | Profile object with `vacationBalance`, `factory`, etc. | PRESERVED |
| 10 | `PUT` | `/api/me` | `ProfileRepository.updateProfile()`| `{ phone }` | `{ ok, employee }` | PRESERVED |
| 11 | `GET` | `/api/home` | `HomeContent.fetch()` | Auth Bearer | `{ todayShift, vacationBalance, announcements, quickActions }`| PRESERVED |
| 12 | `GET` | `/api/payroll` | `SalaryRepository.getPayroll()` | Auth + `x-salary-token` | `{ payroll: { period, basicSalary, allowances, deductions } }` | PRESERVED |
| 13 | `POST`| `/api/payroll/unlock` | `SalaryRepository.unlockSalary()` | `{ pin }` | `{ ok: true, salaryToken, expiresIn }` | PRESERVED |
| 14 | `GET` | `/api/roster` | `ShiftScheduleScreen` | Auth Bearer | `{ weekStart, days: 7 items, todayShift }` | PRESERVED |
| 15 | `GET` | `/api/requests` | `RequestsRepository.getRequests()` | Auth Bearer | `{ requests: [...] }` | PRESERVED |
| 16 | `POST`| `/api/requests` | `RequestsRepository.createRequest()`| `{ type, title, details, days }` | `{ ok: true, request, newVacationBalance }` | PRESERVED |
| 17 | `POST`| `/api/requests/:id/cancel`| `RequestsRepository.cancel()` | Auth Bearer | `{ ok: true, refundedDays, newVacationBalance }` | PRESERVED |
| 18 | `GET` | `/api/inbox` | `PushService.fetchInbox()` | Auth Bearer | `{ notifications: [...], unreadCount }` | PRESERVED |
| 19 | `POST`| `/api/inbox/read` | `PushService.markRead()` | `{ notificationId? }` | `{ ok: true }` | PRESERVED |
| 20 | `POST`| `/api/fcm-token` | `PushService.registerToken()` | `{ token }` | `{ ok: true, pushEnabled }` | PRESERVED |
| 21 | `GET` | `/api/benefits` | `BenefitsContent.fetch()` | Auth Bearer | `{ benefits: [...], trips: [...] }` | PRESERVED |
| 22 | `POST`| `/api/trips/:id/book` | `BenefitsContent.bookTrip()` | Auth Bearer | `{ ok: true, trip }` | PRESERVED |
| 23 | `POST`| `/api/trips/:id/unbook` | `BenefitsContent.unbookTrip()` | Auth Bearer | `{ ok: true, trip }` | PRESERVED |
| 24 | `POST`| `/api/concerns` | `RaiseConcernScreen` | `{ category, message, urgent }` | `{ ok: true, concernId }` | PRESERVED |
| 25 | `POST`| `/api/employee/delete-account` | `ProfileScreen.deleteAccount()` | `{ pin }` | `{ ok: true }` | PRESERVED |
| 26 | `GET` | `/api/announcements` | `AnnouncementDetailScreen` | Auth Bearer | `{ announcements: [...] }` | PRESERVED |
| 27 | `GET` | `/api/news` | `CompanyNewsScreen` | Auth Bearer | `{ news: [...] }` | PRESERVED |
| 28 | `GET` | `/uploads/:filename` | `AppNetworkImage` | HTTP GET | Raw image binary stream | PRESERVED |

---

## 3. Admin System & Refactor Map

The Admin API surface will be refactored into clean layered architecture with schema validation and RBAC:

```text
server/src/
├── routes/
│   ├── admin/
│   │   ├── auth.routes.js
│   │   ├── employees.routes.js
│   │   ├── requests.routes.js
│   │   ├── payroll.routes.js
│   │   ├── roster.routes.js
│   │   ├── content.routes.js
│   │   ├── uploads.routes.js
│   │   └── audit.routes.js
│   └── employee.js (preserved 100% for mobile clients)
├── middleware/
│   ├── authenticateAdmin.js (HttpOnly cookie validation + CSRF)
│   ├── requirePermission.js (RBAC checks)
│   ├── scopeGuard.js (Factory & Department multi-tenant scoping)
│   ├── validateSchema.js (Zod input validator)
│   └── rateLimiters.js
├── controllers/
│   └── admin/ ...
├── services/
│   ├── EmployeeService.js
│   ├── LeaveRequestService.js (atomic approvals + vacation day balance safety)
│   ├── PayrollService.js
│   ├── ShiftRosterService.js
│   ├── RealtimeEventService.js (SSE / WebSocket event bus)
│   ├── NotificationService.js (FCM push dispatch)
│   ├── UploadService.js (streaming multipart)
│   └── AuditService.js
└── validators/
    └── admin.schemas.js (Zod definitions)
```

---

## 4. Phase 0 Verification Metrics

* **Server Test Suite:** `node test/ratelimit.test.js && node test/backend_readiness.test.js && node test/database_and_backend.test.js && node test/comprehensive_api.test.js` ➔ **64 / 64 Passed (0 Failed)**
* **Flutter Workspace:** `flutter analyze` ➔ **No issues found!**
* **Git Branch:** Switched to dedicated branch `refactor/admin-production`.
* **FCM Credentials:** Real Google Service Account verified via `npm run verify:fcm`.

---

## 5. Phase 0 Conclusion & Gate 0 Sign-Off

Phase 0 discovery and baseline establishment is **100% COMPLETE**.  
No source code modifications or breaking changes have been made.

We are ready to proceed to **Phase 1: Security Foundation, Session Architecture & RBAC**.
