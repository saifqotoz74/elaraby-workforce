# MASTER PRODUCTION ENTERPRISE REMEDIATION & HARDENING PROMPT

## ROLE

You are acting as a **Principal Enterprise Software Architect, Staff Backend Engineer, DevSecOps Engineer, Database Architect, Distributed Systems Engineer, Mobile Release Engineer, and Senior QA/Automation Lead**.

Your mission is to take the existing project from its current state:

* Application Security: ~9.5/10
* Code & Logic: ~9.5/10
* Mobile UI/UX: ~9.0/10
* Scalability: ~6.5/10
* Operational Readiness: ~5.0/10
* 369 automated tests currently passing at 100%
* Backend currently using `server/data/db.json`
* External credentials are not yet available
* Background jobs are not yet separated from the API process
* ERP/biometric integrations are not yet implemented
* Production observability is incomplete

and transform it into a **real Enterprise Production-Ready architecture** suitable for deployment to a large organization serving **thousands to tens of thousands of employees across multiple sites/factories**, without destroying currently working functionality.

---

# NON-NEGOTIABLE PRINCIPLES

1. **Do NOT blindly rewrite the project.**
2. Preserve all currently working business logic unless there is a documented architectural reason to change it.
3. Existing functionality must remain backward-compatible unless a breaking change is absolutely necessary.
4. Do not remove working tests.
5. Do not weaken security in order to simplify implementation.
6. Do not fake external integrations as production integrations.
7. Never hardcode secrets, API keys, private certificates, service accounts, passwords, tokens, or credentials.
8. Never fabricate unavailable production credentials.
9. When credentials are unavailable, implement the complete integration architecture using:

   * environment variables
   * secret references
   * provider adapters
   * mocks/stubs for testing
   * explicit production configuration checks
10. No destructive migration without backup and rollback strategy.
11. Every migration must be measurable and verifiable.
12. Every asynchronous job must be idempotent.
13. Every external integration must handle:

* timeout
* retry
* exponential backoff
* duplicate events
* rate limits
* partial failure
* provider outage

14. No heavy operation may block the primary API event loop.
15. No architectural claim may be considered complete without evidence.
16. Never report "production ready" based only on code compilation.
17. Never say "done" unless validation evidence exists.
18. Prefer boring, reliable, maintainable enterprise technology over unnecessary complexity.
19. Do not introduce microservices unless there is an actual operational requirement.
20. The default architecture should remain a **Modular Monolith + Workers + PostgreSQL + Redis**, unless the existing project contains a compelling reason to use another architecture.
21. Keep the current application behavior intact while progressively replacing infrastructure underneath it.
22. Favor zero-downtime or near-zero-downtime migration strategies whenever practical.

---

# PRIMARY OBJECTIVE

Solve ALL FIVE architectural and operational gaps:

### GAP 1 — Replace `db.json` with PostgreSQL

### GAP 2 — Productionize SMS / Firebase / Store Credentials

### GAP 3 — Add Redis + BullMQ Background Processing

### GAP 4 — Design and implement ERP / Biometric Integration Architecture

### GAP 5 — Implement Production Observability / Monitoring / Alerting

Additionally harden the project for:

* multi-instance deployment
* horizontal scaling
* disaster recovery
* backup / restore
* CI/CD
* release management
* secret management
* health checks
* readiness checks
* graceful shutdown
* auditability
* performance testing
* failure recovery
* production diagnostics

---

# PHASE 0 — FULL BASELINE AUDIT BEFORE CHANGING CODE

First inspect the repository completely.

Analyze:

* directory structure
* backend architecture
* mobile architecture
* database layer
* repositories
* services
* controllers/routes
* authentication
* authorization
* tenant boundaries
* file storage
* notifications
* OTP
* employee data model
* attendance
* leave management
* payroll-related logic
* admin dashboard
* configuration
* environment variables
* tests
* scripts
* deployment files
* Docker files
* CI/CD files
* logging
* error handling
* realtime features
* background tasks
* external APIs
* integration points

