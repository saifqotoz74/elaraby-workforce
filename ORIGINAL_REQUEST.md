# Original User Request

## 2026-09-21T18:05:58Z

Build a comprehensive next-generation enterprise expansion for Workforce OS spanning: (1) CBE-compliant automated payroll disbursement & multi-bank gateway (CIB/NBE/QNB), (2) Hardware IoT turnstile & access control connectors (ZKTeco/Hikvision ISAPI) with anti-passback, (3) Flutter offline-first encrypted ACID database & background sync queue, and (4) AI overtime budget & shift absenteeism predictive forecasting analytics.

Working directory: c:\Users\saifh\Desktop\PR Connect
Integrity mode: development

## Requirements

### R1. CBE-Compliant Automated Payroll Disbursement & Banking Gateway (server/src/integrations/banking)
- Generate official Central Bank of Egypt (CBE) / ACH standard fixed-width and CSV salary disbursement batch files for Egyptian banks (CIB, NBE, QNB, Banque Misr).
- Sign disbursement batches with HMAC-SHA256 cryptographic manifests for tamper-evident digital verification.
- Provide bank disbursement feedback ingestion endpoints and reconciliation auditing (`POST /api/admin/banking/disbursement/reconciliation`).

### R2. Hardware IoT Turnstile & Access Control Gateways (server/src/integrations/access_control)
- Implement hardware turnstile protocol parsers supporting ZKTeco TCP packet format and Hikvision ISAPI XML/JSON punch events.
- Enforce strict anti-passback validation preventing consecutive entry punches without an exit punch.
- Provide turnstile health heartbeat monitoring, emergency gate override APIs, and offline rotating QR gate-pass verification.

### R3. Flutter Mobile Encrypted Offline Storage & Background Sync Queue (lib/)
- Implement an encrypted, persistent offline database engine storing cached schedules, employee profile data, punch queues, and pending HR requests.
- Provide a robust background synchronization engine with connectivity detection, exponential backoff retries, and automated conflict resolution.
- Ensure 100% test pass rate and clean compilation across all 5 flavors (`main_elaraby`, `main_elsewedy`, `main_tmg`, `main_ghabbour`, `main_gulf`).

### R4. AI Overtime & Absenteeism Predictive Analytics (server/src/services)
- Implement predictive modeling analyzing historical shift attendance, calculating absenteeism probability risk per factory line and shift.
- Forecast overtime expenditure drift against monthly tenant payroll budgets with proactive alerting for threshold breaches.
- Provide automated smart crew backfilling recommendations to prevent production line stoppages.

## Acceptance Criteria

### Banking & CBE Disbursement
- [ ] CBE/ACH batch file generator outputs valid fixed-width and CSV structures according to CBE standard specs.
- [ ] Cryptographic hash manifest verifies batch integrity and rejects altered payloads.
- [ ] Bank return reconciliation accurately flags matched, rejected, and invalid account numbers with audit logging.

### IoT Turnstiles & Access Control
- [ ] Protocol parser cleanly handles both ZKTeco binary streams and Hikvision ISAPI events without throwing unhandled exceptions.
- [ ] Anti-passback gate blocks duplicate check-in attempts when no check-out exists.
- [ ] Emergency gate unlock and lockdown API endpoints respond within <50ms with security audit trail.

### Mobile Offline Engine
- [ ] All Flutter tests pass cleanly (`flutter test test/`).
- [ ] `flutter analyze` reports zero fatal errors or broken imports across all flavors.
- [ ] Offline punch queue persists records across app restart and syncs idempotently when connectivity returns.

### AI Predictive Analytics
- [ ] Predictive model calculates risk scores (0.0 to 1.0) for upcoming shift absenteeism based on historical trends.
- [ ] Overtime forecast alerts trigger when projected monthly overtime exceeds configurable tenant limits.
- [ ] All backend test suites pass with 100% success (`npm test`).
- [ ] Master E2E runner (`node test_infra/runner.js`) passes all tiers with zero regressions.
- [ ] Production Vercel deployment remains 100% healthy at https://server-six-xi-42.vercel.app/api/health.
