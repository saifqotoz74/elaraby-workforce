# 🚀 Elaraby Workforce — Enterprise Production Deployment Guide

## Overview
This document provides an exhaustive, step-by-step deployment guide for enterprise IT administrators and DevSecOps engineers deploying the **Elaraby Workforce** platform into production.

---

## 1. Prerequisites & System Requirements
- **Host OS**: Ubuntu 22.04 LTS or Red Hat Enterprise Linux (RHEL) 9+
- **Container Runtime**: Docker Engine 24+ & Docker Compose v2.20+
- **Node.js**: Node 18.x LTS or 20.x LTS (if running bare-metal)
- **Memory**: Minimum 8 GB RAM (16 GB Recommended for multi-instance cluster)
- **CPU**: Minimum 4 vCPUs (8 vCPUs Recommended)
- **Disk**: 100 GB NVMe SSD for Database & MinIO storage volumes

---

## 2. Infrastructure Architecture
The production architecture is structured as a horizontally scalable modular monolith:
1. **API Cluster (`api`)**: Stateless Express instances behind a reverse proxy (e.g., NGINX, AWS ALB, Traefik).
2. **Worker Pool (`worker`)**: Scalable Node.js processes processing background BullMQ queues (Notifications, Attendance, SMS, Audit, ERP).
3. **Database (`postgres`)**: PostgreSQL 16 Enterprise Relational Database (Authoritative System of Record).
4. **Distributed Cache / Message Broker (`redis`)**: Redis 7+ cluster/instance for Redlock distributed mutexes, Redis Pub/Sub SSE bridge, and distributed rate limiting.
5. **Object Storage (`minio` / AWS S3)**: Multi-instance shared S3-compatible bucket for attachments, medical certificates, and avatars.

---

## 3. Environment Variables Configuration
Copy `.env.production.example` to `.env.production` on the production host:
```bash
cp .env.production.example .env.production
chmod 600 .env.production
```
Populate all required variables:
- `DATABASE_URL`: `postgresql://USER:PASS@HOST:5432/elaraby_workforce?sslmode=require`
- `REDIS_URL`: `redis://:PASS@HOST:6379`
- `JWT_SECRET`: Minimum 32-character unpredictable random string (`openssl rand -hex 32`)
- `ADMIN_USER` & `ADMIN_PASS`: Complex administrative credentials
- `STORAGE_PROVIDER`: `s3`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `SMS_PROVIDER`: `cequens` (or `twilio` / `vodafone`) + API keys
- `PUSH_PROVIDER`: `firebase` + service account credentials
- `ERP_PROVIDER`: `sap` (or `oracle`) + endpoint & credentials

---

## 4. Database Setup & Relational Migrations
### Step 4.1: Verify PostgreSQL Connectivity
Verify network connectivity and credentials:
```bash
psql "$DATABASE_URL" -c "SELECT version();"
```

### Step 4.2: Execute Deterministic Schema Migration
Run the automated schema and data migration utility:
```bash
cd server
node scripts/migrate-json-to-postgres.js --execute
```
This script:
1. Validates all source data integrity (employees, requests, payroll, roster, announcements, audit logs).
2. Applies DDL constraints, foreign keys, and indexes from `server/src/db/schema.sql`.
3. Inserts records atomically inside a single transaction with rollback safety.
4. Generates a post-migration verification report.

---

## 5. Redis Setup & Clustering
Start Redis 7 with persistent Append-Only File (AOF) enabled:
```bash
redis-server --requirepass "$REDIS_PASSWORD" --appendonly yes --maxmemory 512mb --maxmemory-policy noeviction
```
Verify cluster ping:
```bash
redis-cli -u "$REDIS_URL" ping
# Output: PONG
```

---

## 6. Multi-Instance Object Storage Setup
For self-hosted deployments using MinIO:
```bash
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -v minio_data:/data \
  -e "MINIO_ROOT_USER=minio_admin" \
  -e "MINIO_ROOT_PASSWORD=$S3_SECRET_KEY" \
  minio/minio server /data --console-address ":9001"
```
Create the production bucket:
```bash
docker exec -it minio mc alias set myminio http://localhost:9000 minio_admin "$S3_SECRET_KEY"
docker exec -it minio mc mb myminio/elaraby-workforce
```

---

## 7. SMS Gateway Activation
1. Contract with Cequens, Vodafone Egypt, or Twilio.
2. In `.env.production`, configure:
   ```env
   SMS_PROVIDER=cequens
   CEQUENS_API_KEY=your_production_api_key
   CEQUENS_SENDER_ID=ELARABY
   ```
3. Test delivery to a corporate test phone:
   ```bash
   node -e "require('./src/integrations/sms').send('+201000000000', 'Test OTP: 1234').then(console.log)"
   ```

---

## 8. Firebase Push Notification Activation
1. Download the production `service-account.json` from the Firebase Console (Project Settings -> Service Accounts).
2. Place it in `server/firebase-service-account.json` (mode 600) or set `FIREBASE_SERVICE_ACCOUNT_JSON` as an environment string.
3. Validate Firebase credentials:
   ```bash
   node scripts/verify-fcm.js
   ```

---

## 9. ERP Pre-Production Connectivity Verification
Before enabling live employee synchronization with SAP / Oracle, run the pre-flight test harness:
```bash
cd server
node scripts/test-erp-connectivity.js
```
Expected output:
```
✔ [HANDSHAKE SUCCESS] ERP gateway responded cleanly.
```

---

## 10. Container Deployment via Docker Compose
Deploy the complete multi-instance production stack:
```bash
docker compose -f docker-compose.production.yml up -d --build
```
Verify all containers are running and healthy:
```bash
docker compose -f docker-compose.production.yml ps
```

---

## 11. Health Checks & Verification
### 11.1: Kubernetes Liveness Probe
```bash
curl -I http://localhost:3000/health
# HTTP/1.1 200 OK
```

### 11.2: Kubernetes Readiness Probe
```bash
curl -s http://localhost:3000/readiness | jq .
```
Expected response:
```json
{
  "status": "UP",
  "ready": true,
  "uptimeSeconds": 45,
  "dependencies": {
    "database": { "status": "connected", "ok": true },
    "redis": { "status": "connected", "ok": true },
    "storage": { "status": "healthy", "ok": true }
  }
}
```

### 11.3: Run Production Configuration Audit
```bash
node scripts/validate-production.js
```

---

## 12. Backup, Restore & Rollback Procedures
### 12.1: Create Backup
```bash
node scripts/backup-database.js
```
Creates an encrypted/SHA-256 verified snapshot in `server/backups/`.

### 12.2: Restore from Backup
```bash
node scripts/restore-database.js --source=backups/backup_elaraby_YYYY-MM-DD.json
```

---

## 13. Flutter Mobile Production Release
Build Android App Bundle (AAB):
```bash
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://workforce.elarabygroup.com/api
```
Build iOS Release IPA:
```bash
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://workforce.elarabygroup.com/api
```