Search the entire repository for:

* `db.json`
* filesystem persistence
* JSON reads/writes
* synchronous heavy operations
* long loops inside HTTP handlers
* scheduled jobs
* timers
* `setInterval`
* `setTimeout`
* direct external HTTP calls
* hardcoded URLs
* secrets
* API keys
* service-account references
* Firebase configuration
* SMS providers
* payroll exports
* attendance imports
* biometric references
* SAP
* Oracle
* ERP
* webhook
* retry
* queue
* worker
* logging
* monitoring
* health checks

### Baseline requirements

Before modifying anything:

1. Run the existing test suite.
2. Capture the exact baseline test count.
3. Capture pass/fail result.
4. Capture build status.
5. Capture lint/type-check status if available.
6. Capture current startup commands.
7. Capture current environment variables.
8. Produce a concise architecture map.

Create:

`docs/PRODUCTION_BASELINE.md`

containing:

* current architecture
* current limitations
* current tests
* current risks
* migration strategy
* rollback strategy
* dependencies to be added
* dependencies intentionally NOT added
* expected final architecture

Do not modify business logic during this phase unless required to make the project inspectable or testable.

---

# PHASE 0 GATE — BASELINE VALIDATION

STOP only if the baseline itself is inconsistent or the repository cannot be safely changed.

Otherwise continue automatically.

You MUST NOT begin destructive migration until the baseline is documented.

---

# PHASE 1 — TARGET ENTERPRISE ARCHITECTURE

Design a target architecture similar to:

```text
                    ┌──────────────────────┐
                    │     Mobile Apps      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    API / Backend      │
                    │   Modular Monolith    │
                    └───────┬───────┬───────┘
                            │       │
                ┌───────────┘       └────────────┐
                ▼                                ▼
        ┌───────────────┐                ┌───────────────┐
        │ PostgreSQL    │                │ Redis         │
        │ Primary DB    │                │ Cache/Queue   │
        └──────┬────────┘                └──────┬────────┘
               │                                │
               │                                ▼
               │                        ┌───────────────┐
               │                        │ BullMQ Worker │
               │                        │ Background    │
               │                        │ Jobs          │
               │                        └──────┬────────┘
               │                               │
               └───────────────────────────────┼─────────────┐
                                               │             │
                                               ▼             ▼
                                      External Integrations
                                      - SMS
                                      - FCM
                                      - ERP
                                      - Biometrics
                                      - Webhooks

                         Observability Layer
                    ┌────────────────────────────┐
                    │ Logs / Metrics / Traces    │
                    │ Sentry / Prometheus etc.   │
                    └────────────────────────────┘
```

Do not implement unnecessary microservices.

The default deployment should support:

* 1 API instance for development
* multiple API instances in staging/production
* 1+ background workers
* centralized PostgreSQL
* centralized Redis
* shared/object storage when required
* load balancer / reverse proxy
* centralized observability

---

# PHASE 2 — DATABASE MIGRATION TO POSTGRESQL

## Objective

Completely eliminate production dependency on:

`server/data/db.json`

PostgreSQL must become the authoritative source of truth.

### Requirements

1. Design the relational schema.
2. Preserve existing entities and relationships.
3. Add appropriate:

   * primary keys
   * foreign keys
   * indexes
   * unique constraints
   * check constraints where useful
4. Review all existing query patterns.
5. Avoid N+1 query behavior.
6. Add indexes for:

   * employee lookups
   * tenant lookups
   * attendance
   * leave requests
   * notifications
   * payroll-related retrieval
   * timestamps
   * statuses
   * frequently filtered fields
7. Use transactions for multi-step business operations.
8. Add migration files.
9. Add a database seed strategy.
10. Add test database support.
11. Add connection pooling.
12. Add production-safe connection configuration.

## Data migration

Build a deterministic migration utility:

```text
db.json
   ↓
validation
   ↓
normalization
   ↓
transformation
   ↓
PostgreSQL
   ↓
verification
```

