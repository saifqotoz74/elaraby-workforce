# Disaster Recovery & Business Continuity Plan

**System:** Elaraby Workforce Business Continuity  
**Target Organization:** Elaraby Group Enterprise IT  
**Recovery Time Objective (RTO):** < 15 Minutes  
**Recovery Point Objective (RPO):** < 5 Minutes  
**Classification:** Critical Tier-1 Internal Workforce Application  

---

## 1. Disaster Recovery Objectives & Classification

The Elaraby Workforce platform provides operational continuity for tens of thousands of factory workers, technicians, and administrative staff across multiple governorates (Qalyubia, Monufia, Cairo). 

| Metric | Target | Realization Strategy |
| :--- | :--- | :--- |
| **RTO (Recovery Time Objective)** | **15 Minutes** | Automated container spin-up via Docker Compose / Helm chart; pre-built ECR/DockerHub images; automated DNS cutover. |
| **RPO (Recovery Point Objective)** | **5 Minutes** | PostgreSQL Continuous WAL Archiving to Amazon S3 / Azure Blob + Hourly verified cryptographic snapshot backups. |

---

## 2. Disaster Scenarios & Mitigation Procedures

### Scenario A: Primary PostgreSQL Host / AZ Hardware Failure
* **Impact:** Active transactions fail; API health check reports 503 (`/readiness` fails).
* **Automated Action:** Managed cloud database (AWS RDS Multi-AZ / Cloud SQL HA) promotes Synchronous Standby replica to Primary within 60–90 seconds.
* **Application Action:** PostgreSQL connection pool in `server/src/db/postgres.js` automatically reconnects upon DNS failover.

### Scenario B: Complete Regional Outage (Data Center Fire / Flood)
* **Impact:** Entire primary data center is offline.
* **Procedure:**
  1. Redirect Route53 / Cloudflare DNS to Secondary DR Region (e.g. Frankfurt ➔ Ireland or Cairo On-Prem ➔ Cloud).
  2. Restore latest verified snapshot:
     ```bash
     node scripts/restore-database.js /mnt/dr-backups/latest-snapshot.json
     ```
  3. Replay PostgreSQL WAL archives up to last 5 minutes before disaster.
  4. Launch API and Worker containers:
     ```bash
     docker compose -f docker-compose.yml up -d
     ```
  5. Run smoke verification suite:
     ```bash
     npm run validate:production
     ```

### Scenario C: Corrupted Data or Malicious Tampering
* **Impact:** Erroneous balance deduction or corrupted database records.
* **Procedure:**
  1. Freeze API ingress immediately (`503 Maintenance Mode`).
  2. Identify the exact corruption timestamp `T`.
  3. Use PostgreSQL Point-in-Time Recovery (PITR) to restore state to `T - 1 second`.
  4. Verify data integrity against SHA-256 backup manifests.
  5. Unfreeze API ingress.

---

## 3. Disaster Recovery Drill Schedule

To ensure operational preparedness, the following drills must be conducted biannually:
1. **Unannounced Failover Drill:** Simulate primary database instance kill; verify standby promotion and zero lost transactions.
2. **Cold Site Restoration Test:** Restore latest hourly backup onto a completely clean virtual machine; assert that all 13 employees, 107 requests, and vacation balances match down to the exact byte.
