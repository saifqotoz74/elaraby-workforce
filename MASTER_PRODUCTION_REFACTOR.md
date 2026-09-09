# MASTER PRODUCTION REFACTOR

## HR Admin Dashboard + Mobile Bridge

### Objective: Production-Grade Enterprise Refactor — DO NOT BREAK EXISTING FUNCTIONALITY

You are acting as a **Principal Software Architect + Senior Full-Stack Engineer + Security Engineer + Lead QA + DevOps Engineer**.

Your task is to perform a **complete production refactor** of the HR Admin Dashboard and its connection to the mobile application.

The current implementation is functional but architecturally immature.

Your job is NOT to cosmetically improve it.

Your job is to transform it into a **secure, scalable, maintainable, production-ready HR administration platform** while preserving all existing business functionality.

---

# 0. ABSOLUTE RULES

## DO NOT:

* rewrite blindly
* delete working business logic
* break existing mobile APIs
* change API contracts unless compatibility is preserved
* remove existing features
* introduce fake/mock functionality
* create placeholder buttons
* leave TODO implementations
* hide errors
* silently swallow exceptions
* disable security checks
* store secrets in frontend code
* use `localStorage` for authentication tokens
* use `window.prompt()`
* use inline `onclick`
* use giant `innerHTML` page rendering
* load unlimited datasets into the browser
* send images as Base64 JSON
* trust client-side authorization
* trust client-side validation
* assume a successful HTTP response means the operation succeeded

## CRITICAL:

Before changing anything:

1. Inspect the entire repository.
2. Inspect the existing database schema.
3. Inspect all server routes.
4. Inspect all middleware.
5. Inspect authentication.
6. Inspect mobile API consumers.
7. Inspect notification/FCM logic.
8. Inspect employee, leave, payroll, shift, announcement and request models.
9. Inspect environment variables.
10. Inspect deployment configuration.
11. Build a dependency map.
12. Build a route/API compatibility map.
13. Identify every existing business rule.
14. Identify every existing side effect.
15. Create a backup/checkpoint before destructive changes.

Do not start implementation until you understand the existing architecture.

---

# 1. CURRENT PROJECT TARGET

Primary dashboard:

`server/admin/index.html`

Primary backend route:

`server/src/routes/admin.js`

But you MUST inspect the entire repository because the dashboard is connected to:

* authentication
* employees
* leave requests
* payroll
* shifts
* announcements
* notifications
* FCM
* database
* mobile application
* file uploads
* audit/history
* deployment infrastructure

Do not limit the investigation to these two files.

---

# 2. TARGET ARCHITECTURE

Replace the current Single-File SPA architecture with a modular architecture.

Preferred frontend:

**React + Vite + TypeScript**

If introducing React/TypeScript would conflict with the current project architecture, use the closest production-grade alternative, but explain the decision before implementation.

Target structure:

```text
server/
├── admin/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── employees/
│   │   │   ├── leave/
│   │   │   ├── payroll/
│   │   │   ├── shifts/
│   │   │   ├── announcements/
│   │   │   ├── notifications/
│   │   │   └── audit/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── i18n/
│   │   └── styles/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── src/
    ├── routes/
    ├── controllers/
    ├── services/
    ├── middleware/
    ├── validators/
    ├── auth/
    ├── realtime/
    ├── uploads/
    ├── audit/
    └── utils/
```

Use clear separation between:

* UI
* state
* API client
* business logic
* validation
* authorization
* persistence
* realtime events
* notifications

---

# 3. REMOVE THE SINGLE-FILE SPA

Completely eliminate the current architecture where the entire application is regenerated using:

```javascript
document.getElementById('main').innerHTML = `...`;
```

Do not simply move the same code into different files.

Actually implement:

* reusable components
* feature modules
* page-level components
* shared UI components
* centralized state
* centralized API client
* centralized error handling
* typed models
* predictable state transitions

Required reusable components include:

```text
AppShell
Sidebar
Topbar
PageHeader
DataTable
Pagination
SearchInput
FilterBar
Modal
ConfirmDialog
Drawer
Toast
LoadingState
EmptyState
ErrorState
StatusBadge
DatePicker
EmployeeAutocomplete
FileUploader
Toggle
Select
Textarea
Button
```

---

# 4. ROUTING

Implement proper frontend routing.

Required pages:

```text
/dashboard
/employees
/employees/:id
/leave
/leave/:id
/payroll
/shifts
/announcements
/notifications
/audit
/settings
```