The migration tool must:

* never silently discard records
* report malformed records
* preserve IDs where practical
* preserve timestamps where practical
* preserve relationships
* validate record counts
* validate referential integrity
* generate migration summary
* support dry-run
* support retry
* be repeatable/idempotent
* produce a migration log

Create something similar to:

`/scripts/migrate-json-to-postgres`

with:

* `--dry-run`
* `--validate`
* `--execute`
* `--verify`

Do NOT delete `db.json` immediately.

First introduce a compatibility layer.

---

# DUAL-READ / CUTOVER STRATEGY

Implement the migration in stages:

### Stage A

PostgreSQL schema exists.

### Stage B

Data imported.

### Stage C

Application can read from PostgreSQL.

### Stage D

Application writes to PostgreSQL.

### Stage E

Validation confirms PostgreSQL matches expected state.

### Stage F

PostgreSQL becomes authoritative.

### Stage G

Legacy JSON persistence is disabled.

### Stage H

Only after successful production verification may old persistence be removed.

Where practical, use:

* feature flags
* repository abstraction
* read/write adapters

Do not scatter database-specific code throughout business logic.

Preferred pattern:

```text
Controller
   ↓
Application Service
   ↓
Repository Interface
   ↓
PostgreSQL Repository
```

---

# DATABASE RELIABILITY

Implement:

* startup DB connectivity check
* graceful connection failure
* retry where appropriate
* transaction handling
* connection pool monitoring
* migration versioning
* health endpoint
* readiness endpoint

Create documentation covering:

* backup
* restore
* disaster recovery
* migration rollback
* retention
* recovery objectives

---

# DATABASE ACCEPTANCE CRITERIA

The database phase is not complete until:

* application runs without `db.json`
* all required tests pass
* migration utility succeeds
* migrated record counts are verified
* relations are verified
* core workflows are tested against PostgreSQL
* concurrent requests are tested
* transaction integrity is tested
* no production code depends on local JSON persistence

---

# PHASE 3 — REDIS + BULLMQ BACKGROUND JOB SYSTEM

Introduce Redis and BullMQ.

Do NOT move everything into queues.

Only move operations that are:

* expensive
* long-running
* batch-oriented
* externally dependent
* retryable
* scheduled
* asynchronous by nature

Examples:

* bulk payroll preparation
* bulk leave-balance calculations
* notifications
* SMS
* Firebase push delivery
* report generation
* employee imports
* attendance synchronization
* ERP synchronization
* large exports
* scheduled maintenance jobs

---

# JOB ARCHITECTURE

Implement:

```text
API
 ↓
Queue
 ↓
Redis
 ↓
BullMQ Worker
 ↓
Job Handler
 ↓
Database / External Provider
```

Every job must have:

* unique job ID
* idempotency key
* retry policy
* exponential backoff
* max attempts
* timeout
* structured logs
* failure reason
* status
* progress when useful
* dead-letter/failure handling
* safe cancellation strategy where practical

Example job states:

```text
queued
processing
completed
failed
retrying
cancelled
```

---

# REQUIRED QUEUES

Create logical queues as appropriate, such as:

```text
notifications
sms
push
payroll
leave
reports
attendance-sync
erp-sync
imports
exports
```

Do not create unnecessary queues.

---

# API NON-BLOCKING RULE

The HTTP request path must NOT perform large synchronous operations such as:

```text
15,000 payroll calculations
15,000 SMS sends
15,000 push notifications
large employee imports
large report generation
mass attendance processing
```

The API must return quickly with a job reference when asynchronous execution is appropriate.

Example:

```json
{
  "jobId": "....",
  "status": "queued"
}
```

Add APIs to query job status when needed.

---

# WORKER RELIABILITY

Workers must support:

* graceful shutdown
* concurrency configuration
* retry
* timeout
* duplicate protection
* stalled job recovery
* failed job inspection
* structured logs

