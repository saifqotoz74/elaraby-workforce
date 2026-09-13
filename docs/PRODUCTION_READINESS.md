# Elaraby Workforce — Enterprise Production Readiness Specification

**System:** Elaraby Connect / Workforce Enterprise Platform  
**Target Organization:** Elaraby Group (Multi-Site / Multi-Factory Enterprise)  
**Capacity:** 10,000+ Concurrent Employees & Field Engineers  
**Topology:** Modular Monolith API + Distributed BullMQ Workers + PostgreSQL Primary + Redis Cluster  
**Document Version:** 2.0.0-PROD  
**Status:** Remediated & Validated  

---

## 1. Executive Architecture Overview

Elaraby Workforce has been remediated from a single-process, local file-based prototype (`server/data/db.json`) into a resilient, horizontally scalable, multi-instance enterprise production system.

```text
                                 [ Client Ingress ]
                         Mobile (Flutter) / Web Admin / IoT
                                         │
                                         ▼
                            [ Reverse Proxy / Ingress ]
                                 Nginx / AWS ALB
                                         │
               ┌─────────────────────────┴─────────────────────────┐
               ▼                                                   ▼
     [ API Instance #1 ]                                 [ API Instance #2 ]
  Express / Modular Monolith                          Express / Modular Monolith
  (Stateless, Port 4000)                              (Stateless, Port 4000)
         │           │                                       │           │
         │           └───────────────────┬───────────────────┘           │
         ▼                               ▼                               ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────┐
│ PostgreSQL 16+   │           │ Redis 7+ Cluster │           │ BullMQ Workers   │
│ Primary DB       │           │ Cache, Locks,    │           │ (Background      │
│ (ACID Authority) │           │ Pub/Sub & Queues │           │  Daemons)        │
└──────────────────┘           └────────┬─────────┘           └────────┬─────────┘
                                        │                              │
                                        └──────────────────────────────┘
                                                       │
                                                       ▼
                                            [ External Gateways ]
                                        - SMS (Cequens/Vodafone/Twilio)
                                        - Push (Firebase Cloud Messaging)
                                        - ERP (SAP S/4HANA / Oracle Cloud)
                                        - Biometrics (ZKTeco / Suprema Time-Clock)
```

---

## 2. Remediation Verification Matrix

| Architecture Domain | Previous State | Remediated Enterprise State | Verification Status |
| :--- | :--- | :--- | :--- |
| **Primary Data Authority** | Single `server/data/db.json` file. Risk of corruption, file locks, data loss on crash. | Authoritative PostgreSQL relational schema (`server/src/db/schema.sql`) with dual-mode repository layer (`server/src/db/repository.js`). | **PASS** (13 employees, 107 requests verified in migration suite) |
| **Heavy / Asynchronous Ops** | Executed synchronously in Express HTTP event loop. Request timeouts on bulk ops. | Offloaded to Redis-backed BullMQ queues (`sms`, `push`, `notifications`, `payroll`, `erp-sync`, `attendance-sync`) processed by dedicated `worker.js`. | **PASS** (Job dispatch & worker lifecycle verified across all 6 queues) |
| **External Integrations** | Direct hardcoded stubs or unhandled provider calls. | Pluggable Provider Adapter architecture with phone normalization, retry policies, and safe unconfigured degradation. | **PASS** (SMS & FCM provider suites pass 100%) |
| **Enterprise ERP & Hardware**| Absent. No bridge to SAP, Oracle, or factory biometric punch clocks. | Modular ERP adapter (`SapAdapter`, `OracleAdapter`, `RestErpAdapter`) + Biometric parser + 2-way Workforce Reconciliation Engine. | **PASS** (Punch normalization, CSV ingestion & reconciliation pass) |
| **Observability & Diagnostics** | Plain `console.log`, uncorroborated errors, no metrics, missing liveness/readiness probes. | Structured JSON logger with automatic PII redaction, `x-request-id` correlation middleware, Prometheus metrics exporter, pluggable Sentry reporter, K8s `/health`, `/readiness`, `/liveness`. | **PASS** (Observability test suite passes 100%) |
| **Data Safety & Recovery** | Manual file copying. No integrity verification. | Automated JSON & SQL backup engine (`backup-database.js`) with SHA-256 cryptographic manifests and verifiable pre-restore gates (`restore-database.js`). | **PASS** (Verified against clean backup and rejected tampered archive) |

---

## 3. Scale & Capacity Targets

* **Simultaneous Active Users:** 1,000–5,000 peak concurrent requests.
* **Database Connection Pool:** Sized dynamically (`PG_MAX_CONNECTIONS=50` per node; supports PgBouncer pool multiplexing up to 10,000 clients).
* **Worker Concurrency:** Configurable per queue (default: 5 concurrent jobs for SMS/Push, 2 for ERP/Attendance sync).
* **API P95 Latency Target:** < 150ms for authenticated employee endpoints under load.
* **RTO (Recovery Time Objective):** < 15 minutes.
* **RPO (Recovery Point Objective):** < 5 minutes (via automated WAL archiving / hourly manifest snapshots).

---

## 4. Operational Sign-Off Protocol

Before proceeding to live production deployment with real employee traffic, the following human approval gates must be validated:
1. **Gate 1:** Provision production PostgreSQL and Redis managed clusters (AWS RDS / GCP Cloud SQL / On-Prem HA).
2. **Gate 2:** Input verified production credentials for Cequens/Vodafone SMS and Google Firebase Service Account.
3. **Gate 3:** Validate ERP connection to SAP/Oracle staging endpoint and approve field mapping schema.
4. **Gate 4:** Sign release builds with corporate Android keystore and Apple Developer Enterprise profile.
