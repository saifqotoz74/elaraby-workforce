# MASTER PRODUCTION COMPLETION PROMPT

## Enterprise Production Hardening, Infrastructure Integration, External Dependency Removal & Launch Readiness

You are acting as the **Principal Software Architect, Senior Backend Engineer, Senior Flutter Engineer, DevSecOps Engineer, SRE, Database Engineer, QA Lead, and Production Release Engineer** for this project.

Your mission is NOT to write a report.

Your mission is to **inspect, modify, test, harden, configure, document, and productionize the entire repository until every solvable blocker in the current Production Readiness Report is actually resolved in code and deployment configuration.**

The project must move from:

> Development / Compatibility / Mock-dependent state

to:

> **Production-Deployable Enterprise State**

while preserving all currently working functionality and avoiding regressions.

---

# 1. SOURCE OF TRUTH

The following current project findings are the starting point:

* Existing backend and Flutter application
* Existing automated test suite
* Existing PostgreSQL schema and migration tooling
* Existing repository abstraction
* Existing Redis integration
* Existing BullMQ / Redlock architecture
* Existing SMS adapters
* Existing Firebase integration
* Existing SAP / Oracle adapters
* Existing biometric import architecture
* Existing realtime SSE architecture
* Existing upload service
* Existing authentication / OTP / rate-limiting implementation
* Existing production-readiness documentation

The previous audit reported:

* 403 automated tests passing
* Flutter analyze clean
* Multi-instance OTP synchronization implemented
* Distributed rate limiting implemented
* Redis Pub/Sub realtime synchronization implemented
* Temporary Vercel URLs removed
* Remaining blockers are primarily infrastructure, credentials, deployment, storage, and third-party integrations

DO NOT blindly trust the previous report.

You must independently verify every important claim against the actual repository.

---

# 2. PRIMARY OBJECTIVE

Make the repository genuinely production-ready.

Production readiness means:

1. No accidental development mocks in production.
2. No hardcoded infrastructure addresses.
3. No hidden fallback behavior that silently downgrades production to JSON / memory.
4. PostgreSQL is fully supported as the production database.
5. Redis is fully supported as the production distributed state / queue / Pub/Sub backend.
6. File storage is production-safe in a multi-instance environment.
7. External services have clean provider abstractions.
8. Missing credentials fail safely and explicitly.
9. Environment configuration is validated at startup.
10. Health checks expose dependency status.
11. Migrations are deterministic and production-safe.
12. Backups and restore procedures are executable.
13. Deployment configuration is included.
14. CI/CD validates the system.
15. Flutter production configuration is complete.
16. No production path relies on test mocks.
17. Security controls are enforced in production.
18. Observability is sufficient for real operations.
19. Failure modes are explicit and recoverable.
20. The final system can be handed to an enterprise IT team with a clear deployment procedure.

---

# 3. NON-NEGOTIABLE ENGINEERING RULES

## Rule A — DO NOT FAKE PRODUCTION READINESS

Never claim something is production-ready merely because code exists.

For every component, prove readiness with:

* source-code verification
* automated tests
* integration tests where possible
* startup validation
* health checks
* deployment configuration
* failure-path testing
* documentation

If something cannot be completed because an external credential or network access is unavailable, explicitly classify it as:

`EXTERNAL CREDENTIAL / INFRASTRUCTURE BLOCKER`

Do NOT fake credentials.

Do NOT generate fake production secrets.

Do NOT pretend that a mock API call is a real integration.

---

## Rule B — REMOVE SILENT FALLBACKS

Search the entire project for:

* Mock
* Fake
* Stub
* InMemory
* Compatibility Mode
* Development Mode
* Demo Mode
* Test Provider
* Dummy
* localhost
* 127.0.0.1
* hardcoded IPs
* temporary URLs
* temporary domains
* development Firebase projects
* temporary Vercel URLs
* hardcoded Redis hosts
* hardcoded DB hosts

For every production execution path:

* explicitly choose production infrastructure
* fail fast if required configuration is missing
* never silently downgrade to JSON, memory, mock providers, or local storage

Development and test environments may still use mocks,
but production MUST NEVER silently do so.

---

