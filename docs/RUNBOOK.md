# Enterprise Operations Runbook & Incident Response

**System:** Elaraby Workforce Incident Response  
**Audience:** Site Reliability Engineers (SRE), DevOps, On-Call Engineers  
**Service Level Objective (SLO):** 99.9% Uptime  
**Version:** 2.0.0  

---

## 1. Incident 01: API Unavailable / 502 Bad Gateway

### Symptoms
* Ingress load balancer reports `502 Bad Gateway` or `504 Gateway Timeout`.
* Mobile users receive connection timeout alerts.

### Diagnosis
```bash
# Check container status
docker compose ps
# Inspect recent API crash logs
docker compose logs --tail=100 api
# Check HTTP readiness probe
curl -v http://localhost:4000/readiness
```

### Mitigation
1. If the API process exited due to memory exhaustion (OOM), increase memory limit in `docker-compose.yml` to 2GB:
   ```bash
   docker compose restart api
   ```
2. If multiple instances are down, scale up secondary nodes:
   ```bash
   docker compose up -d --scale api=4
   ```

### Verification
```bash
curl -f http://localhost:4000/health
# Must return: {"status":"healthy","uptime":...}
```

---

## 2. Incident 02: PostgreSQL Unavailable / Database Pool Exhaustion

### Symptoms
* Requests to `/readiness` return `503 Service Unavailable`.
* API logs show `ECONNREFUSED` or `timeout exceeded when acquiring client from pool`.

### Diagnosis
```bash
# Check PostgreSQL container
docker compose logs --tail=50 postgres
# Check active connections
psql "$DATABASE_URL" -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```

