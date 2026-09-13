# BullMQ & Redis Queue Architecture

**System:** Elaraby Workforce Asynchronous Job Infrastructure  
**Core Components:** Redis 7+ & BullMQ  
**Worker Entry Point:** `server/worker.js`  
**Queue Definitions:** `server/src/queue/queues.js`  
**Worker Handlers:** `server/src/queue/workers.js`  
**Idempotency Guard:** `server/src/queue/idempotency.js`  

---

## 1. Asynchronous Architecture & Queue Topology

To maintain low latency on the HTTP event loop, all computationally heavy, I/O-intensive, or external network operations are dispatched to dedicated BullMQ queues:

```text
[ Express HTTP Handler ]
         │
         │  1. Dispatch Job (Payload + Idempotency Key)
         ▼
[ BullMQ Queue Manager ] ──► [ Redis 7+ Data Store ]
                                      │
                                      │  2. Pop Job (FIFO with Priority)
                                      ▼
                             [ Dedicated Worker Daemon ]
                             (server/worker.js)
                                      │
                                      ▼
                             [ Idempotency Guard ]
                             (Redlock / Distributed Lock)
                                      │
                                      ▼
                             [ Domain Handler ]
                             - SMS Gateway
                             - Firebase Push
                             - ERP Sync
                             - Attendance Batch Ingestion
                             - Payroll Batch Engine
```

---

## 2. Logical Queue Catalog

| Queue Name | Default Concurrency | Attempts | Backoff Strategy | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `sms` | 5 | 3 | Exponential (1s initial) | Outbound OTP, authentication tokens, and urgent shift alerts. |
| `push` | 10 | 3 | Exponential (2s initial) | Mobile push notifications to Android & iOS via FCM. |
| `notifications` | 5 | 2 | Fixed (1s) | In-app user notification creation and event broadcasting. |
| `payroll` | 2 | 2 | Exponential (5s initial) | Monthly workforce payslip generation and tax calculations. |
| `erp-sync` | 1 (Sequential) | 5 | Exponential (10s initial)| Two-way employee master record and leave approval sync with SAP/Oracle. |
| `attendance-sync`| 2 | 3 | Exponential (5s initial) | Biometric punch clock batch ingestion and normalization. |

---

## 3. Distributed Idempotency & Concurrency Protection

To guarantee that jobs are executed **exactly once** even in the event of network retries, worker restarts, or duplicate webhooks, the platform incorporates `DistributedIdempotencyGuard`:

```javascript
const { DistributedIdempotencyGuard } = require('./src/queue/idempotency');

const lockAcquired = await DistributedIdempotencyGuard.acquireLock(jobId, ttlSeconds);
if (!lockAcquired) {
  logger.warn('Duplicate job invocation detected and suppressed', { jobId });
  return;
}
```

### 3.1 Idempotency Key Formats
* **SMS:** `sms:{employeeId}:{otpHash}`
* **Push:** `push:{employeeId}:{notificationId}`
* **Attendance Punch:** `punch:{hardwareSerialNumber}:{biometricUserId}:{timestamp}`
* **ERP Leave Sync:** `erp:leave:{requestId}:{status}`

---

## 4. Worker Process Management & Scaling

Workers run in an independent process (`worker.js`) separate from the Express HTTP API (`server.js`).

### 4.1 Running Workers in Development
```bash
cd server
node worker.js
```

### 4.2 Running Workers in Production (Docker)
In Docker Compose / Kubernetes, workers run as isolated pods:
```yaml
worker:
  build: .
  command: ["node", "worker.js"]
  environment:
    - NODE_ENV=production
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=postgresql://postgres:password@postgres:5432/elaraby_workforce
    - WORKER_CONCURRENCY=10
  restart: always
```

### 4.3 Graceful Shutdown Protocol
When receiving `SIGTERM` or `SIGINT`:
1. Worker stops accepting new jobs from Redis queues.
2. In-flight jobs are allowed up to 10 seconds to finish execution.
3. Queue connections and Redis sockets are closed cleanly.
4. Process exits with code 0 without losing or stalling active jobs.