# 4. DATABASE — COMPLETE REAL POSTGRESQL PRODUCTION READINESS

Inspect all database code.

The target production database is PostgreSQL.

Implement / verify:

* PostgreSQL connection handling
* connection pooling
* graceful startup connection validation
* graceful database shutdown
* retry strategy where appropriate
* transaction handling
* isolation correctness
* foreign keys
* indexes
* uniqueness constraints
* check constraints
* tenant isolation constraints where applicable
* timestamps and audit fields
* migration versioning
* migration locking
* migration rollback strategy where realistically possible
* seed separation from production migrations
* connection timeout
* query timeout where supported
* health check
* readiness check

Ensure that:

`DATABASE_URL`

is the single authoritative production database configuration.

Create / verify:

`.env.example`

with safe placeholders only.

Create a clear separation between:

* development
* test
* staging
* production

The server must refuse to start in production when `DATABASE_URL` is missing or invalid.

---

# 5. JSON COMPATIBILITY MODE

Inspect `db.js` and all JSON persistence logic.

Determine exactly where JSON is still used.

Refactor so that:

* JSON is allowed only for development/test if intentionally retained
* production MUST NOT use JSON persistence
* production startup MUST detect and reject accidental JSON fallback
* repository interfaces remain clean
* no code path unintentionally mixes JSON and PostgreSQL in production
* migration tooling remains available for legacy data migration

Create a documented migration process:

JSON → PostgreSQL

with:

* validation
* duplicate handling
* foreign-key ordering
* rollback / backup strategy
* row counts
* checksum / reconciliation where practical
* post-migration verification

---

# 6. REDIS — REAL DISTRIBUTED PRODUCTION IMPLEMENTATION

Inspect:

* redis.js
* rateLimit.js
* realtimeService.js
* BullMQ
* Redlock
* Pub/Sub
* queue producers
* queue workers

The final production architecture must support:

* Redis 7+
* distributed rate limiting
* distributed locks
* Pub/Sub
* BullMQ
* multi-instance synchronization
* worker resilience
* reconnect behavior
* graceful shutdown

Production must require:

`REDIS_URL`

No silent InMemoryRedisMock fallback in production.

Implement startup dependency validation.

Implement Redis health and readiness checks.

Verify behavior under:

* Redis restart
* connection loss
* reconnect
* duplicate events
* worker restart
* multiple backend instances
* lock contention

Ensure queue jobs are:

* idempotent where necessary
* retryable
* observable
* protected from duplicate processing
* dead-lettered or otherwise recoverable when appropriate

---

# 7. MULTI-INSTANCE / CLUSTER VERIFICATION

Run actual integration-style tests for at least:

* Node instance A + Node instance B
* shared PostgreSQL
* shared Redis

Verify:

### OTP

Request OTP on A.
Verify OTP on B.

### Rate limiting

Trigger attempts across A and B.
Confirm the limit is global.

### Realtime

Publish an event through A.
Confirm B receives it.

### BullMQ

Enqueue on A.
Worker may execute independently.
Verify no unintended duplication.

### Distributed locks

Acquire from A.
Attempt acquisition from B.
Verify expected locking behavior.

### Session / auth state

Verify any distributed auth-related state works consistently.

---

# 8. FILE STORAGE — REMOVE SINGLE-SERVER STORAGE RISK

Inspect:

`server/src/services/uploadService.js`

Current local-disk upload storage is not acceptable as the final multi-instance production architecture.

Create a storage abstraction such as:

StorageProvider

with implementations for:

* local filesystem for development/test
* S3-compatible object storage for production

Target compatibility:

* AWS S3
* MinIO
* other S3-compatible enterprise object storage

Production configuration should support variables such as:

`STORAGE_PROVIDER`
`S3_ENDPOINT`
`S3_REGION`
`S3_BUCKET`
`S3_ACCESS_KEY_ID`
`S3_SECRET_ACCESS_KEY`

Use secure object naming.

Prevent path traversal.

Validate file type.

Validate file size.

Validate MIME type.

Avoid trusting user-supplied filenames.

Implement safe download / retrieval behavior.

Ensure multi-instance access works correctly.

Do not expose private medical / employee attachments publicly.

Use private objects plus controlled access URLs or server-side authorization.