Unauthorized users must never be able to access restricted pages.

Frontend routing is UX only.

Backend authorization remains mandatory.

---

# 5. AUTHENTICATION SECURITY

Remove:

```javascript
localStorage.setItem('admin_token', token)
```

Do not store privileged authentication tokens in:

* localStorage
* sessionStorage
* IndexedDB
* frontend-readable JavaScript variables

Implement secure session authentication using:

```text
HttpOnly
Secure
SameSite=Strict
```

cookies where deployment architecture allows it.

Implement:

* session expiration
* session rotation where appropriate
* logout
* authentication middleware
* CSRF protection where cookie authentication requires it
* secure cookie configuration
* brute-force/rate-limit protection
* login failure handling
* unauthorized response handling
* session invalidation

Never expose privileged credentials to frontend JavaScript.

---

# 6. RBAC — ROLE BASED ACCESS CONTROL

Implement real backend-enforced RBAC.

Minimum roles:

```text
SUPER_ADMIN
HR_OFFICER
PAYROLL_OFFICER
SHIFT_SUPERVISOR
ANNOUNCEMENT_MANAGER
AUDITOR
```

Create a centralized permission model.

Example:

```text
employee.read
employee.create
employee.update
employee.delete

leave.read
leave.approve
leave.reject

payroll.read
payroll.create
payroll.update

shift.read
shift.create
shift.update

announcement.read
announcement.create
announcement.update
announcement.delete
announcement.publish

audit.read
```

Never use:

```javascript
if (user.role === 'superadmin')
```

everywhere.

Create centralized authorization middleware/service.

Example conceptual API:

```javascript
requirePermission('leave.approve')
```

The server MUST enforce permissions.

Frontend should hide unavailable actions, but this is NOT considered security.

---

# 7. TENANT / LOCATION / SCOPE ISOLATION

If the project has factories, branches, departments or organizational units:

Implement scoped access.

Example:

```text
SUPER_ADMIN
    ↓
all organizations

HR_OFFICER
    ↓
assigned organization(s)

SHIFT_SUPERVISOR
    ↓
assigned factory/department

PAYROLL_OFFICER
    ↓
authorized payroll scope
```

A user must never be able to access another organization's data simply by changing:

```text
employeeId
requestId
factoryId
departmentId
```

in an HTTP request.

Authorization must validate ownership/scope server-side.

---

# 8. API ARCHITECTURE

Refactor backend routes into:

```text
route
 ↓
authentication
 ↓
authorization
 ↓
validation
 ↓
controller
 ↓
service
 ↓
repository/database
```

Do not put large business logic blocks directly inside route handlers.

Create service layers for:

```text
EmployeeService
LeaveService
PayrollService
ShiftService
AnnouncementService
NotificationService
AuditService
UploadService
AuthService
```

---

# 9. VALIDATION

Implement server-side schema validation.

Preferred:

**Zod** or another strong schema validation library compatible with the stack.

Every write endpoint must validate:

* body
* params
* query
* file metadata where applicable

Never rely on:

```javascript
Number(value) || 0
```

for important business data.

---

# 10. VACATION BALANCE SAFETY

Fix the current unrestricted mutation:

```javascript
employee.vacationBalance = Number(req.body.vacationBalance) || 0;
```

Implement strict validation.

At minimum:

```text
type: integer/decimal according to existing business rules
minimum: 0
maximum: configured business limit
```

Do NOT blindly hardcode `60` if the actual company policy differs.

Instead:

1. inspect existing business rules
2. determine the actual policy
3. centralize the configured limit
4. validate server-side
5. reject invalid values
6. record the change in audit history

Balance mutations must be transactional.

---

# 11. TRANSACTIONAL BUSINESS OPERATIONS

Critical operations must be atomic.

Examples:

```text
Approve Leave
Reject Leave
Modify Vacation Balance
Payroll Mutation
Shift Assignment
Employee Status Change
```

If an operation modifies multiple records:

```text
BEGIN
  update request
  update employee balance
  create audit record
  create notification
COMMIT
```

If any step fails:

```text
ROLLBACK
```

Never leave partially completed operations.

---

# 12. AUDIT LOGGING

Create immutable audit logs for sensitive operations.

Record:

```text
actor
role
action
entity
entityId
before
after
timestamp
IP
user agent where appropriate
request/correlation ID
```

