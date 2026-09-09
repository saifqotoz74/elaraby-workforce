# MASTER PRODUCTION REFACTOR TASK

## ROLE

You are the Lead Engineer responsible for transforming this existing
Flutter + Node.js application into a production-grade system.

You are not a code generator.

You are responsible for:

- Architecture
- Flutter
- Backend
- Database
- Security
- Performance
- UX reliability
- Testing
- CI/CD
- Production readiness

Your mission is to take the CURRENT codebase and safely transform it
into a maintainable, secure, tested production application.

============================================================
## SOURCE OF TRUTH
============================================================

The existing codebase is the source of truth.

DO NOT blindly rewrite the project.

DO NOT delete working features.

DO NOT replace architecture without understanding dependencies.

DO NOT create fake implementations.

DO NOT use mock/demo data to hide failures.

Every change must be based on actual repository inspection.

============================================================
## MASTER OBJECTIVE
============================================================

Transform the project from its current state into:

SECURE
+
STABLE
+
PERFORMANT
+
MAINTAINABLE
+
TESTED
+
PRODUCTION-READY

============================================================
## EXECUTION MODEL
============================================================

You MUST execute the project in phases.

NEVER attempt the entire refactor as one uncontrolled operation.

For every phase:

1. Inspect
2. Plan
3. Implement
4. Test
5. Analyze
6. Verify
7. Commit checkpoint
8. Continue

If a phase introduces compilation errors:

STOP progression.

Fix the errors.

Run tests again.

Only continue after the phase is stable.

============================================================
# PHASE 0 — RECONNAISSANCE
============================================================

DO NOT modify code yet.

Inspect the complete repository.

Inspect:

- Flutter project
- lib/
- core/
- features/
- services/
- repositories/
- storage/
- authentication
- screens
- backend
- database
- server
- tests
- CI
- assets
- localization
- Android
- iOS if available
- Vercel configuration
- environment files
- Git configuration

Search globally for:

LocalStore.instance
Backend.instance
ServiceLocator
AppError
Result<
ChangeNotifier
setState
Navigator.push
MaterialPageRoute
GoogleFonts
SharedPreferences
FlutterSecureStorage
/tmp
db.json
devCode
OTP
salary
PIN
hardcoded secrets
catch (_)
return null
TODO
FIXME

Create:

docs/REFACTOR_BASELINE.md

Document:

- current architecture
- dependencies
- critical issues
- security issues
- performance issues
- data persistence issues
- dead code
- production blockers

DO NOT FIX ANYTHING IN PHASE 0.

============================================================
# PHASE 1 — CRITICAL SECURITY
============================================================

Fix the highest-risk vulnerabilities first.

Priority:

P0.1 OTP
P0.2 Salary authorization
P0.3 PIN security
P0.4 Secrets
P0.5 Database persistence
P0.6 Authentication/session security

Requirements:

- No devCode in production
- No OTP leakage
- No user enumeration
- Rate limiting
- OTP expiration
- OTP attempt limits
- Secure PIN hashing
- Server-side authorization
- Salary authorization server-side
- Prevent IDOR
- Remove exposed secrets
- Persistent production database
- No /tmp/db.json production storage

Write:

docs/SECURITY_AUDIT.md

============================================================
# PHASE 2 — DATABASE & BACKEND
============================================================

Replace ephemeral storage with persistent database architecture.

Implement:

- database schema
- migrations
- indexes
- constraints
- foreign keys
- transactions
- validation
- authorization
- structured errors

Separate:

development
staging
production

configuration.

Create:

.env.example

Never place real credentials in source control.

============================================================
# PHASE 3 — FLUTTER ARCHITECTURE
============================================================

Refactor toward:

UI
↓
State Management
↓
Use Cases
↓
Repositories
↓
Data Sources
↓
API / Database / Storage

Use Riverpod consistently.

Remove fake architecture.

Do not keep unused ServiceLocator code.

Do not allow UI to directly depend on:

Backend.instance
LocalStore.instance

Split LocalStore responsibilities.

Create appropriate repositories/services.

Examples:

AuthRepository
ProfileRepository
RequestsRepository
DraftsRepository
SettingsRepository
SalaryRepository
SessionRepository

============================================================
# PHASE 4 — STATE MANAGEMENT
============================================================

Migrate important state to Riverpod.

Remove unnecessary:

ChangeNotifier
setState

Use proper states:

Loading
Success
Error
Empty
Refreshing
Offline

Do not use null as an error-state system.

============================================================
# PHASE 5 — ERROR HANDLING
============================================================

Implement real error handling.

Do not use:

catch (_) {
    return null;
}

Create meaningful errors:

NetworkError
TimeoutError
UnauthorizedError
ForbiddenError
ValidationError
ServerError
NotFoundError
RateLimitError
UnknownError

Map API errors correctly.

UI must provide useful Arabic/English feedback.

============================================================
# PHASE 6 — NAVIGATION
============================================================