Ensure worker crashes do not corrupt business state.

For important workflows use:

* DB transaction
* outbox/event pattern where appropriate
* idempotency

---

# PHASE 4 — SMS PRODUCTION INTEGRATION

Implement a provider abstraction.

Example:

```text
SmsProvider
 ├── CequensProvider
 ├── VodafoneProvider
 ├── VictoryLinkProvider
 └── MockSmsProvider
```

Do not tightly couple business logic to one provider.

Create configuration such as:

```env
SMS_PROVIDER=
SMS_API_URL=
SMS_API_KEY=
SMS_API_SECRET=
SMS_SENDER_ID=
SMS_ENABLED=
```

Do NOT invent credentials.

Development/test:

`MockSmsProvider`

Production:

Real provider only when credentials exist.

---

# OTP PRODUCTION REQUIREMENTS

Verify and maintain:

* secure OTP generation
* expiration
* attempt limit
* rate limiting
* brute-force protection
* replay protection
* hashing where appropriate
* no plaintext OTP logging
* provider failure handling
* resend cooldown

Never log:

* OTP values
* SMS credentials
* access tokens

---

# SMS FAILURE STRATEGY

Implement:

```text
request
 ↓
queue
 ↓
provider
 ↓
success
```

or:

```text
provider failure
 ↓
retry
 ↓
retry exhausted
 ↓
failed job
 ↓
observability alert
```

Never cause the whole API to fail because the SMS provider is temporarily unavailable unless the business operation explicitly requires synchronous confirmation.

---

# PHASE 5 — FIREBASE CLOUD MESSAGING

Implement a proper Firebase adapter.

Required environments:

```text
development
staging
production
```

Never commit real credentials.

Support secure configuration via environment/secret management.

Handle:

* token registration
* token refresh
* invalid token
* revoked token
* retry
* rate limits
* provider errors
* bulk notifications
* notification preferences

Create:

`FirebasePushProvider`

and:

`MockPushProvider`

---

# MOBILE FIREBASE CONFIGURATION

Prepare production-ready configuration structure for:

Android:

```text
google-services.json
```

iOS:

```text
GoogleService-Info.plist
```

Do not invent or create fake production credentials.

When files are missing, fail clearly at release configuration validation instead of pretending production is configured.

---

# PHASE 6 — ERP INTEGRATION ARCHITECTURE

Do NOT assume the company uses one specific ERP implementation.

Build an integration boundary supporting different enterprise providers.

Example:

```text
ERP Integration Interface
        │
        ├── SAP Adapter
        ├── Oracle Adapter
        ├── REST Adapter
        ├── SOAP Adapter
        ├── SFTP Adapter
        └── Mock Adapter
```

The core application must not contain SAP-specific logic.

---

# ERP DATA DOMAINS

Prepare integration boundaries for:

* employee master data
* organizational structure
* departments
* positions
* employee status
* attendance
* leave balances
* leave transactions
* payroll summary
* payslip metadata
* locations/sites
* cost centers

Only implement real provider mapping where the required API/schema is known.

Do not invent undocumented SAP/Oracle endpoints.

Where provider details are unavailable:

* build interfaces
* build adapters
* build mock implementations
* build contract tests
* document required production mappings

---

# SYNC ARCHITECTURE

Support:

### Pull synchronization

```text
ERP
 ↓
Scheduled Job
 ↓
Integration Adapter
 ↓
Validation
 ↓
Mapping
 ↓
Database
```

### Push synchronization

```text
ERP
 ↓
Webhook/Event
 ↓
Webhook Handler
 ↓
Validation
 ↓
Queue
 ↓
Processing Worker
 ↓
PostgreSQL
```

---

# ERP SYNC SAFETY

Implement:

* idempotency
* external IDs
* source timestamps
* versioning where needed
* reconciliation
* duplicate detection
* partial failure handling
* dead-letter handling
* retry
* audit logs

Maintain a synchronization audit record containing:

* source
* entity
* external ID
* sync time
* result
* error
* retry count