---

# 9. SMS — PRODUCTION PROVIDER ARCHITECTURE

Inspect all SMS providers.

Retain provider abstraction.

Support real providers through configuration.

Example:

`SMS_PROVIDER=cequens`

Credentials must come from environment variables.

No credentials may be committed.

Implement:

* provider selection
* startup validation
* timeout
* retry policy
* structured logging
* error normalization
* provider failure handling
* message correlation IDs
* delivery status where supported
* rate limiting
* anti-abuse controls

Development may use MockSmsProvider.

Production MUST fail clearly when:

`SMS_PROVIDER` requires real credentials but they are unavailable.

Never automatically send production traffic through a mock provider.

---

# 10. FIREBASE PUSH NOTIFICATIONS

Inspect:

* firebase_options.dart
* push_service.dart
* backend Firebase integration

Separate:

* development Firebase configuration
* staging Firebase configuration
* production Firebase configuration

Verify the complete architecture for:

* Android
* iOS
* backend service account
* device token registration
* token refresh
* invalid token cleanup
* notification sending
* retries
* logging
* failure handling

Never commit actual production private keys.

Provide:

`.env.example`

and deployment instructions describing exactly where credentials must be injected.

Validate Firebase configuration at build/startup time where practical.

Production builds must not accidentally point to the development Firebase project.

---

# 11. ERP INTEGRATION

Inspect:

* SapAdapter
* OracleAdapter
* WorkforceReconciliationEngine
* integration services
* synchronization jobs

Create a robust external integration layer supporting:

* configuration-based endpoint selection
* authentication
* timeouts
* retries
* exponential backoff
* circuit breaker where appropriate
* idempotency
* structured logs
* synchronization checkpoints
* reconciliation
* conflict detection
* dead-letter / failed synchronization handling

The architecture must support:

Production ERP endpoint

without requiring source-code modification.

Use environment configuration.

Example conceptual configuration:

`ERP_PROVIDER=sap`
`SAP_BASE_URL=...`
`SAP_CLIENT_ID=...`
`SAP_CLIENT_SECRET=...`

Do not invent values.

Create a pre-production integration test harness so the IT team can test connectivity before enabling live synchronization.

---

# 12. BIOMETRIC / ATTENDANCE DEVICES

Inspect the biometric integration architecture.

Support production ingestion through an abstraction such as:

BiometricProvider

Possible sources:

* CSV/SFTP
* Webhook
* API
* device gateway

Implement:

* schema validation
* duplicate detection
* idempotent ingestion
* employee identity mapping
* timestamp normalization
* timezone correctness
* malformed row handling
* retry behavior
* audit trail
* reconciliation
* failed-import reporting

Create documented onboarding procedures for a new factory/device source.

Do not hardcode one factory.

---

# 13. ENVIRONMENT CONFIGURATION SYSTEM

Create or harden centralized environment validation.

Create a typed / validated configuration layer.

Validate at startup:

### Core

* NODE_ENV
* PORT
* APP_URL

### Database

* DATABASE_URL

### Redis

* REDIS_URL

### Authentication

* session secrets
* OTP settings
* JWT/session configuration if applicable

### SMS

* provider
* credentials

### Firebase

* required configuration

### Storage

* S3 configuration

### ERP

* provider and endpoint credentials

### Observability

* logging configuration

The application must produce clear startup errors such as:

`PRODUCTION STARTUP FAILED: DATABASE_URL is missing`

instead of mysterious runtime failures.

Never log secrets.

Never expose secrets through health endpoints.

---

# 14. SECURITY HARDENING

Perform a full security pass.

Inspect:

* authentication
* OTP
* rate limiting
* authorization
* tenant isolation
* session handling
* CSRF where applicable
* CORS
* headers
* input validation
* output encoding
* file uploads
* SQL injection
* command injection
* SSRF
* path traversal
* insecure direct object references
* privilege escalation
* mass assignment
* sensitive logging
* secret exposure
* error leakage

Pay special attention to:

multi-tenant isolation.

A user from Tenant A must never access:

* Tenant B records
* Tenant B files
* Tenant B events
* Tenant B notifications
* Tenant B reports

Add automated cross-tenant authorization tests.

