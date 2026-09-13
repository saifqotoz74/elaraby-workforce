# Database Backup, Verification & Restore Runbook

**System:** Elaraby Workforce Database Continuity Layer  
**Engine:** Automated Snapshot & Cryptographic Verification Engine  
**Scripts:** `server/scripts/backup-database.js` & `server/scripts/restore-database.js`  
**Storage Path:** `server/backups/`  
**Manifest Hash:** SHA-256 Checksum  

---

## 1. Automated Backup Architecture

Database backups are generated with cryptographic integrity manifests to protect against data corruption or unauthorized tampering.

```text
┌───────────────────────────┐
│     PostgreSQL / Store    │
└─────────────┬─────────────┘
              │
              ▼
   [ backup-database.js ]
              │
      ┌───────┴────────────────────────┐
      ▼                                ▼
[ backup_elaraby_<ISO>.json ]    [ backup_elaraby_<ISO>.manifest.json ]
Raw Data Archive                 Metadata, Timestamps, Record Counts,
                                 SHA-256 Digest
```

### 1.1 Manifest Specification
Every backup archive is accompanied by a `.manifest.json` file:
```json
{
  "backupFile": "backup_elaraby_2026-09-12T13-42-59-183Z.json",
  "createdAt": "2026-09-12T13:42:59.183Z",
  "sha256": "3ae44e139f24679237769f84cf98f295e793d2153a42d3b9e097666add1b8fc6",
  "sizeBytes": 1004275,
  "tables": {
    "tenants": 1,
    "departments": 8,
    "employees": 13,
    "vacation_balances": 13,
    "requests": 107,
    "attendances": 1500,
    "payrolls": 156
  }
}
```

---

## 2. Backup Execution Commands

### 2.1 Standard Automated Backup
Run manually or via scheduled cron job:
```bash
cd server
node scripts/backup-database.js
```

### 2.2 Retention Policy
The script automatically cleans up old backups, retaining the **last 30 daily snapshots** (`MAX_BACKUPS_TO_KEEP=30`).

---

## 3. Pre-Restoration Verification & Security Gate

Before any data is restored into the database, `restore-database.js` executes strict pre-flight checks:
1. **File Existence:** Ensures the backup file exists on disk.
2. **Manifest Verification:** Verifies the cryptographic `.manifest.json` accompanies the archive.
3. **SHA-256 Checksum Verification:** Recalculates the archive digest and asserts exact equality against the manifest. If even a single byte differs (e.g. storage bit rot or tampering), the restore process **aborts immediately with exit code 1**.
4. **Schema Compatibility:** Asserts essential root tables are present.

### 3.1 Verification-Only Mode (Smoke Test)
To verify an archive's integrity without applying changes:
```bash
node scripts/restore-database.js server/backups/backup_elaraby_2026-09-12T13-42-59-183Z.json --verify-only
```

### 3.2 Live Database Restoration
```bash
node scripts/restore-database.js server/backups/backup_elaraby_2026-09-12T13-42-59-183Z.json
```

---

## 4. Disaster Recovery Schedule (Crontab)

For production Linux environments, configure automated snapshots via crontab:
```cron
# Hourly database snapshot with cryptographic manifest
0 * * * * cd /opt/elaraby-workforce/server && /usr/bin/node scripts/backup-database.js >> /var/log/elaraby-backup.log 2>&1

# Daily verification test at 02:00 AM (restores to temporary test DB to verify integrity)
0 2 * * * cd /opt/elaraby-workforce/server && /usr/bin/node scripts/restore-database.js $(ls -t server/backups/backup_*.json | head -1) --verify-only >> /var/log/elaraby-backup-verify.log 2>&1
```