---

# BIOMETRIC / ATTENDANCE INTEGRATION

Prepare an integration layer for attendance devices/systems.

Do NOT assume a specific hardware vendor.

Support possible mechanisms:

* REST API
* SOAP
* SFTP/CSV
* database connector
* scheduled export
* webhook/event

Create a normalized attendance model inside the application.

Example flow:

```text
Biometric Source
 ↓
Adapter
 ↓
Validation
 ↓
Normalization
 ↓
Queue
 ↓
Worker
 ↓
PostgreSQL
 ↓
Business Rules
```

The mobile application must consume normalized internal data rather than vendor-specific formats.

---

# RECONCILIATION SYSTEM

Implement reconciliation capabilities for external systems.

Example:

```text
source records
vs
internal records
```

Report:

* missing employee
* duplicate record
* changed record
* failed synchronization
* outdated record

---

# PHASE 7 — OBSERVABILITY / APM

Implement production observability.

At minimum:

## Logs

Structured logs with fields such as:

```text
timestamp
level
service
environment
requestId
userId
employeeId
tenantId
jobId
route
duration
statusCode
errorCode
```

Never log secrets or sensitive authentication data.

---

# REQUEST CORRELATION

Every request should have a correlation/request ID.

Propagate it through:

```text
Mobile
 ↓
API
 ↓
Service
 ↓
Queue
 ↓
Worker
 ↓
External Provider
```

Where possible maintain:

* request ID
* trace ID
* job ID

---

# ERROR TRACKING

Integrate an error-monitoring abstraction.

Preferred options may include:

* Sentry

But the system must not become fundamentally dependent on one provider.

Implement:

```text
ErrorReporter
 ├── SentryReporter
 └── NoOpReporter / LocalReporter
```

For production, errors should contain enough context to investigate without exposing secrets.

---

# METRICS

Expose application metrics for:

### API

* request count
* error rate
* latency
* status codes
* slow endpoints

### Database

* query latency where practical
* pool usage
* connection failures

### Queue

* queue depth
* job processing time
* failed jobs
* retries
* stalled jobs

### External providers

* SMS success/failure
* Firebase success/failure
* ERP sync success/failure
* biometric sync success/failure

---

# HEALTH ENDPOINTS

Implement at least:

```text
/health
/readiness
/liveness
```

Health should answer whether the process is alive.

Readiness should answer whether required dependencies are available.

Do not make liveness fail just because PostgreSQL or Redis is temporarily unavailable.

---

# ALERTING

Prepare alerts for:

* high API error rate
* abnormal latency
* database unavailable
* Redis unavailable
* queue backlog
* worker crash
* repeated job failures
* SMS provider failure spike
* Firebase failure spike
* ERP synchronization failure
* attendance synchronization failure

Do not create noisy alerts for every individual transient error.

Use thresholds and aggregation.

---

# PHASE 8 — SECURITY & SECRETS MANAGEMENT

Audit all secrets.

Search for:

```text
API_KEY
SECRET
TOKEN
PASSWORD
PRIVATE_KEY
SERVICE_ACCOUNT
JWT
DATABASE_URL
FIREBASE
SMS
```

Replace any hardcoded secrets with environment/secret references.

Create:

`.env.example`

containing placeholders only.

Example:

```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
SMS_PROVIDER=
SMS_API_KEY=
FIREBASE_PROJECT_ID=
SENTRY_DSN=
ERP_BASE_URL=
```

Never put production secrets in git.

Add secret scanning where practical.

---

# PHASE 9 — CONTAINERIZATION & DEPLOYMENT

Create production-safe deployment artifacts.

At minimum prepare:

```text
API
WORKER
POSTGRES
REDIS
```

using environment-driven configuration.

Development may use Docker Compose.

Production should support independently scalable API and worker processes.

Example:

