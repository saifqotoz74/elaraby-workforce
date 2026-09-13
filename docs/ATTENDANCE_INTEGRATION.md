# Biometric Hardware & Attendance Integration Architecture

**System:** Elaraby Workforce Attendance & Biometric Ingestion Engine  
**Target Hardware:** ZKTeco, Suprema, Hikvision Time-Clock Terminals  
**Ingestion Formats:** Real-Time Hardware Webhooks, SFTP/CSV Batch Exports, REST APIs  
**Module:** `server/src/integrations/biometrics/`  
**Reconciliation Engine:** `server/src/integrations/reconciliation/reconciliationEngine.js`  

---

## 1. Biometric Hardware Ingestion Flow

Factory and site biometric punch clocks (fingerprint, facial recognition, RFID badge) ingest events through a standardized pipeline into PostgreSQL:

```text
[ Biometric Hardware Terminals ]
(Factory Lines: Benha, Quesna, Cairo)
           │
           ├─────────────────────────────────────────┐
           ▼                                         ▼
   [ Hardware Webhook / REST ]               [ SFTP / CSV Drop ]
   Direct HTTP POST /api/attendance/punch    Daily Shift Punch Log
           │                                         │
           ▼                                         ▼
[ Biometric Adapter Normalization ] ◄─── [ CSV Batch Parser Engine ]
 (server/src/integrations/biometrics/)
           │
           │ Normalizes to: { employeeId, timestamp, punchType, terminalId }
           ▼
[ BullMQ attendance-sync Queue ]
           │
           ▼
[ Dedicated Ingestion Worker ]
 (server/worker.js)
           │
           ▼
[ PostgreSQL: attendances table ]
 (With B-tree unique index on employee_id + date)
```

---

## 2. Canonical Punch Normalization

Raw hardware events from different vendors exhibit varied formats. The `BaseBiometricAdapter.normalizePunch()` function converts vendor payloads into a canonical structure:

```json
{
  "employeeId": "EMP-001",
  "nationalId": "29001011234567",
  "timestamp": "2026-09-12T07:58:32.000Z",
  "date": "2026-09-12",
  "time": "07:58:32",
  "punchType": "CHECK_IN",
  "terminalId": "ZK-FACTORY-BENHA-L1",
  "location": "Benha Industrial Complex - Line 1"
}
```

### 2.1 CSV / SFTP Batch Ingestion Format
For automated nightly batch drops from on-premise hardware controllers, the parser accepts RFC 4180 CSV files:
```csv
terminal_id,user_id,timestamp,punch_type,verification_mode
ZK-QUESNA-01,1001,2026-09-12 07:55:00,1,FINGERPRINT
ZK-QUESNA-01,1002,2026-09-12 08:02:15,1,FACE
ZK-QUESNA-01,1001,2026-09-12 16:30:10,2,FINGERPRINT
```

---

## 3. Two-Way Workforce Reconciliation Engine

To guarantee payroll accuracy and resolve discrepancies between physical clock punches and approved HR leaves, the platform includes `WorkforceReconciliationEngine`:

```javascript
const { WorkforceReconciliationEngine } = require('./src/integrations/reconciliation/reconciliationEngine');

const auditReport = await WorkforceReconciliationEngine.reconcile(
  biometricRecords,
  hrMasterRecords,
  approvedLeaveRequests
);
```

### 3.1 Discrepancy Detection Categories
* **Absence with Approved Leave:** Employee did not punch, but has an active approved Annual or Sick leave record. ➔ Status: `EXCUSED_ABSENCE` (No salary deduction).
* **Unexcused Absence:** Employee did not punch, and has no approved leave request on file. ➔ Status: `UNEXCUSED_ABSENCE` (Flagged for HR review).
* **Missing Check-Out:** Employee has check-in but no check-out punch. ➔ Status: `INCOMPLETE_PUNCH` (Requires supervisor override).
* **Orphaned Hardware Punch:** Hardware terminal recorded a punch for a user ID not present in active employee master data. ➔ Status: `UNKNOWN_EMPLOYEE_PUNCH` (Security alert).