---

# 15. HEALTH CHECKS

Create explicit endpoints for:

### Liveness

Process is running.

### Readiness

System can actually serve traffic.

Readiness should verify required dependencies according to environment.

Example conceptual checks:

* PostgreSQL
* Redis
* queue system
* storage
* required external services where appropriate

Do not make health checks leak credentials or internal secrets.

Support load balancer integration.

---

# 16. OBSERVABILITY

Implement / verify:

* structured logs
* request IDs
* correlation IDs
* error IDs
* latency logging
* auth event logging
* security event logging
* queue metrics
* database errors
* Redis errors
* external provider failures
* upload failures
* integration failures

Never log:

* passwords
* OTP values
* access tokens
* refresh tokens
* private keys
* API secrets
* unnecessary medical information

Provide production troubleshooting documentation.

---

# 17. BACKUP / RESTORE / DISASTER RECOVERY

Do not merely document backups.

Create executable scripts / procedures for:

* PostgreSQL backup
* PostgreSQL restore
* validation of backup file
* migration-safe restore
* Redis persistence expectations
* object-storage backup strategy
* disaster recovery sequence

Document:

RPO

RTO

backup frequency

retention

restore verification

Create a disaster recovery checklist.

Where automation cannot safely run against a real production server from the repository, provide executable scripts plus exact operator commands.

---

# 18. DEPLOYMENT

Create production deployment support.

Provide infrastructure configuration appropriate for the existing architecture.

At minimum support a practical deployment model such as:

* Docker
* Docker Compose for controlled environments
* reverse proxy
* backend
* worker
* PostgreSQL
* Redis
* object storage or S3-compatible storage

Do not force external managed services when self-hosted equivalents are valid.

Create:

`Dockerfile`

`docker-compose.production.yml`

where appropriate.

Create separate services where required:

* API
* worker
* PostgreSQL
* Redis

Ensure:

* persistent volumes
* health checks
* restart policies
* proper networking
* resource limits where appropriate
* graceful shutdown

Do NOT expose PostgreSQL or Redis publicly unless absolutely required.

---

# 19. CI/CD

Create or improve CI.

Pipeline should include:

1. dependency installation
2. lint / static analysis
3. backend tests
4. integration tests
5. Flutter tests
6. Flutter analyze
7. build validation
8. security checks where tooling is available
9. migration validation
10. production configuration validation

Production deployment must not happen if critical checks fail.

---

# 20. FLUTTER PRODUCTION READINESS

Inspect the Flutter application.

Verify:

* API base URL comes from environment/build configuration
* no development URL remains
* no temporary Vercel URL remains
* Firebase configuration is environment-specific
* secure token storage
* certificate / HTTPS expectations
* production logging restrictions
* crash handling
* push notification configuration
* API timeouts
* offline behavior
* retry behavior
* release build configuration

Run:

`flutter test`

`flutter analyze`

and appropriate production builds.

Fix every genuine issue found.

Do NOT suppress warnings simply to get a clean output.

---

# 21. PRODUCTION BUILD CONFIGURATION

Create a clear configuration strategy for:

### Development

Local mocks allowed.

### Test

Controlled mocks / fixtures allowed.

### Staging

Real infrastructure where practical.

### Production

No mocks unless explicitly approved as a business requirement.

The configuration must be obvious and deterministic.

---

# 22. SECRET MANAGEMENT

Never hardcode credentials.

Never commit:

* API keys
* passwords
* private keys
* Firebase service account keys
* database passwords
* Redis passwords
* signing keys

Inspect git history and tracked files for accidental secrets.

Add or update:

`.gitignore`

and secret scanning configuration where reasonable.

If a secret has already been committed, document that it should be rotated.

---

# 23. DOMAIN / URL CLEANUP

Search repository-wide for:

* `http://`
* `https://`
* localhost
* 127.0.0.1
* temporary deployment domains
* temporary Vercel URLs
* old API URLs
* hardcoded environment URLs

Classify every occurrence.

Keep valid localhost URLs only for explicitly development/test infrastructure.

Production URLs must come from configuration.

---

# 24. TEST EXPANSION

Existing tests must keep passing.

Do not delete tests simply to achieve green status.