Examples:

```text
APPROVE_LEAVE
REJECT_LEAVE
UPDATE_EMPLOYEE
UPDATE_VACATION_BALANCE
UPDATE_PAYROLL
UPDATE_SHIFT
CREATE_ANNOUNCEMENT
DELETE_ANNOUNCEMENT
LOGIN
LOGOUT
PERMISSION_DENIED
```

Audit logs must not be casually editable/deletable.

---

# 13. REALTIME ADMIN ↔ MOBILE BRIDGE

Implement realtime events.

Preferred:

**Socket.IO / WebSocket**

Fallback:

**SSE**

Do not rely on page refresh for critical state changes.

Required events include:

```text
leave.request.created
leave.request.approved
leave.request.rejected

announcement.created
announcement.updated
announcement.published

employee.updated

shift.created
shift.updated

payroll.updated

notification.created
```

Flow:

```text
Mobile App
    ↓
REST API
    ↓
Database Transaction
    ↓
Event Service
    ↓
WebSocket/SSE
    ↓
Admin Dashboard
```

For admin approval:

```text
Admin Dashboard
    ↓
REST API
    ↓
Database Transaction
    ↓
Notification Service
    ↓
FCM → Mobile
    ↓
Realtime event → Admin/other connected clients
```

IMPORTANT:

Realtime must NOT replace REST as the source of truth.

The database remains authoritative.

Implement:

* reconnect handling
* connection authentication
* event authorization
* duplicate event protection
* graceful fallback
* connection status indicator
* event version/timestamp if necessary

---

# 14. FCM / MOBILE NOTIFICATIONS

Preserve the existing FCM implementation.

Do not break existing mobile notifications.

Review:

* token lifecycle
* invalid token cleanup
* duplicate notifications
* notification failure handling
* retry strategy
* notification payload structure

If an admin approves/rejects a request:

The mobile application must receive the appropriate notification without requiring manual refresh.

---

# 15. IMAGE UPLOAD ARCHITECTURE

REMOVE:

```javascript
reader.readAsDataURL(file)
```

for production image uploads.

REMOVE Base64 JSON image transport.

Implement:

```text
multipart/form-data
```

with streaming upload handling.

Preferred backend:

```text
busboy
```

or another streaming-capable solution.

Requirements:

* file size limit
* MIME validation
* extension validation
* filename sanitization
* random generated storage name
* no executable files
* image content validation
* safe storage path
* collision protection
* cleanup of partial uploads
* upload timeout
* clear error responses

If image processing is needed:

* resize
* optimize
* strip unnecessary metadata
* generate appropriate formats

Do not trust:

```text
filename
extension
Content-Type
```

from the client alone.

---

# 16. PAGINATION

Every potentially large collection must support server-side pagination.

Examples:

```text
employees
leave requests
payroll records
shifts
announcements
audit logs
notifications
```

Standard API:

```text
?page=1
&pageSize=25
&sortBy=createdAt
&sortOrder=desc
```

Return metadata:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 300,
    "totalPages": 12,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

Maximum page size must be enforced server-side.

Example:

```text
max = 100
```

Do not allow:

```text
?pageSize=999999
```

---

# 17. SEARCH + FILTERING

Implement server-side search.

Employees:

```text
name
employeeCode
phone
department
factory
status
```

Requests:

```text
employee
type
status
date
department
factory
```

Payroll:

```text
employee
month
department
factory
status
```

Shifts:

```text
employee
date
factory
department
shift
```

Use debounced frontend search.

Do not download the entire dataset to filter it in the browser.

---

# 18. EMPLOYEE AUTOCOMPLETE

Replace huge:

```html
<select>
```

lists.

Create a reusable:

```text
EmployeeAutocomplete
```

Features:

* search by name
* employee code
* phone where allowed
* server-side query
* debounce
* keyboard navigation
* loading state
* empty state
* clear selection
* selected employee chip/card
* optional department/factory filter

Never load all 300/3000/30000 employees simply to populate a dropdown.

---

# 19. PROFESSIONAL FORM CONTROLS

Replace boolean text fields such as:

```text
Important (true/false)
```

with:

```text
Toggle / Switch
```

Correct data typing:

```javascript
important: boolean
```

Other examples:

```text
date → date picker
datetime → datetime picker
number → numeric input
money → currency input
enum → select
long text → textarea
boolean → switch
file → file uploader
employee → autocomplete
```

