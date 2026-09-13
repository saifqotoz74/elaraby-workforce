# ERP Integration Architecture & Specifications

**System:** Elaraby Workforce ERP Bridge  
**Supported Systems:** SAP S/4HANA, Oracle Cloud HCM, Generic REST/OData  
**Module:** `server/src/integrations/erp/`  
**Base Interface:** `BaseErpAdapter` (`server/src/integrations/erp/baseErpAdapter.js`)  
**Adapters:** `SapAdapter`, `OracleAdapter`, `RestErpAdapter`, `MockErpAdapter`  

---

## 1. Enterprise Integration Philosophy

Elaraby Workforce implements a strict **Anti-Corruption Layer (ACL)** between the workforce domain models and external ERP data structures:
* The core application NEVER references SAP BAPI structures or Oracle HCM tables directly.
* All data is converted to and from canonical domain models via dedicated ERP adapters.
* Unconfigured production endpoints fail safely and report configuration status rather than throwing unhandled exceptions.

```text
[ Core Workforce Services ]
  - Leave Approvals
  - Employee Master
  - Payroll Summary
          │
          ▼
   [ ERP Gateway Factory ]
   (getErpAdapter())
          │
          ├─────────────────────────────────────────────────┐
          │                                                 │
          ▼                                                 ▼
   [ SAP Adapter ]                                  [ Oracle Adapter ]
(OData API / BAPI HTTP)                           (Oracle REST / Fusion Cloud)
          │                                                 │
          ▼                                                 ▼
[ SAP S/4HANA Cloud / On-Prem ]                   [ Oracle Cloud HCM Instance ]
```

---

## 2. Supported ERP Data Domains

| Domain | Direction | Protocol | Canonical Entity Mapping |
| :--- | :---: | :---: | :--- |
| **Employee Master** | Pull (ERP ➔ Workforce) | Batch / Webhook | `id`, `fullName`, `email`, `departmentId`, `role`, `hireDate`, `costCenter` |
| **Leave Approval** | Push (Workforce ➔ ERP) | Transactional HTTP | `requestId`, `employeeId`, `type` (Annual/Sick/Casual), `startDate`, `endDate`, `daysCount` |
| **Payroll Ledger** | Pull / Push | Batch Async | `employeeId`, `month`, `year`, `baseSalary`, `allowances`, `deductions`, `netSalary` |
| **Cost Centers** | Pull (ERP ➔ Workforce) | Daily Cache | `costCenterCode`, `factorySite`, `departmentName` |

---

## 3. Bidirectional Synchronization Architecture

### 3.1 Pull Synchronization (Scheduled Batch Sync)
1. BullMQ scheduler triggers `erp-sync` job every morning at 03:00 AM.
2. `SapAdapter.getEmployees()` or `OracleAdapter.getEmployees()` pulls delta records modified since last sync timestamp.
3. Records are normalized and upserted into PostgreSQL via `server/src/db/repository.js`.
4. Detailed sync log entry is recorded with status, record count, and latency.

### 3.2 Push Synchronization (Transactional Event Sync)
1. Manager approves employee leave request in Elaraby Connect mobile/web app.
2. Application commits approval in PostgreSQL and enqueues `erp-sync` job with payload `{ action: 'syncLeaveApproval', requestId }`.
3. Worker retrieves request and calls `erpAdapter.syncLeaveApproval(leaveData)`.
4. External ERP transaction reference ID (e.g. `SAP-DOC-9847291`) is stored on the request record for cross-system auditing.

---

## 4. Production Environment Configuration

Configure the active adapter via environment variables:
```env
ERP_PROVIDER=sap
# Options: mock, sap, oracle, rest

# SAP S/4HANA Configuration
SAP_BASE_URL=https://s4hana.elarabygroup.com:44300/sap/opu/odata/sap/
SAP_CLIENT=100
SAP_USERNAME=ELARABY_RFC_USER
SAP_PASSWORD=Secured_SAP_Password_2026
SAP_TIMEOUT_MS=15000

# Oracle Cloud HCM Configuration (if ERP_PROVIDER=oracle)
ORACLE_HCM_BASE_URL=https://hcm.elarabygroup.oraclecloud.com
ORACLE_HCM_CLIENT_ID=elaraby_workforce_client
ORACLE_HCM_CLIENT_SECRET=Secured_Oracle_Secret_2026
```
