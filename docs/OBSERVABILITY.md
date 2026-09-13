# Enterprise Observability, Metrics & APM Runbook

**System:** Elaraby Workforce Observability Layer  
**Components:** Structured Logger, Correlation Middleware, Prometheus Metrics, Sentry APM, Kubernetes Probes  
**Module:** `server/src/observability/`  
**Endpoints:** `/health`, `/readiness`, `/liveness`, `/metrics`  

---

## 1. Observability Architecture

The observability stack provides unified end-to-end visibility across distributed API nodes and background workers:

```text
[ Incoming Request ]
 (Header: x-request-id / Generated UUID)
         │
         ▼
[ Correlation Middleware ] ────► Injects correlationId into AsyncLocalStorage
         │
         ├───► [ Structured JSON Logger ] (Redacts PIN, password, token, OTP)
         │
         ├───► [ APM Metrics Engine ] (Tracks requests, latency p50/p95/p99, errors)
         │
         └───► [ Sentry Error Reporter ] (Captures unhandled exceptions with trace ID)
```

---

## 2. Structured Logging & PII Scrubbing

Logs are emitted in newline-delimited JSON (NDJSON) format, optimized for ingestion by Datadog, ELK Stack, AWS CloudWatch, or Grafana Loki:

```json
{
  "timestamp": "2026-09-12T13:42:59.183Z",
  "level": "info",
  "service": "elaraby-api",
  "environment": "production",
  "correlationId": "req-984b-4c01-a1e7-8b09",
  "method": "POST",
  "route": "/api/v1/leaves/request",
  "statusCode": 201,
  "durationMs": 34.2,
  "employeeId": "EMP-042"
}
```

### 2.1 Automatic PII & Credential Redaction
The logger (`server/src/observability/logger.js`) scrubs sensitive fields recursively before writing to `stdout`:
* `password` ➔ `[REDACTED]`
* `pin` ➔ `[REDACTED]`
* `token` / `jwt` ➔ `[REDACTED]`
* `otp` / `code` ➔ `[REDACTED]`
* `nationalId` ➔ `2900101******` (Partially masked)

---

## 3. Prometheus Metrics Exporter (`/metrics`)

The platform exposes real-time Prometheus line protocol metrics for scraping by Prometheus or Datadog Agent:

```text
# HELP elaraby_http_requests_total Total number of HTTP requests processed
# TYPE elaraby_http_requests_total counter
elaraby_http_requests_total{method="GET",route="/api/employees",status="200"} 14208
elaraby_http_requests_total{method="POST",route="/api/auth/login",status="200"} 3891

# HELP elaraby_http_duration_seconds HTTP request latency distribution
# TYPE elaraby_http_duration_seconds summary
elaraby_http_duration_seconds{quantile="0.5"} 0.024
elaraby_http_duration_seconds{quantile="0.95"} 0.082
elaraby_http_duration_seconds{quantile="0.99"} 0.145

# HELP elaraby_queue_jobs_total BullMQ background jobs processed
# TYPE elaraby_queue_jobs_total counter
elaraby_queue_jobs_total{queue="sms",status="completed"} 5821
elaraby_queue_jobs_total{queue="push",status="completed"} 12403
elaraby_queue_jobs_total{queue="erp-sync",status="completed"} 48
```

---

## 4. Kubernetes Probes Specification

| Endpoint | Probe Type | Validation Criteria | HTTP Status |
| :--- | :--- | :--- | :---: |
| `/health` | Diagnostic | Process uptime, memory usage, service metadata | `200 OK` |
| `/liveness` | K8s Liveness Probe | Answers whether process event loop is alive | `200 OK` |
| `/readiness`| K8s Readiness Probe| Pings PostgreSQL pool & Redis connection. Fails traffic routing if critical infrastructure is down | `200 OK` (Healthy)<br>`503 Service Unavailable` |

---

## 5. Enterprise Alerting Rules (Prometheus AlertManager)

```yaml
groups:
  - name: elaraby-workforce-alerts
    rules:
      - alert: HighApiErrorRate
        expr: sum(rate(elaraby_http_requests_total{status=~"5.."}[5m])) / sum(rate(elaraby_http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Elaraby API 5xx error rate exceeds 5%"

      - alert: HighP95Latency
        expr: elaraby_http_duration_seconds{quantile="0.95"} > 0.500
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Elaraby API P95 latency exceeds 500ms"

      - alert: QueueBacklogGrowing
        expr: elaraby_queue_depth > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "BullMQ queue depth has accumulated over 1,000 pending jobs"
```