### Mitigation
1. Terminate idle/orphaned connections:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < now() - INTERVAL '5 minutes';
   ```
2. If connection pool limit is saturated, scale `PG_MAX_CONNECTIONS` in `.env` or route through PgBouncer connection pooler.

### Verification
```bash
node -e "require('./server/src/db/postgres').pool.query('SELECT 1').then(() => console.log('OK'))"
```

---

## 3. Incident 03: Redis Unavailable / Cache Failure

### Symptoms
* Workers stop popping jobs; Redlock distributed locks fail.
* API logs show `[RedisClient] Connection failed`.

### Diagnosis
```bash
docker compose logs --tail=50 redis
redis-cli -u "$REDIS_URL" ping
```

### Mitigation
1. Restart Redis container:
   ```bash
   docker compose restart redis
   ```
2. In-memory fallback: The application automatically activates in-memory queue fallback if Redis connection is permanently severed, allowing read operations and critical non-queued flows to remain operational.

### Verification
```bash
redis-cli -u "$REDIS_URL" ping
# Expected: PONG
```

---

## 4. Incident 04: BullMQ Queue Backlog Growing

### Symptoms
* SMS OTPs or Push notifications delayed by > 2 minutes.
* Prometheus metric `elaraby_queue_depth` exceeds 1,000.

### Diagnosis
```bash
# Inspect worker logs
docker compose logs --tail=100 worker
```

### Mitigation
1. Scale worker process count:
   ```bash
   docker compose up -d --scale worker=4
   ```
2. Check if external provider rate limits or timeouts are causing job retries.
3. Pause low-priority bulk queues (e.g. `payroll`, `reports`) to prioritize `sms` and `push`.

### Verification
```bash
curl http://localhost:4000/metrics | grep elaraby_queue_depth
```

---

## 5. Incident 05: Worker Process Crash

### Symptoms
* Background jobs are stuck in `active` state or stalled.
* Worker container has exited.

### Diagnosis
```bash
docker inspect $(docker compose ps -q worker) --format='{{.State.ExitCode}} {{.State.Error}}'
```

### Mitigation
1. Container restart policy will auto-restart the container.
2. BullMQ automatically recovers stalled jobs after `stalledInterval` (default: 30 seconds) and assigns them to the recovered worker.
3. Idempotency guard ensures previously partially processed jobs do not execute duplicate operations.

### Verification
```bash
docker compose ps worker
# Status must be "Up"
```

---

## 6. Incident 06: SMS Provider Outage (Cequens / Vodafone)

### Symptoms
* Users report not receiving SMS login codes or password resets.
* API logs show `SmsProviderError: Network timeout to provider gateway`.

### Diagnosis
```bash
node -e "require('./server/src/integrations/sms').getSmsProvider().sendSms('+201012345678', 'Test').then(console.log)"
```

### Mitigation
1. Switch SMS provider dynamically via environment variable without code changes:
   ```bash
   # Switch from Cequens to Vodafone or Twilio
   export SMS_PROVIDER=vodafone
   docker compose restart api worker
   ```
2. Enable WhatsApp / In-App OTP delivery fallback in mobile app configuration.

### Verification
Send test OTP and verify HTTP 200 and receipt.

---

## 7. Incident 07: Firebase Push Notification Delivery Failure

### Symptoms
* Push notifications not arriving on Android/iOS devices.
* Logs show FCM HTTP error `401 Unauthorized` or `403 Forbidden`.

### Diagnosis
* Check Google Firebase Service Account private key validity and certificate expiration.
* Verify `FIREBASE_PROJECT_ID` matches the deployed mobile client app.

### Mitigation
1. Rotate expired Firebase credentials in `.env.production`.
2. Reload worker containers:
   ```bash
   docker compose restart worker
   ```

---

## 8. Incident 08: ERP Synchronization Failure (SAP / Oracle)

### Symptoms
* Leave approvals approved in mobile app are not reflected in SAP.
* `erp-sync` queue shows jobs in `failed` state.

### Diagnosis
```bash
docker compose logs --tail=100 worker | grep "erp-sync"
```

### Mitigation
1. Verify SAP gateway connectivity and credentials.
2. If SAP is down for scheduled maintenance (common on weekends):
   * Jobs are held in BullMQ queue with exponential backoff (retries up to 5 times).
   * Leave requests remain approved in local PostgreSQL database, maintaining uninterrupted mobile operations for employees.
   * Once SAP resumes, jobs automatically sync.
3. If necessary, run reconciliation engine:
   ```bash
   node -e "require('./server/src/integrations/reconciliation/reconciliationEngine').WorkforceReconciliationEngine.reconcile().then(console.log)"
   ```

---

## 9. Incident 09: Attendance Hardware Batch Ingestion Failure

### Symptoms
* Factory morning shift punches missing from employee mobile attendance history.

### Diagnosis
* Check SFTP drop directory for unparsed or malformed punch logs.
* Check parser error logs:
  ```bash
  docker compose logs worker | grep "punch"
  ```

### Mitigation
1. Check for malformed CSV format or invalid timestamps.
2. The biometric parser skips malformed rows and imports all valid punches.
3. Re-ingest the batch file:
   ```bash
   node -e "require('./server/src/integrations/biometrics').parseCsvPunchBatch('/path/to/punches.csv')"
   ```

---

## 10. Incident 10: Database Migration Failure

### Symptoms
* `migrate-json-to-postgres.js --execute` errors on a specific table or constraint violation.

### Diagnosis
```bash
node server/scripts/migrate-json-to-postgres.js --validate
```

### Rollback Procedure
1. If migration failed midway:
   ```bash
   # Roll back schema by applying clean DDL
   psql "$DATABASE_URL" -f server/src/db/schema.sql
   ```
2. Switch back to dual-mode / JSON persistence:
   ```bash
   export PERSISTENCE_DRIVER=json
   docker compose restart api
   ```
3. Fix the data discrepancy in the JSON source and re-run `--validate`.

---

## 11. Incident 11: Deployment Rollback

### Procedure
1. Re-tag previous stable Docker image:
   ```bash
   docker compose -f docker-compose.yml pull api:v1.9.0
   docker compose up -d --no-deps api
   ```
2. Verify traffic via `/readiness`.

---

## 12. Incident 12: Database Restoration

### Procedure
1. Identify the latest clean backup in `server/backups/`.
2. Execute cryptographic verification:
   ```bash
   node server/scripts/restore-database.js server/backups/latest-backup.json --verify-only
   ```
3. Execute live restoration:
   ```bash
   node server/scripts/restore-database.js server/backups/latest-backup.json
   ```
4. Run production validation:
   ```bash
   npm run validate:production
   ```