Add tests for:

### Infrastructure

* PostgreSQL connection failure
* Redis connection failure
* missing environment variables
* invalid configuration
* storage failure
* SMS provider failure
* Firebase failure
* ERP failure

### Distributed system

* multi-instance OTP
* cross-instance rate limiting
* cross-instance realtime
* distributed lock behavior
* queue retry behavior
* duplicate prevention

### Security

* cross-tenant access attempts
* unauthorized file access
* privilege escalation
* brute force
* token misuse
* malformed input

### Production startup

* correct config starts successfully
* missing required production config fails correctly

---

# 25. DO NOT DESTROY WORKING FUNCTIONALITY

Before modifying major components:

* inspect dependencies
* understand call graph
* preserve public interfaces where practical
* preserve domain behavior
* preserve database semantics
* preserve API contracts
* preserve Flutter/backend compatibility

Use adapters where necessary instead of rewriting stable modules unnecessarily.

---

# 26. MIGRATION SAFETY

For every structural database change:

1. inspect current schema
2. generate migration
3. validate migration
4. test forward migration
5. test clean deployment
6. test against representative existing data where possible
7. verify rollback / recovery strategy

Never casually reset a production database.

Never use destructive commands against production by default.

---

# 27. EXTERNAL DEPENDENCY GATE

There are some things code cannot legitimately create.

Examples:

* real organization-owned PostgreSQL server
* real Redis cluster
* real SMS provider account
* real Firebase organization project
* SAP firewall/VPN access
* real biometric factory infrastructure
* official signing credentials
* organization-owned DNS / certificates
* production cloud account

For these, DO NOT fabricate values.

Instead:

1. implement the full integration
2. add configuration validation
3. add test harnesses
4. add health checks
5. add deployment examples
6. provide exact required environment variables
7. provide operator steps
8. clearly mark each remaining external dependency

The goal is to make the project:

> **Technically ready to accept the real dependency immediately**

rather than:

> pretending the dependency already exists.

---

# 28. OPERATOR EXPERIENCE

Create a single deployment guide:

`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`

It must explain:

1. prerequisites
2. infrastructure requirements
3. environment variables
4. database setup
5. Redis setup
6. storage setup
7. SMS setup
8. Firebase setup
9. ERP connectivity
10. biometric ingestion
11. migrations
12. seed / initial admin creation
13. deployment
14. health checks
15. smoke tests
16. rollback
17. backup
18. restore
19. troubleshooting
20. monitoring

The guide should be executable by a competent IT administrator without needing the original developer to explain every step.

---

# 29. PRODUCTION ENVIRONMENT TEMPLATE

Create:

`.env.production.example`

It must contain all required configuration keys but MUST NOT contain real secrets.

Group variables logically.

Example:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://YOUR_PRODUCTION_DOMAIN

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE

REDIS_URL=redis://USER:PASSWORD@HOST:6379

SMS_PROVIDER=cequens
CEQUENS_API_KEY=
CEQUENS_SENDER_ID=

STORAGE_PROVIDER=s3
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

ERP_PROVIDER=
SAP_BASE_URL=
SAP_CLIENT_ID=
SAP_CLIENT_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Adapt the exact variables to the actual codebase.

Do not invent variables that are not actually used unless implementing the relevant configuration.

---

# 30. STARTUP MODE ASSERTION

The application must explicitly print a safe startup summary such as:

```text
Environment: PRODUCTION
Database: PostgreSQL
Redis: ENABLED
Queue: BullMQ
Storage: S3
SMS: CEQUENS
Firebase: CONFIGURED
ERP: SAP
Realtime: Redis Pub/Sub
```

Never print secrets.

If required production infrastructure is missing:

```text
PRODUCTION STARTUP BLOCKED

Missing:
- DATABASE_URL
- REDIS_URL
- ...
```

Then terminate gracefully.

---

# 31. FINAL VERIFICATION PROCESS

After implementation, execute the complete verification sequence.

Backend:

```bash
npm test
```

Flutter:

```bash
flutter test
flutter analyze
```

Also execute all appropriate:

* integration tests
* migration tests
* production configuration validation
* container startup tests
* health-check tests
* API smoke tests