```text
Load Balancer
      │
 ┌────┴─────┐
 │          │
API #1     API #2
 │          │
 └────┬─────┘
      │
   PostgreSQL
      │
     Redis
      │
 ┌────┴─────┐
 │          │
Worker #1  Worker #2
```

---

# GRACEFUL SHUTDOWN

API and workers must handle:

* SIGTERM
* SIGINT

Before exiting:

* stop accepting new work
* finish safe in-flight work
* close queue connections
* close DB connections
* flush logs where practical

Workers must not lose active jobs silently.

---

# PHASE 10 — BACKUP & DISASTER RECOVERY

Document and prepare:

* PostgreSQL backup strategy
* backup retention
* restore process
* point-in-time recovery considerations
* Redis role clarification
* disaster recovery assumptions
* restore testing

Important:

Redis must NOT become the source of truth for permanent business data.

PostgreSQL is authoritative.

---

# PHASE 11 — DATABASE BACKUP VERIFICATION

A backup is NOT considered valid merely because a backup command succeeded.

Create procedures/tests to verify:

```text
backup
 ↓
restore into temporary environment
 ↓
integrity checks
 ↓
application smoke test
```

Document the verified restore procedure.

---

# PHASE 12 — CI/CD

Build or improve CI/CD.

Pipeline should include:

```text
install
 ↓
lint
 ↓
typecheck
 ↓
unit tests
 ↓
integration tests
 ↓
migration validation
 ↓
build backend
 ↓
build mobile
 ↓
security checks
 ↓
artifact generation
```

Where practical add:

* dependency audit
* secret scanning
* container scanning
* test coverage reporting

---

# TESTING STRATEGY

Maintain the existing 369 tests.

Then add new tests for the new architecture.

Required categories:

## Database

* migration tests
* repository tests
* transaction tests
* concurrency tests
* constraints
* rollback tests

## Queue

* job creation
* retry
* duplicate jobs
* idempotency
* failed jobs
* worker recovery
* stalled jobs

## SMS

* provider success
* provider failure
* retry
* invalid credentials
* timeout
* rate limit

## Firebase

* successful delivery
* invalid token
* provider outage
* retry

## ERP

* mapping
* authentication failure
* timeout
* duplicate data
* partial sync
* reconciliation

## Observability

* correlation IDs
* structured logs
* error reporting
* metrics
* health checks

---

# PERFORMANCE TESTING

Do not merely state that the system scales.

Measure it.

Create performance tests for:

* authentication
* employee lookup
* attendance retrieval
* leave requests
* notifications
* dashboard queries
* concurrent access

Test realistic loads such as:

```text
100 concurrent users
500 concurrent users
1,000 concurrent users
5,000 concurrent users
```

Only perform higher-load tests where the environment can safely handle them.

Measure:

* p50 latency
* p95 latency
* p99 latency
* error rate
* throughput
* DB connections
* CPU
* RAM
* queue depth

Identify actual bottlenecks.

Do not invent benchmark numbers.

---

# CONCURRENCY & DISTRIBUTED SYSTEM TESTING

Because PostgreSQL + multiple API instances + Redis are being introduced, explicitly test:

* duplicate requests
* concurrent leave updates
* concurrent balance updates
* duplicate notifications
* repeated webhook deliveries
* simultaneous employee updates
* multi-worker processing
* distributed lock/idempotency behavior

The system must remain logically correct even when:

```text
API #1
API #2
Worker #1
Worker #2
```

operate simultaneously.

---

# MULTI-INSTANCE TEST

Run the backend using at least two API instances against:

* the same PostgreSQL
* the same Redis

Validate that:

* authentication remains correct
* sessions/tokens remain correct
* data remains consistent
* requests do not depend on local filesystem state
* workers do not duplicate critical jobs
* local memory is not incorrectly treated as shared state

---

# PHASE 13 — MOBILE PRODUCTION READINESS

Audit mobile configuration for:

* production API URL
* SSL/TLS
* Firebase configuration
* notification token lifecycle
* secure token storage
* crash reporting
* release mode
* Android signing
* iOS signing
* environment separation
* versioning
* build configuration