Never make HR users type programming values.

---

# 20. REMOVE window.prompt()

Remove every:

```javascript
prompt(...)
```

Replace with professional modal components.

Required:

### Reject Request Modal

Fields:

```text
Reason
Quick reason presets
Additional notes
Cancel
Reject Request
```

Quick presets:

```text
ضغط عمل في الوردية
استنفاد الرصيد
عدم وجود بديل
تعارض مع مواعيد العمل
```

But these are suggestions, not hardcoded limitations.

### Update Phone Modal

Fields:

```text
Employee
Current phone
New phone
Validation
Cancel
Save
```

All destructive actions require confirmation dialogs.

---

# 21. REQUEST DETAILS

The request table must NOT force HR to make blind decisions.

Add:

```text
View Details
```

Create a professional detail drawer/modal/page containing:

```text
Employee
Employee Code
Department
Factory
Request Type
Status
Start Date
End Date
Duration
Current Vacation Balance
Requested Balance Impact
Employee Notes
HR Notes
Attachments
Submitted At
Updated At
Decision
Decision By
Decision Time
Rejection Reason
History
```

For sensitive data, respect authorization.

---

# 22. RTL + ARABIC / ENGLISH

The dashboard must support:

```text
Arabic
English
```

Implement proper i18n.

Do NOT duplicate UI code manually.

Use translation dictionaries.

Example:

```text
ar.json
en.json
```

Arabic requirements:

```text
dir="rtl"
```

Use a professional Arabic font already compatible with the project's branding, or choose an appropriate production font.

Ensure:

* tables
* forms
* modals
* sidebar
* dropdowns
* notifications
* pagination
* charts
* numbers
* dates

work correctly in RTL.

Language switch must be instant.

Persist language preference safely.

---

# 23. DESIGN SYSTEM

Create a consistent enterprise design system.

Requirements:

* spacing scale
* typography scale
* colors
* status colors
* buttons
* forms
* tables
* modals
* cards
* badges
* alerts
* loading states
* empty states
* responsive layouts

The design should feel like a real enterprise HR system, not an admin template assembled from random components.

Prioritize:

```text
clarity
speed
accuracy
accessibility
low cognitive load
```

---

# 24. DATA TABLES

Implement production-grade tables.

Features:

* pagination
* sorting
* filtering
* search
* column consistency
* responsive behavior
* loading skeleton
* empty state
* error state
* row actions
* keyboard accessibility

Avoid rendering thousands of DOM rows simultaneously.

If necessary, introduce virtualization.

---

# 25. ERROR HANDLING

Implement centralized frontend API error handling.

Handle:

```text
400
401
403
404
409
422
429
500
503
network failure
timeout
```

UX examples:

```text
401 → redirect/login/session expired
403 → permission denied
409 → conflict message
422 → validation errors
429 → rate limit message
500 → generic safe error
network → retry option
```

Never show raw stack traces to HR users.

---

# 26. LOADING / EMPTY / ERROR STATES

Every asynchronous page must support:

```text
Loading
Success
Empty
Error
Retry
```

Do not leave blank screens.

Do not show stale data as if it were current.

For realtime pages show:

```text
● Connected
○ Reconnecting
× Offline
```

---

# 27. OPTIMISTIC UI

Use optimistic updates ONLY where safe.

For sensitive operations such as:

```text
leave approval
payroll
vacation balance
```

prefer:

```text
request
→ server confirms
→ update UI
```

Do not display a false successful state before the server commits.

---

# 28. CONCURRENCY CONTROL

Protect against:

```text
two admins approving the same request
two admins editing the same employee
stale payroll updates
duplicate submissions
```

Implement appropriate safeguards:

* database transactions
* status checks
* idempotency where needed
* optimistic locking/version fields where appropriate
* unique constraints

Example:

If a leave request is already approved:

```text
second approval attempt
→ 409 Conflict
→ clear UI message
```

---

# 29. RATE LIMITING

Protect sensitive endpoints:

```text
login
upload
admin mutations
notifications
```

Implement sensible rate limits.

Do not make rate limits so aggressive that normal HR workflows break.

---

# 30. SECURITY HEADERS

