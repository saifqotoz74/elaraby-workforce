# 📘 Elaraby Workforce — Enterprise Production Runbook

## Overview
This runbook establishes standard operating procedures (SOP), operational incident response guidelines, and routine maintenance commands for the Elaraby Workforce enterprise environment.

---

## 1. Routine Operational Commands

### 1.1 Service Status & Scaling
Check running containers:
```bash
docker compose -f docker-compose.production.yml ps
```
Scale API instances under high shift traffic:
```bash
docker compose -f docker-compose.production.yml up -d --scale api=4 --no-recreate
```
Scale Background Worker pool:
```bash
docker compose -f docker-compose.production.yml up -d --scale worker=4 --no-recreate
```

### 1.2 Prometheus Metrics & Health Monitoring
- **Prometheus Metrics**: `GET http://localhost:3000/metrics`
- **Liveness Probe**: `GET http://localhost:3000/health`
- **Readiness Probe**: `GET http://localhost:3000/readiness`

Key metrics to alert on:
- `http_requests_total{status=~"5.."}` > 1% of traffic over 5m -> **P1 Incident**
- `postgres_pool_waiting_count` > 10 -> **Database pool exhaustion**
- `bullmq_queue_waiting_jobs` > 500 -> **Background worker stall**

---

## 2. Incident Response Playbooks

### Playbook 1: PostgreSQL Connection Failure
**Symptoms**: `/readiness` returns 503 with `"reason": "database_unavailable"`.
1. Check PostgreSQL container status:
   ```bash
   docker logs --tail 100 elaraby-workforce-postgres-prod
   ```
2. Test network reachability:
   ```bash
   docker exec -it elaraby-workforce-api nc -zv postgres 5432
   ```
3. Check connection pool saturation in logs:
   ```bash
   grep "postgres:pool" server.log
   ```
4. If PostgreSQL restarted, connection pool auto-reconnects within 5 seconds. If frozen, perform graceful failover.

### Playbook 2: Redis Outage / Memory Pressure
**Symptoms**: BullMQ jobs not processing; realtime SSE updates stopped.
1. Check Redis memory usage:
   ```bash
   docker exec -it elaraby-workforce-redis-prod redis-cli -a "$REDIS_PASSWORD" info memory
   ```
2. If memory > 90%, inspect large keys:
   ```bash
   docker exec -it elaraby-workforce-redis-prod redis-cli -a "$REDIS_PASSWORD" --bigkeys
   ```
3. Restart Redis if needed (AOF ensures zero data loss):
   ```bash
   docker compose -f docker-compose.production.yml restart redis
   ```

### Playbook 3: SMS Provider Degradation & Failover
**Symptoms**: Employees report OTP not received; SMS gateway error rate > 5%.
1. Check SMS adapter logs for provider error codes:
   ```bash
   grep "sms:error" server.log
   ```
2. Hot-swap active SMS provider without server restart:
   Update `SMS_PROVIDER=twilio` or `SMS_PROVIDER=vodafone` in `.env.production` and trigger zero-downtime container reload:
   ```bash
   docker compose -f docker-compose.production.yml restart api
   ```

### Playbook 4: Emergency Enterprise-Wide Session Revocation
**Scenario**: Compromised administrative account or global credential rotation.
1. Increment global `token_version` in database:
   ```sql
   UPDATE employees SET token_version = token_version + 1;
   ```
2. Flush distributed token cache in Redis:
   ```bash
   docker exec -it elaraby-workforce-redis-prod redis-cli -a "$REDIS_PASSWORD" EVAL "for _,k in ipairs(redis.call('keys','token_ver:*')) do redis.call('del',k) end" 0
   ```
3. All active JWT sessions will immediately be rejected with `401 Unauthorized (token_revoked)`.

---

## 3. Maintenance & Disaster Recovery

### 3.1 Daily Automated Database Backup
Run daily via cron:
```bash
0 2 * * * cd /opt/elaraby-workforce/server && npm run backup >> /var/log/elaraby_backup.log 2>&1
```

### 3.2 Audit Log Rotation & Archival
Audit logs older than 90 days can be exported to cold object storage:
```bash
psql "$DATABASE_URL" -c "COPY (SELECT * FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days') TO '/tmp/audit_archive.csv' WITH CSV HEADER;"
```