Never commit store signing secrets.

Create a release checklist covering:

### Android

* keystore
* key alias
* signing config
* package/application ID
* Play Console configuration
* FCM configuration

### iOS

* Apple Developer account
* signing certificate
* provisioning profile
* bundle identifier
* APNs/FCM configuration

The system should clearly report which production artifacts are missing.

---

# PHASE 14 — PRODUCTION CONFIGURATION VALIDATOR

Create a configuration validation command.

Example:

```text
npm run validate:production
```

It should validate:

* DATABASE_URL
* REDIS_URL
* JWT configuration
* SMS provider configuration
* Firebase configuration
* monitoring configuration
* ERP configuration
* required URLs
* production flags
* mobile release requirements where applicable

It must report:

```text
PASS
WARN
FAIL
```

without leaking secret values.

Example:

```text
DATABASE_URL ................ PASS
REDIS_URL ................... PASS
SMS credentials ............. WARN - not configured
Firebase credentials ........ PASS
ERP integration ............. WARN - production endpoint missing
Observability ............... PASS
```

---

# PHASE 15 — DOCUMENTATION

Create or update:

```text
docs/
  ARCHITECTURE.md
  PRODUCTION_READINESS.md
  DATABASE_MIGRATION.md
  DATABASE_BACKUP_RESTORE.md
  QUEUE_ARCHITECTURE.md
  INTEGRATIONS.md
  ERP_INTEGRATION.md
  ATTENDANCE_INTEGRATION.md
  OBSERVABILITY.md
  DEPLOYMENT.md
  SECRETS.md
  MOBILE_RELEASE.md
  DISASTER_RECOVERY.md
  RUNBOOK.md
```

Documentation must reflect the actual implementation.

Do not document imaginary functionality.

---

# RUNBOOK

Create operational runbooks for:

### API unavailable

### PostgreSQL unavailable

### Redis unavailable

### Queue backlog

### Worker crash

### SMS provider outage

### Firebase outage

### ERP synchronization failure

### Attendance synchronization failure

### Database migration failure

### Deployment rollback

### Backup restoration

Each runbook should contain:

* symptoms
* diagnosis
* commands/checks
* mitigation
* rollback
* recovery
* verification

---

# ARCHITECTURAL GUARDRAILS

Enforce these rules in code/review:

1. Controllers must not contain large business algorithms.
2. Controllers must not directly access PostgreSQL internals.
3. Business logic should not directly depend on Redis.
4. Business logic should use interfaces for external providers.
5. External integrations must be isolated in adapters.
6. Queue workers must call application services rather than duplicating business logic.
7. Database writes must happen through repositories/services according to the existing architecture.
8. Shared mutable state must not depend on one Node process's memory.
9. Production data must not live in local files.
10. Temporary files must not be treated as durable shared storage.
11. Secrets must never be hardcoded.
12. Important state transitions must be auditable.

---

# MIGRATION SAFETY

Before each major migration:

1. Create backup.
2. Validate current state.
3. Run migration.
4. Verify counts.
5. Verify relationships.
6. Run smoke tests.
7. Run regression tests.
8. Compare critical business outcomes.
9. Only then mark the migration successful.

For every irreversible operation define:

```text
Precondition
Backup
Operation
Validation
Rollback
Postcondition
```

---

# STOP / APPROVAL GATES

You have permission to perform all safe, reversible engineering work autonomously.

However, STOP and request human approval before any action that could:

* delete production data
* overwrite an existing production database
* rotate/revoke credentials
* make irreversible infrastructure changes
* deploy to actual production
* send real SMS to real users
* send real push notifications to real users
* connect to a real ERP production endpoint
* upload a release to Google Play
* upload a release to Apple App Store
* destroy existing infrastructure

Do NOT stop for:

* code analysis
* refactoring
* tests
* local Docker setup
* schema creation
* migration scripts
* mock providers
* staging configuration
* documentation
* CI checks
* development environment fixes