Review and implement appropriate security headers:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
Permissions-Policy
Frame protection
```

Use a production-compatible configuration.

Do not blindly copy a CSP that breaks the application.

---

# 31. INPUT SANITIZATION / XSS

Never trust:

```text
employee names
notes
announcement content
rejection reasons
uploaded filenames
query parameters
```

Avoid unsafe HTML rendering.

If rich text is required:

* sanitize it
* whitelist allowed tags/attributes

Do not use:

```javascript
dangerouslySetInnerHTML
```

without explicit sanitization.

---

# 32. DATABASE PERFORMANCE

Inspect all queries used by the admin dashboard.

Identify:

```text
N+1 queries
missing indexes
unbounded queries
unnecessary joins
duplicate queries
```

Add appropriate indexes for:

```text
employeeCode
departmentId
factoryId
status
createdAt
employeeId
requestId
date
```

ONLY after inspecting the actual schema and query patterns.

Do not add random indexes.

---

# 33. API RESPONSE CONSISTENCY

Standardize API responses.

Success:

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Readable message",
    "fields": {}
  }
}
```

Preserve backward compatibility where mobile clients depend on existing response formats.

If an API must change:

* version it
* maintain compatibility
* migrate consumers safely

---

# 34. API CLIENT

Create a centralized frontend API client.

Example conceptual API:

```text
api.get()
api.post()
api.put()
api.patch()
api.delete()
```

Responsibilities:

* authentication/session handling
* timeout
* retry policy where appropriate
* JSON parsing
* error normalization
* request IDs
* CSRF where required
* response validation

Do not scatter raw:

```javascript
fetch(...)
```

throughout components.

---

# 35. REALTIME EVENT ARCHITECTURE

Create a dedicated realtime layer.

Example:

```text
realtime/
├── socket.ts
├── events.ts
├── auth.ts
├── handlers.ts
└── connection-manager.ts
```

Frontend should subscribe by feature.

Example:

```text
useLeaveRealtime()
useAnnouncementRealtime()
useNotificationRealtime()
```

Avoid one giant global event handler.

---

# 36. NOTIFICATION CENTER

Implement a dashboard notification center.

Show:

```text
new leave request
approved/rejected operation
system alerts
important announcements
security alerts
```

Features:

* unread count
* mark as read
* mark all as read
* timestamp
* navigation to relevant entity

---

# 37. DASHBOARD OVERVIEW

Create a useful dashboard homepage.

Potential metrics:

```text
Employees
Pending Leave Requests
Today's Shifts
Payroll Status
Unread Notifications
Recent Activity
```

Do not create fake statistics.

All metrics must come from real backend data.

---

# 38. OBSERVABILITY

Implement production observability.

Backend:

* structured logs
* request IDs
* correlation IDs
* error logging
* latency tracking
* important business event logs

Frontend:

* controlled error logging
* failed request visibility
* realtime connection diagnostics

Never log:

```text
passwords
tokens
sensitive credentials
full sensitive employee data
```

---

# 39. HEALTH CHECKS

Add:

```text
/health
/ready
```

where appropriate.

Health check should verify required dependencies.

Example:

```text
API process
database connectivity
critical dependencies
```

Do not expose sensitive internal information.

---

# 40. BACKUP / RECOVERY

Inspect current database backup strategy.

If missing, document and implement a production-appropriate backup strategy.

At minimum define:

```text
backup frequency
retention
restore procedure
failure detection
```

Do not claim backups exist unless they actually work.

---

# 41. TESTING

Create a serious automated test suite.

## Unit tests

Test:

```text
vacation calculation
leave validation
permission checks
role checks
payroll calculations
date calculations
notification generation
```

## Integration tests

Test:

```text
login
RBAC
employee APIs
leave APIs
payroll APIs
shift APIs
announcement APIs
upload APIs
```

## Security tests

Test:

```text
unauthorized access
horizontal privilege escalation
vertical privilege escalation
IDOR
XSS
invalid uploads
invalid balances
rate limits
session security
```

## End-to-end tests

Test critical workflows:

```text
HR login
→ view leave request
→ open details
→ approve
→ employee receives notification

HR login
→ reject request
→ enter reason
→ employee receives rejection notification

HR
→ search employee
→ update allowed data
→ audit entry created
```

---

# 42. MOBILE COMPATIBILITY

This is critical.

Before changing backend APIs:

Inspect the mobile application's actual API calls.

Build a compatibility matrix:

```text
Endpoint
Current request
Current response
Mobile consumer
Admin consumer
Required change
Compatibility strategy
```

Do not break the mobile app.

After backend changes, run mobile API integration tests.

---