If Docker infrastructure is implemented, actually start it and verify:

* API
* Worker
* PostgreSQL
* Redis
* health endpoints
* database migrations
* queue processing
* uploads

---

# 32. DO NOT STOP AFTER THE FIRST FIX

You must operate iteratively:

1. inspect
2. identify blocker
3. implement fix
4. test
5. inspect dependent modules
6. test again
7. continue until all solvable blockers are closed

Do not stop after discovering that infrastructure credentials are missing.

Build everything around those integrations so the final remaining work is purely credential / infrastructure activation.

---

# 33. REQUIRED FINAL DELIVERABLES

At the end, produce:

### Code

All actual fixes committed to the repository.

### Configuration

* `.env.example`
* `.env.production.example`
* required config loaders/validators

### Infrastructure

* Docker configuration where appropriate
* health checks
* deployment configuration

### Database

* migrations
* migration verification
* backup/restore tooling

### Storage

* production object-storage implementation

### Integrations

* SMS
* Firebase
* ERP
* biometrics

### Security

* security hardening
* cross-tenant tests
* secret checks

### CI/CD

* automated verification pipeline

### Documentation

* `docs/PRODUCTION_DEPLOYMENT_GUIDE.md`
* `docs/PRODUCTION_RUNBOOK.md`
* `docs/DISASTER_RECOVERY.md`
* `docs/EXTERNAL_DEPENDENCIES.md`

---

# 34. FINAL REPORT FORMAT

At completion, do NOT give a vague statement such as:

"Everything is production-ready."

Instead produce a factual matrix:

| Area       | Status          | Evidence            | Remaining Action |
| ---------- | --------------- | ------------------- | ---------------- |
| PostgreSQL | READY / BLOCKED | Tests / config      | ...              |
| Redis      | READY / BLOCKED | Tests / config      | ...              |
| Storage    | READY / BLOCKED | Integration tests   | ...              |
| SMS        | READY / BLOCKED | Adapter + config    | ...              |
| Firebase   | READY / BLOCKED | Build/config        | ...              |
| ERP        | READY / BLOCKED | Adapter + harness   | ...              |
| Biometrics | READY / BLOCKED | Parser/integration  | ...              |
| Security   | READY / BLOCKED | Tests               | ...              |
| Backups    | READY / BLOCKED | Scripts             | ...              |
| Deployment | READY / BLOCKED | Docker/CI           | ...              |
| Flutter    | READY / BLOCKED | Analyze/tests/build | ...              |

For every `BLOCKED` item:

* state exactly why
* identify whether it is code, infrastructure, credential, network, account, or organizational access
* state what has already been implemented
* state the exact operator action required

---

# 35. FINAL QUALITY BAR

The final standard is:

> **No known solvable production blocker remains.**

And:

> **No fake readiness.**

And:

> **No silent development fallback in production.**

And:

> **Every remaining blocker must be external, explicit, measurable, and documented.**

Do not optimize for the appearance of success.

Optimize for a system an enterprise IT team can realistically deploy, operate, monitor, recover, and scale.

---

# EXECUTION ORDER

Follow this exact order unless the repository proves another order is safer:

1. Repository reconnaissance
2. Production-mode audit
3. Environment/configuration system
4. PostgreSQL production path
5. Redis production path
6. Multi-instance validation
7. Object-storage abstraction
8. SMS production integration
9. Firebase production integration
10. ERP integration hardening
11. Biometric ingestion hardening
12. Security hardening
13. Health/readiness
14. Observability
15. Backup/restore
16. Docker/deployment
17. CI/CD
18. Flutter production configuration
19. Full regression suite
20. Integration tests
21. Production smoke tests
22. Documentation
23. Final production-readiness matrix

---

# IMPORTANT

Do not ask me to manually inspect files that you can inspect yourself.

Do not ask me whether you should fix an obvious issue.

Do not stop at documentation.

Do not simply recommend what should be done.

**Actually implement every change that can be implemented from the repository.**

When an external dependency is genuinely required, build everything around it and isolate it as the final activation step.

The objective is to leave the repository in the strongest technically defensible state possible, with all remaining blockers being genuine external dependencies rather than unfinished engineering work.

START NOW.