When an approval gate is reached, clearly state:

```text
APPROVAL REQUIRED

Action:
Risk:
Why it is required:
What has already been completed:
Rollback:
Exact next step:
```

---

# DEFINITION OF DONE

The project is NOT "done" merely because it builds.

The project is complete only when the following are demonstrated.

## Infrastructure

* PostgreSQL operational
* Redis operational
* API can run in multiple instances
* workers operate independently
* local JSON persistence is removed from production path

## Database

* migration completed
* validation completed
* indexes verified
* transactions verified
* backup/restore procedure tested

## Queues

* background jobs working
* retries working
* idempotency verified
* worker recovery verified

## External Integrations

* SMS adapter implemented
* Firebase adapter implemented
* ERP abstraction implemented
* biometric integration abstraction implemented
* real credentials remain configurable rather than fabricated

## Observability

* structured logs
* request IDs
* error monitoring
* metrics
* health endpoints
* alerts/runbooks

## CI/CD

* automated tests
* builds
* migration validation
* security checks

## Security

* no hardcoded production secrets
* no credentials in repository
* no sensitive data in logs

## Testing

All existing tests remain passing.

New tests for the new architecture must also pass.

---

# FINAL VALIDATION

At the end, run the complete validation suite.

Produce:

`docs/FINAL_PRODUCTION_READINESS_REPORT.md`

with these sections:

## 1. Executive Summary

## 2. Previous Gaps

For each:

```text
Gap
Previous State
Implemented Solution
Evidence
Remaining Dependency
```

## 3. Architecture Before / After

## 4. Database Migration Evidence

Include:

* source record count
* destination record count
* mismatch count
* integrity result

## 5. Queue Validation

Include:

* queues
* worker count
* retry behavior
* idempotency result
* failure recovery

## 6. Integration Readiness

Separate clearly:

```text
IMPLEMENTED IN CODE
CONFIGURED IN STAGING
WAITING FOR REAL CREDENTIALS
WAITING FOR EXTERNAL VENDOR ACCESS
```

Never blur these states.

## 7. Observability

List actual implemented monitoring.

## 8. Security

List actual verified controls.

## 9. Performance

Report measured numbers only.

## 10. Test Results

Show:

```text
Previous tests: 369
Previous pass rate: 100%

New tests: X
New pass rate: X%

Total tests: X
Total pass rate: X%
```

Use real numbers only.

## 11. Remaining Blockers

Explicitly distinguish:

### Code blockers

### Infrastructure blockers

### Credential blockers

### Vendor/ERP blockers

### Store-release blockers

### Human approval blockers

## 12. Final Scorecard

Recalculate:

| Area                  | Score | Evidence |
| --------------------- | ----: | -------- |
| Application Security  |   /10 |          |
| Code & Logic          |   /10 |          |
| Mobile UX             |   /10 |          |
| Database Architecture |   /10 |          |
| Scalability           |   /10 |          |
| Background Processing |   /10 |          |
| Integrations          |   /10 |          |
| Observability         |   /10 |          |
| CI/CD                 |   /10 |          |
| Disaster Recovery     |   /10 |          |
| Production Readiness  |   /10 |          |

Do NOT inflate scores.

A score must be supported by implementation evidence.

---

# CRITICAL FINAL RULE

At the end, answer the question:

> "Can this system now safely serve thousands of employees in a real enterprise environment?"

Answer using exactly one of:

```text
YES — PRODUCTION READY
```

or

```text
CONDITIONALLY READY — EXTERNAL OPERATIONAL DEPENDENCIES REMAIN
```

or

```text
NO — CRITICAL ENGINEERING BLOCKERS REMAIN
```

Then list the exact reasons.

Do not use marketing language.

Do not hide limitations.

Do not claim production readiness simply because tests pass.

The goal is a **real, scalable, observable, recoverable, maintainable Enterprise system**, not merely a project that works on one developer machine.

BEGIN NOW.