# 43. MIGRATION STRATEGY

Do not perform a dangerous "big bang" migration if avoidable.

Preferred:

```text
Phase A
Current system documented

Phase B
Backend security + validation

Phase C
API/service refactor

Phase D
Realtime infrastructure

Phase E
New admin frontend

Phase F
Migration/integration

Phase G
Old dashboard removal
```

Keep the system runnable after every phase.

---

# 44. ENVIRONMENT CONFIGURATION

Separate:

```text
development
test
production
```

Use environment variables.

Never hardcode:

* secrets
* passwords
* tokens
* database credentials
* FCM credentials
* production URLs

Provide:

```text
.env.example
```

with safe placeholders.

---

# 45. BUILD / DEPLOYMENT

The final system must be buildable.

Verify:

```text
npm install
npm run build
npm run test
npm run lint
```

and all project-specific commands.

If Docker is used:

```text
docker build
docker compose
health checks
production environment
```

must work.

If Vercel/other hosting is used, verify the actual deployment architecture rather than assuming.

---

# 46. ACCESSIBILITY

Implement:

* keyboard navigation
* focus management
* visible focus states
* semantic buttons
* labels
* ARIA where appropriate
* sufficient contrast
* accessible modals
* accessible tables
* screen-reader friendly status messages

Modal focus must be trapped appropriately.

ESC should close non-destructive modals.

---

# 47. RESPONSIVE DESIGN

Dashboard must work on:

```text
desktop
laptop
tablet
```

Mobile support is desirable but desktop HR usage is the primary target.

Sidebar should collapse appropriately.

Tables must remain usable on smaller screens.

---

# 48. SECURITY THREAT MODEL

Before finalizing, perform a threat-model review.

At minimum inspect:

```text
XSS
CSRF
IDOR
RBAC bypass
privilege escalation
session theft
session fixation
file upload attacks
path traversal
SQL injection
NoSQL injection if applicable
mass assignment
race conditions
replay attacks
brute force
rate-limit bypass
sensitive data exposure
```

For each:

```text
Risk
Current state
Fix
Verification
```

---

# 49. QA ACCEPTANCE CRITERIA

The refactor is NOT complete until all of the following are true:

## Architecture

* [ ] No giant Single-File SPA
* [ ] No global spaghetti functions
* [ ] No inline onclick handlers
* [ ] No giant innerHTML rendering
* [ ] Modular components
* [ ] Centralized API client
* [ ] Clear service boundaries

## Security

* [ ] No admin token in localStorage
* [ ] Secure authentication
* [ ] RBAC enforced server-side
* [ ] Scope isolation enforced
* [ ] Input validation
* [ ] XSS protection
* [ ] Upload security
* [ ] Rate limiting
* [ ] Audit logs

## UX

* [ ] No window.prompt
* [ ] Professional modals
* [ ] Request details
* [ ] Searchable employee autocomplete
* [ ] Pagination
* [ ] Arabic/English
* [ ] RTL
* [ ] Proper form controls
* [ ] Loading states
* [ ] Empty states
* [ ] Error states

## Performance

* [ ] Server-side pagination
* [ ] Server-side filtering
* [ ] No full dataset dumps
* [ ] No Base64 image uploads
* [ ] No unnecessary DOM recreation
* [ ] Database indexes reviewed
* [ ] N+1 queries reviewed

## Realtime

* [ ] Admin receives new requests instantly
* [ ] Admin receives updates instantly
* [ ] Mobile receives decision notifications
* [ ] Reconnection works
* [ ] Authorization works
* [ ] REST remains source of truth

## Reliability

* [ ] Transactions for critical operations
* [ ] Concurrency protection
* [ ] Consistent API errors
* [ ] Health checks
* [ ] Logging
* [ ] Backup/recovery strategy

## Testing

* [ ] Unit tests
* [ ] Integration tests
* [ ] Security tests
* [ ] E2E tests
* [ ] Mobile compatibility verified
* [ ] Production build verified

---

# 50. REQUIRED EXECUTION WORKFLOW

You MUST work in the following order.

## STEP 1 — DISCOVERY

Inspect the complete repository.

Output:

```text
Architecture Map
Dependency Map
Database Map
API Map
Authentication Map
Mobile Integration Map
Notification Map
File Upload Map
Deployment Map
```

Then identify risks.

---

## STEP 2 — BASELINE

Before modifying anything:

Run:

```text
build
lint
tests
typecheck if available
```

Record current results.

Create a git checkpoint/branch if git is available.

---

## STEP 3 — SECURITY FOUNDATION

Fix:

```text
authentication
session handling
RBAC
scope isolation
validation
audit logging
rate limiting
upload security
```

Do not redesign UI yet.

---

## STEP 4 — BACKEND ARCHITECTURE

Refactor:

```text
routes
controllers
services
validators
middleware
repositories
realtime
uploads
audit
```

without breaking mobile compatibility.

---

## STEP 5 — REALTIME

Implement realtime infrastructure.

Test:

```text
mobile → server → admin
admin → server → mobile
```

---

## STEP 6 — FRONTEND MIGRATION

Build the modular admin frontend.

Implement:

```text
routing
layout
components
pages
state
API client
forms
tables
pagination
search
modals
i18n
RTL
```

---

## STEP 7 — PERFORMANCE

Measure and fix:

```text
API latency
database queries
render performance
bundle size
image upload performance
large-table performance
```

Do not optimize blindly.

Measure first.

---

## STEP 8 — TESTING

Run all automated tests.

Then manually test critical workflows.

---

## STEP 9 — PRODUCTION HARDENING

Verify:

```text
environment variables
security headers
logging
health checks
backup
error handling
deployment
```

---

## STEP 10 — FINAL AUDIT

Perform a second independent audit as if you are an external security auditor.

Try to break:

```text
RBAC
IDOR
authentication
uploads
leave approval
balance mutation
payroll access
scope isolation
realtime
mobile compatibility
```

Fix every real issue discovered.

---

# 51. IMPORTANT IMPLEMENTATION PRINCIPLE

Do NOT blindly follow the original teardown if a claim is technically inaccurate.

For every proposed fix:

```text
verify current implementation
→ determine actual risk
→ implement appropriate solution
```

Example:

Do not automatically add WebSockets just because they sound modern.

If SSE is sufficient, use SSE.

If Socket.IO is justified, use Socket.IO.

Choose based on:

```text
project architecture
deployment
scalability
mobile compatibility
operational complexity
```

Likewise, do not blindly impose arbitrary business limits such as `60 vacation days`.

Use the actual business rules discovered in the project.

---

# 52. DEFINITION OF DONE

The project is DONE only when:

```text
The dashboard is modular.
The backend is layered.
Authentication is secure.
RBAC is enforced server-side.
Sensitive operations are audited.
Uploads are streaming and validated.
Large datasets are paginated.
Employees are searchable.
Forms use correct controls.
No prompt() remains.
No admin token is stored in localStorage.
Arabic/English works.
RTL works.
Realtime works.
FCM still works.
Mobile APIs remain compatible.
Critical operations are transactional.
Race conditions are handled.
Errors are standardized.
Tests pass.
Production build passes.
Deployment is documented.
```

---

# 53. FINAL REPORT

At the end, produce:

## A. What changed

Detailed list of implemented changes.

## B. Architecture before vs after

Show:

```text
BEFORE
Single-file dashboard
↓
global JS
↓
REST
↓
database

AFTER
Modular frontend
↓
typed API client
↓
authenticated API
↓
RBAC
↓
validation
↓
controllers
↓
services
↓
database
↓
events
↓
realtime / FCM
```

## C. Security report

For every security issue:

```text
Issue
Severity
Fix
Verification
```

## D. API compatibility report

List every changed endpoint and prove mobile compatibility.

## E. Test report

Show:

```text
Unit
Integration
Security
E2E
Build
Lint
Typecheck
```

with PASS/FAIL.

## F. Remaining risks

Only list real remaining risks.

Do not claim 100% secure.

## G. Production readiness score

Rate:

```text
Architecture /10
Security /10
Performance /10
Reliability /10
UX /10
Accessibility /10
Testing /10
Mobile Integration /10
Observability /10
Deployment /10
```

Then give an overall score.

---

# FINAL COMMAND

Start with repository discovery.

Do NOT ask me to manually fix individual files.

Do NOT stop after analysis.

Do NOT merely generate recommendations.

**Inspect → Plan → Implement → Test → Break → Fix → Re-test → Report.**

Every change must be production-oriented and must preserve existing functionality.

If you encounter ambiguity, inspect the codebase and existing behavior first rather than inventing assumptions.

The final result must be a **real production-ready HR Admin Dashboard and Mobile Bridge**, not a demo.
