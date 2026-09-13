# Elaraby Workforce — Enterprise Deployment Guide

**System:** Elaraby Connect / Workforce Production Infrastructure  
**Topology:** Multi-Instance Express API + Independent BullMQ Workers + PostgreSQL 16 + Redis 7  
**Version:** 2.0.0-ENTERPRISE  
**Date:** September 2026  

---

## 1. Production Architecture Overview

The system runs across 4 independently scalable containerized services:

```text
                           [ Load Balancer (ALB / Nginx) ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
          [ API Container #1 ]                        [ API Container #2 ]
          Port 4000 (Stateless)                       Port 4000 (Stateless)
                   │                                           │
                   ├─────────────────────┬─────────────────────┤
                   ▼                     ▼                     ▼
          [ PostgreSQL 16+ ]      [ Redis 7+ Cache ]   [ Worker Container ]
          Primary Database        Locks & Queues       Runs worker.js
```

---

## 2. Service Deployment Matrix

| Service | Container Image / Role | Primary Process | Scaling Characteristics | Ports Exposed |
| :--- | :--- | :--- | :--- | :--- |
| **`api`** | Node.js 20 LTS Alpine | `node server.js` | Horizontal (2–10 instances behind LB) | `4000` (Internal) |
| **`worker`** | Node.js 20 LTS Alpine | `node worker.js` | Horizontal (1–4 instances based on queue depth) | None (Worker only) |
| **`postgres`** | PostgreSQL 16 Alpine | Database Engine | Vertical + Read Replicas (Primary/Standby) | `5432` |
| **`redis`** | Redis 7 Alpine | Redis In-Memory | Redis Sentinel / Cluster HA | `6379` |

---

## 3. Docker Compose Production Deployment

### 3.1 Step 1: Prepare Environment
```bash
cd server
cp .env.example .env.production
# Populate real production secrets (JWT_SECRET, DATABASE_URL, REDIS_URL, etc.)
```

### 3.2 Step 2: Build & Launch Services
```bash
docker compose -f docker-compose.yml up -d --build
```

### 3.3 Step 3: Run Database Migrations
```bash
docker compose exec api node scripts/migrate-json-to-postgres.js --execute
docker compose exec api node scripts/migrate-json-to-postgres.js --verify
```

### 3.4 Step 4: Validate Production Status
```bash
docker compose exec api npm run validate:production
```

---

## 4. Horizontal Auto-Scaling Guidelines

### 4.1 Scaling the API Layer
Because the Express backend is completely stateless (sessions use JWT tokens, caches use Redis, primary data uses PostgreSQL), scaling is linear:
```bash
docker compose up -d --scale api=4
```

### 4.2 Scaling the Worker Layer
When queue backlogs increase during morning punch rush hours (07:30–08:30 AM) or end-of-month payroll runs:
```bash
docker compose up -d --scale worker=3
```

---

## 5. Graceful Shutdown & Zero-Downtime Rolling Restarts

Both API and worker processes implement structured signal handlers:
1. `SIGTERM` / `SIGINT` received from container runtime.
2. Ingress health check responds `503` to stop new traffic routing.
3. In-flight requests/jobs are given 10 seconds to finish execution.
4. Database pools and Redis connections are closed cleanly.
5. Exit code `0` returned.