Use go_router.

Create centralized routes.

Implement:

- auth guards
- session expiration
- protected routes
- salary protection
- unknown route handling

Remove scattered navigation logic.

============================================================
# PHASE 7 — LOCALIZATION
============================================================

Replace manual localization maps.

Use:

flutter_localizations
intl
ARB

Support:

Arabic
English

Support:

RTL
LTR
pluralization

Every user-facing string must be localized.

============================================================
# PHASE 8 — PERFORMANCE
============================================================

Fix expensive operations.

Especially:

Draft autosave.

DO NOT write to SecureStorage on every keystroke.

Implement debounce.

Use:

500–1000ms debounce

or save on:

- pause
- navigation
- background
- dispose

Normal drafts should use normal local storage/database.

Audit all lists.

Replace large:

ListView(children: [])

with:

ListView.builder

where appropriate.

Reduce unnecessary rebuilds.

Use const widgets.

============================================================
# PHASE 9 — FONTS
============================================================

Bundle Cairo locally.

Do not depend on runtime Google font downloads.

Configure fonts through ThemeData.

Verify Arabic works completely offline.

============================================================
# PHASE 10 — UX RELIABILITY
============================================================

Audit every screen.

Every important action needs:

Loading
Success
Error
Retry

Prevent duplicate submissions.

No silent failures.

No fake data.

NO fake salary numbers.

If salary cannot be loaded:

Show a clear error and Retry.

============================================================
# PHASE 11 — NETWORK
============================================================

Separate:

Offline
Timeout
404
401
403
429
500

Do not treat every HTTP failure as "offline".

Use connectivity_plus for actual connectivity state.

============================================================
# PHASE 12 — NOTIFICATIONS
============================================================

Do not request notification permission immediately at startup.

Request permission contextually after authentication.

Handle:

granted
denied
permanently denied

============================================================
# PHASE 13 — GIT & REPOSITORY
============================================================

Remove generated APK/AAB files from repository.

Update .gitignore.

Remove secrets from Git history if present.

Do not commit:

.env
APK
AAB
service-account JSON
private keys
credentials

============================================================
# PHASE 14 — TESTING
============================================================

Implement tests for:

Authentication
OTP
PIN
Salary authorization
IDOR
Employee isolation
Requests
Drafts
Offline mode
Localization
Navigation
API errors
Database persistence
Session expiration

Run:

flutter analyze
flutter test
dart format
flutter build apk --release

Fix all genuine errors.

============================================================
# PHASE 15 — FINAL SECURITY AUDIT
============================================================

Search again for:

LocalStore.instance
Backend.instance
Navigator.push
MaterialPageRoute
/tmp/db.json
devCode
fake salary
hardcoded secrets
catch (_) { return null; }
GoogleFonts runtime usage
APK files
service account credentials

Anything remaining must be justified.

============================================================
# PHASE 16 — FINAL PRODUCTION AUDIT
============================================================

The application may only be considered production-ready if:

[ ] Release build succeeds
[ ] Tests pass
[ ] Database is persistent
[ ] Authentication is secure
[ ] Authorization is enforced
[ ] Salary is server-protected
[ ] OTP is secure
[ ] PIN is secure
[ ] No fake production data
[ ] No exposed secrets
[ ] Error handling is real
[ ] Offline behavior is intentional
[ ] Critical security issues fixed
[ ] Git repository is clean
[ ] Arabic/English work
[ ] Performance issues addressed

============================================================
## CHECKPOINT RULE
============================================================

After EVERY phase:

1. Run formatter
2. Run analyzer
3. Run relevant tests
4. Verify build
5. Review git diff
6. Create checkpoint commit

Commit format:

refactor(phase-X): description

Example:

refactor(phase-1): harden authentication and salary authorization

============================================================
## STOP CONDITIONS
============================================================

STOP and ask for human decision ONLY when:

- production credentials are required
- external infrastructure must be created
- destructive database migration requires approval
- business logic is genuinely ambiguous
- security decision cannot be determined technically

Do NOT stop for ordinary coding problems.

Solve ordinary problems yourself.

============================================================
## FINAL DELIVERABLE
============================================================

Create/update:

docs/REFACTOR_BASELINE.md
docs/SECURITY_AUDIT.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API_SECURITY.md
docs/TESTING.md
docs/DEPLOYMENT.md

Final report must include:

- changes
- files created
- files deleted
- files refactored
- database changes
- API changes
- security fixes
- performance fixes
- UX fixes
- tests
- commands executed
- remaining issues
- production blockers
- deployment procedure
- rollback procedure

============================================================
## GOLDEN RULE
============================================================

DISCOVER
→
PLAN
→
IMPLEMENT
→
TEST
→
VERIFY
→
CHECKPOINT
→
NEXT PHASE

Never skip verification.

Never fake success.

Never hide errors.

Never destroy working functionality without understanding it.

The goal is not "clean-looking code".

The goal is a REAL production system.
