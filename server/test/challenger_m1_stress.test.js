// server/test/challenger_m1_stress.test.js
// EMPIRICAL ADVERSARIAL STRESS TEST SUITE FOR MILESTONE 1
// Challenges:
// 1. Cross-tenant intrusion attempts (Alerts & Payroll RLS isolation, Header spoofing, Scoped superadmin)
// 2. FIFO eviction at 2,000 alert capacity under rapid concurrent insertions (Ordering, Bounded size, ID collision resistance)
// 3. Geofence breach alerts under exact boundary distances (radius +/- 1m) and malformed GPS coordinates (Null Island (0,0), NaN, non-numeric, null)
// 4. Emergency loan alert generation under concurrent submissions (Multi-employee concurrency, Duplicate prevention, Idempotent retries, Validation failure suppression)

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';

const assert = require('assert');
const http = require('http');
const app = require('../server');
const { data: db, save } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const alertService = require('../src/services/alertService');
const loanService = require('../src/services/loanService');
const attendanceService = require('../src/services/attendanceService');
const auditService = require('../src/services/auditService');
const payrollService = require('../src/services/payrollService');

console.log('=============================================================');
console.log('--- EMPIRICAL ADVERSARIAL CHALLENGER SUITE (MILESTONE 1) ---');
console.log('=============================================================\n');

const PORT = 3998;
let server;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        method,
        path,
        headers: reqHeaders,
      },
      (res) => {
        let responseText = '';
        res.on('data', (chunk) => {
          responseText += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(responseText);
          } catch (_) {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: responseText,
            json,
          });
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const elarabyAdminToken = signToken({
  sub: 'adm_elaraby_challenger',
  scope: 'admin',
  role: 'admin',
  tenantId: 'elaraby',
});

const elsewedyAdminToken = signToken({
  sub: 'adm_elsewedy_challenger',
  scope: 'admin',
  role: 'admin',
  tenantId: 'elsewedy',
});

const globalSuperAdminToken = signToken({
  sub: 'sup_global_challenger',
  scope: 'admin',
  role: 'superadmin',
});

const tenantScopedSuperAdminToken = signToken({
  sub: 'sup_scoped_challenger',
  scope: 'admin',
  role: 'superadmin',
  tenantId: 'elaraby',
});

(async () => {
  let passedCount = 0;
  let findings = [];

  try {
    await new Promise((resolve, reject) => {
      server = app.listen(PORT, resolve);
      server.on('error', reject);
    });

    seed(db());
    db().alerts = [];
    save();

    // =========================================================================
    // SUITE 1: Cross-Tenant Intrusion & RLS Isolation Stress Tests
    // =========================================================================
    console.log('>>> [SUITE 1] Cross-Tenant Intrusion & RLS Isolation');

    // Setup: Create distinct alerts for Elaraby and Elsewedy
    const elarabyAlert1 = alertService.createAlert({
      tenantId: 'elaraby',
      type: alertService.ALERT_TYPES.SYSTEM,
      title: 'Elaraby Operational Status',
      message: 'Benha line running normally.',
      severity: alertService.ALERT_SEVERITIES.INFO,
    });

    const elsewedyAlert1 = alertService.createAlert({
      tenantId: 'elsewedy',
      type: alertService.ALERT_TYPES.SYSTEM,
      title: 'Elsewedy HV Transformer Report',
      message: 'Sokhna hub scheduled inspection.',
      severity: alertService.ALERT_SEVERITIES.WARNING,
    });

    // 1.1 Tenant A admin trying to fetch Tenant B alerts via query parameter
    console.log('  Testing 1.1: Elaraby Admin queries ?tenantId=elsewedy...');
    const resAlerts1 = await request('GET', '/api/admin/alerts?tenantId=elsewedy', {
      Authorization: `Bearer ${elarabyAdminToken}`,
    });
    assert.strictEqual(resAlerts1.status, 200);
    assert.strictEqual(resAlerts1.json.ok, true);
    const leakedAlerts = (resAlerts1.json.alerts || []).filter(
      (a) => (a.tenantId || '').toLowerCase() === 'elsewedy'
    );
    assert.strictEqual(leakedAlerts.length, 0, 'CRITICAL: Elaraby Admin must NOT receive Elsewedy alerts via query spoofing');
    console.log('  ✔ Passed: Elaraby admin cannot retrieve Elsewedy alerts via query parameter.');
    passedCount++;

    // 1.2 Tenant A admin trying to mark read an alert of Tenant B
    console.log('  Testing 1.2: Elaraby Admin tries to mark Elsewedy alert as read...');
    const resMarkCross = await request('PUT', `/api/admin/alerts/${elsewedyAlert1.id}/read`, {
      Authorization: `Bearer ${elarabyAdminToken}`,
    });
    assert.strictEqual(resMarkCross.status, 403, 'Cross-tenant alert read mutation must return HTTP 403');
    // Verify alert remains unread in database
    const freshElsewedyAlert = db().alerts.find((a) => a.id === elsewedyAlert1.id);
    assert.strictEqual(freshElsewedyAlert.isRead, false, 'Elsewedy alert must remain unread after unauthorized attempt');
    console.log('  ✔ Passed: Elaraby admin blocked with HTTP 403 when marking Elsewedy alert as read.');
    passedCount++;

    // 1.3 Tenant A admin tries bulk mark-all-read targeting Tenant B
    console.log('  Testing 1.3: Elaraby Admin tries bulk mark-all-read with tenantId=elsewedy...');
    const resBulkMark = await request('POST', '/api/admin/alerts/mark-all-read', {
      Authorization: `Bearer ${elarabyAdminToken}`,
    }, { tenantId: 'elsewedy' });
    assert.strictEqual(resBulkMark.status, 200);
    const checkElsewedyStillUnread = db().alerts.find((a) => a.id === elsewedyAlert1.id);
    assert.strictEqual(checkElsewedyStillUnread.isRead, false, 'Elsewedy alert must NOT be marked read by Elaraby admin bulk operation');
    console.log('  ✔ Passed: Bulk mark-all-read strictly constrained to caller tenant scope.');
    passedCount++;

    // 1.4 Tenant A admin trying to access single payslip PDF of Tenant B employee
    console.log('  Testing 1.4: Elaraby Admin accesses /api/admin/payroll/emp_swd_1/payslip-pdf...');
    const resPdfCross = await request('GET', '/api/admin/payroll/emp_swd_1/payslip-pdf', {
      Authorization: `Bearer ${elarabyAdminToken}`,
    });
    assert.strictEqual(resPdfCross.status, 403, 'Cross-tenant single payslip PDF access must return 403');
    console.log('  ✔ Passed: Single payslip PDF cross-tenant access blocked with HTTP 403.');
    passedCount++;

    // 1.5 Tenant A admin trying to access batch payslips ZIP targeting Tenant B
    console.log('  Testing 1.5: Elaraby Admin accesses /api/admin/payroll/payslips-zip?tenantId=elsewedy...');
    const resZipCross = await request('GET', '/api/admin/payroll/payslips-zip?tenantId=elsewedy', {
      Authorization: `Bearer ${elarabyAdminToken}`,
    });
    // Admin is scoped to elaraby. The query tenantId is ignored for non-superadmin.
    // So it either returns Elaraby's ZIP or 404. It must NEVER return Elsewedy employees.
    if (resZipCross.status === 200) {
      assert.ok(
        !resZipCross.headers['content-disposition'].includes('elsewedy'),
        'Zip file must not be titled with elsewedy'
      );
    } else {
      assert.ok([403, 404].includes(resZipCross.status));
    }
    console.log('  ✔ Passed: Batch payslips ZIP cross-tenant leak prevented.');
    passedCount++;

    // 1.6 Tenant A admin trying to access payroll data of Tenant B employee
    console.log('  Testing 1.6: Elaraby Admin calls GET /api/admin/payroll/emp_swd_1...');
    const resPayrollGetCross = await request('GET', '/api/admin/payroll/emp_swd_1', {
      Authorization: `Bearer ${elarabyAdminToken}`,
    });
    assert.strictEqual(resPayrollGetCross.status, 403, 'Direct payroll record read across tenants must return 403');
    console.log('  ✔ Passed: Cross-tenant GET /api/admin/payroll/:employeeId blocked with HTTP 403.');
    passedCount++;

    // 1.7 Tenant A admin trying to update payroll of Tenant B employee
    console.log('  Testing 1.7: Elaraby Admin calls PUT /api/admin/payroll/emp_swd_1...');
    const resPayrollPutCross = await request(
      'PUT',
      '/api/admin/payroll/emp_swd_1',
      { Authorization: `Bearer ${elarabyAdminToken}` },
      {
        period: 'January 2026',
        basicSalary: 99999,
        allowances: 1000,
        deductions: 0,
        paidOn: '2026-01-31',
        paymentMethod: 'Bank Transfer',
      }
    );
    assert.strictEqual(resPayrollPutCross.status, 403, 'Direct payroll update across tenants must return 403');
    console.log('  ✔ Passed: Cross-tenant PUT /api/admin/payroll/:employeeId blocked with HTTP 403.');
    passedCount++;

    // 1.8 Cross-Tenant Header Forgery (X-Tenant-ID spoofing with valid token)
    console.log('  Testing 1.8: Elaraby Admin sends forged X-Tenant-ID: elsewedy header...');
    const resForgedHeader = await request('GET', '/api/admin/alerts', {
      Authorization: `Bearer ${elarabyAdminToken}`,
      'X-Tenant-ID': 'elsewedy',
    });
    assert.strictEqual(resForgedHeader.status, 200);
    const forgedLeaked = (resForgedHeader.json.alerts || []).filter(
      (a) => (a.tenantId || '').toLowerCase() === 'elsewedy'
    );
    assert.strictEqual(forgedLeaked.length, 0, 'Forged X-Tenant-ID header must NOT bypass token tenant lock');
    console.log('  ✔ Passed: X-Tenant-ID header spoofing thwarted by authoritative token binding.');
    passedCount++;

    // 1.9 Architectural Edge Case: Tenant-Scoped Superadmin vs Global Superadmin
    console.log('  Testing 1.9: Tenant-Scoped Superadmin (role: superadmin, tenantId: elaraby)...');
    const resScopedSuperAlerts = await request('GET', '/api/admin/alerts?tenantId=elsewedy', {
      Authorization: `Bearer ${tenantScopedSuperAdminToken}`,
    });
    // Let's observe how alertService behaves when an admin token has both role: 'superadmin' and tenantId: 'elaraby'
    const scopedSuperLeaked = (resScopedSuperAlerts.json?.alerts || []).filter(
      (a) => (a.tenantId || '').toLowerCase() === 'elsewedy'
    );
    if (scopedSuperLeaked.length > 0) {
      findings.push({
        area: 'Cross-Tenant Scoped Superadmin Isolation',
        severity: 'MEDIUM',
        description:
          "In alertService.js (line 127), isSuper checks only (adminActor.role === ROLES.SUPER_ADMIN || adminActor.isSuperAdmin) without checking (!adminActor.tenantId). Consequently, an admin token with role 'superadmin' but restricted to tenantId 'elaraby' can retrieve and mark alerts belonging to 'elsewedy', whereas rbac.js strictly denies them access to payroll and employees.",
      });
      console.log('  ⚠ Finding detected: Tenant-scoped superadmin bypassed alert tenant boundary (alertService.js:127).');
    } else {
      console.log('  ✔ Passed: Tenant-scoped superadmin appropriately bounded.');
      passedCount++;
    }

    // =========================================================================
    // SUITE 2: FIFO Eviction at 2,000 Alert Capacity Under Rapid Insertions
    // =========================================================================
    console.log('\n>>> [SUITE 2] FIFO Eviction at 2,000 Alert Capacity Under Rapid Concurrent Insertions');

    db().alerts = [];
    save();

    const INSERT_COUNT = 2500;
    console.log(`  Inserting ${INSERT_COUNT} alerts rapidly across asynchronous microtasks...`);

    const insertPromises = [];
    const generatedIds = new Set();

    const startTime = Date.now();
    for (let i = 0; i < INSERT_COUNT; i++) {
      insertPromises.push(
        new Promise((res) => {
          setImmediate(() => {
            try {
              const alt = alertService.createAlert({
                tenantId: 'elaraby',
                type: alertService.ALERT_TYPES.SYSTEM,
                title: `Stress Alert #${i}`,
                message: `Concurrent insertion payload item index ${i}`,
                severity: alertService.ALERT_SEVERITIES.INFO,
                entityType: 'test',
                entityId: `entity_${i}`,
                metadata: { seqIndex: i },
              });
              generatedIds.add(alt.id);
              res(alt);
            } catch (err) {
              res(err);
            }
          });
        })
      );
    }

    const insertedResults = await Promise.all(insertPromises);
    const durationMs = Date.now() - startTime;
    console.log(`  Inserted ${INSERT_COUNT} alerts in ${durationMs}ms.`);

    // 2.1 Verify exact bounded capacity = 2,000
    const alertStore = db().alerts;
    assert.strictEqual(
      alertStore.length,
      2000,
      `Alert store MUST be exactly capped at 2,000 elements. Found: ${alertStore.length}`
    );
    console.log(`  ✔ Passed: Alert store capped at exactly 2,000 elements (evicted 500 surplus entries).`);
    passedCount++;

    // 2.2 Verify ID uniqueness (zero collisions across rapid generation)
    assert.strictEqual(
      generatedIds.size,
      INSERT_COUNT,
      `Generated alert IDs must be 100% unique. Expected ${INSERT_COUNT}, got ${generatedIds.size}`
    );
    console.log(`  ✔ Passed: All ${INSERT_COUNT} generated alert IDs are strictly unique (0 collisions).`);
    passedCount++;

    // 2.3 Verify FIFO Eviction Integrity
    // Since alerts are prepended (unshifted) with index 0 being the latest,
    // the first 500 inserted alerts (seqIndex 0..499) must be evicted,
    // and the retained alerts must be seqIndex 500..2499.
    const retainedSeqIndices = alertStore
      .map((a) => a.metadata?.seqIndex)
      .filter((s) => s !== undefined);

    const minSeqRetained = Math.min(...retainedSeqIndices);
    const maxSeqRetained = Math.max(...retainedSeqIndices);

    assert.strictEqual(minSeqRetained, 500, `Oldest retained alert seqIndex must be 500. Found: ${minSeqRetained}`);
    assert.strictEqual(maxSeqRetained, 2499, `Newest retained alert seqIndex must be 2499. Found: ${maxSeqRetained}`);
    // Verify reverse chronological order: index 0 must be 2499, index 1999 must be 500
    assert.strictEqual(alertStore[0].metadata.seqIndex, 2499, 'Top of store must be the newest alert (2499)');
    assert.strictEqual(alertStore[1999].metadata.seqIndex, 500, 'Bottom of store must be the oldest retained alert (500)');
    console.log('  ✔ Passed: FIFO eviction verified — exactly oldest 500 evicted, newest 2,000 preserved in order.');
    passedCount++;

    // 2.4 Verify Query Endpoint Consistency at Capacity
    const resGetCapacity = await request('GET', '/api/admin/alerts?limit=100', {
      Authorization: `Bearer ${elarabyAdminToken}`,
    });
    assert.strictEqual(resGetCapacity.status, 200);
    assert.strictEqual(resGetCapacity.json.total, 2000);
    assert.strictEqual(resGetCapacity.json.unreadCount, 2000);
    assert.strictEqual(resGetCapacity.json.alerts.length, 100);
    console.log('  ✔ Passed: Query endpoint accurately reflects 2,000 capacity total and unread count.');
    passedCount++;

    // =========================================================================
    // SUITE 3: Geofence Breach Under Boundary Distances & Malformed GPS
    // =========================================================================
    console.log('\n>>> [SUITE 3] Geofence Breach Under Boundary Distances & Malformed GPS');

    // Factory under test: Benha Electronics (lat: 30.4660, lng: 31.1834, radius: 650m)
    const benhaCenter = { lat: 30.466, lng: 31.1834, radius: 650 };
    // Earth radius R = 6,371,000m. dLat_deg = (meters / 6371000) * (180 / Math.PI)
    function offsetLatForDistance(meters) {
      return (meters / 6371e3) * (180 / Math.PI);
    }

    // Reset alerts
    db().alerts = [];
    save();

    // 3.1 Exact Boundary Testing:
    // Case A: 649m (1m INSIDE boundary)
    const lat649m = benhaCenter.lat + offsetLatForDistance(649);
    const punchInside = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: lat649m,
      lng: benhaCenter.lng,
      strict: false,
    });
    assert.strictEqual(punchInside.isOutOfBounds, false, '649m must be evaluated as within geofence');
    assert.strictEqual(
      db().alerts.filter((a) => a.type === alertService.ALERT_TYPES.GEOFENCE_BREACH).length,
      0,
      'No breach alert should be generated when within geofence (649m)'
    );
    console.log('  ✔ Passed: Boundary at 649m (1m inside) — NO breach alert generated.');
    passedCount++;

    // Case B: 650m (EXACTLY ON boundary: radius = 650m)
    const lat650m = benhaCenter.lat + offsetLatForDistance(650);
    const punchExact = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: lat650m,
      lng: benhaCenter.lng,
      strict: false,
    });
    assert.strictEqual(punchExact.isOutOfBounds, false, '650m exact boundary must be evaluated as within geofence (<= 650)');
    assert.strictEqual(
      db().alerts.filter((a) => a.type === alertService.ALERT_TYPES.GEOFENCE_BREACH).length,
      0,
      'No breach alert should be generated on exact boundary (650m)'
    );
    console.log('  ✔ Passed: Exact boundary at 650m — NO breach alert generated (inclusive threshold).');
    passedCount++;

    // Case C: 651m (1m OUTSIDE boundary)
    const lat651m = benhaCenter.lat + offsetLatForDistance(651);
    const punchOutsideSoft = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: lat651m,
      lng: benhaCenter.lng,
      strict: false,
    });
    assert.strictEqual(punchOutsideSoft.isOutOfBounds, true, '651m must be evaluated as out-of-bounds');
    const breachAlert651 = db().alerts.find(
      (a) => a.type === alertService.ALERT_TYPES.GEOFENCE_BREACH && a.severity === alertService.ALERT_SEVERITIES.WARNING
    );
    assert.ok(breachAlert651, 'Warning breach alert MUST be generated at 651m');
    assert.strictEqual(breachAlert651.entityId, punchOutsideSoft.id);
    console.log('  ✔ Passed: Boundary at 651m (1m outside) — Warning breach alert correctly generated.');
    passedCount++;

    // Case D: 651m in STRICT mode (Rejection + Critical Alert)
    let strictThrew = false;
    try {
      attendanceService.recordPunch('emp_1', {
        type: 'in',
        lat: lat651m,
        lng: benhaCenter.lng,
        strict: true,
      });
    } catch (err) {
      strictThrew = true;
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.code, 'OUT_OF_GEOFENCE');
    }
    assert.ok(strictThrew, 'Strict mode at 651m must reject with HTTP 403');
    const breachAlertStrict = db().alerts.find(
      (a) => a.type === alertService.ALERT_TYPES.GEOFENCE_BREACH && a.severity === alertService.ALERT_SEVERITIES.CRITICAL
    );
    assert.ok(breachAlertStrict, 'Critical breach alert MUST be generated on strict rejection at 651m');
    assert.strictEqual(breachAlertStrict.metadata.strictRejection, true);
    console.log('  ✔ Passed: Strict mode at 651m — HTTP 403 thrown and Critical breach alert generated.');
    passedCount++;

    // 3.2 Malformed GPS Coordinates Stress Testing
    console.log('  Testing 3.2: Malformed GPS Coordinates...');

    // 3.2A: Null Island coordinate (0, 0)
    // Testing if attendanceService evaluates (0, 0) as withinGeofence because of if (!lat || !lng)
    const punchNullIsland = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 0,
      lng: 0,
      strict: false,
    });
    if (punchNullIsland.geofence?.withinGeofence === true) {
      findings.push({
        area: 'Geofence Boundary Security / GPS Validation',
        severity: 'HIGH',
        description:
          "In attendanceService.js (line 237), evaluateGeofence checks 'if (!lat || !lng) return { withinGeofence: true, distanceMeters: 0 };'. In JavaScript, !0 evaluates to true. When an employee transmits coordinate (lat: 0, lng: 0) — Null Island off the Atlantic coast of Africa, ~5,000 km away — or any coordinate where lat is 0 or lng is 0, the check treats it as valid and reports withinGeofence: true (isOutOfBounds: false), completely bypassing geofence enforcement and generating zero alerts.",
      });
      console.log('  ⚠ Finding detected: Null Island (0, 0) falsely treated as within geofence due to (!lat || !lng) falsy check.');
    } else {
      console.log('  ✔ Passed: (0,0) rejected by geofence.');
      passedCount++;
    }

    // 3.2B: Non-numeric strings (lat: 'invalid', lng: 'corrupt')
    const punchString = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 'invalid',
      lng: 'corrupt',
      strict: false,
    });
    assert.strictEqual(punchString.isOutOfBounds, true, 'Non-numeric coordinates must not pass geofence');
    console.log('  ✔ Passed: Non-numeric string coordinates properly evaluated as out-of-bounds.');
    passedCount++;

    // 3.2C: Extreme out-of-range coordinates (lat: 95.0, lng: 200.0)
    const punchOutOfRange = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 95.0,
      lng: 200.0,
      strict: false,
    });
    assert.strictEqual(punchOutOfRange.isOutOfBounds, true, 'Out of range lat/lng must fail geofence');
    console.log('  ✔ Passed: Out-of-range GPS coordinates evaluated as out-of-bounds.');
    passedCount++;

    // 3.2D: Record Punch with non-numeric coordinates: Verify error handling and alert generation
    try {
      attendanceService.recordPunch('emp_1', {
        type: 'in',
        lat: 'corrupt_gps',
        lng: 'bad_gps',
        strict: true,
      });
      assert.fail('Should have thrown on non-numeric GPS in strict mode');
    } catch (err) {
      assert.strictEqual(err.statusCode, 403);
      console.log('  ✔ Passed: Corrupt GPS in strict mode safely rejected with 403.');
      passedCount++;
    }

    // =========================================================================
    // SUITE 4: Emergency Loan Alert Generation Under Concurrent Submissions
    // =========================================================================
    console.log('\n>>> [SUITE 4] Emergency Loan Alert Generation Under Concurrent Submissions');

    db().alerts = [];
    db().loans = [];
    save();

    // 4.1 Concurrent Emergency Loan Submissions Across Multiple Distinct Employees
    console.log('  Testing 4.1: 15 distinct employees concurrently submit emergency advances...');
    // Seed 15 active employees
    for (let i = 10; i < 25; i++) {
      const empId = `emp_conc_${i}`;
      if (!db().employees.some((e) => e.id === empId)) {
        db().employees.push({
          id: empId,
          tenantId: 'elaraby',
          name: `Concurrent Employee ${i}`,
          nationalId: `290010112345${i}`,
          employeeCode: `EG-CONC-${i}`,
          factory: 'Benha',
          department: 'Assembly',
          position: 'Operator',
          active: true,
          currency: 'EGP',
          tokenVersion: 1,
        });
      }
    }
    save();

    const loanPromises = [];
    for (let i = 10; i < 25; i++) {
      const empId = `emp_conc_${i}`;
      loanPromises.push(
        new Promise((res) => {
          setImmediate(() => {
            try {
              const loan = loanService.applyLoan(empId, {
                type: 'emergency_advance',
                amount: 1500,
                installmentsCount: 1,
                purpose: `Urgent emergency medical care ${i}`,
              });
              res({ ok: true, loan });
            } catch (err) {
              res({ ok: false, err });
            }
          });
        })
      );
    }

    const loanResults = await Promise.all(loanPromises);
    const successfulLoans = loanResults.filter((r) => r.ok);
    assert.strictEqual(successfulLoans.length, 15, `All 15 concurrent loans must succeed. Succeeded: ${successfulLoans.length}`);

    // Verify exactly 15 EMERGENCY_LOAN alerts were created
    const emergencyAlerts = db().alerts.filter((a) => a.type === alertService.ALERT_TYPES.EMERGENCY_LOAN);
    assert.strictEqual(
      emergencyAlerts.length,
      15,
      `Exactly 15 EMERGENCY_LOAN alerts must be generated. Found: ${emergencyAlerts.length}`
    );

    // Verify each alert maps to a unique loan
    const alertEntityIds = new Set(emergencyAlerts.map((a) => a.entityId));
    assert.strictEqual(alertEntityIds.size, 15, 'Each emergency loan alert must correlate to a distinct loan ID');
    for (const alt of emergencyAlerts) {
      assert.strictEqual(alt.severity, alertService.ALERT_SEVERITIES.WARNING);
      assert.strictEqual(alt.tenantId, 'elaraby');
      assert.strictEqual(alt.entityType, 'loan');
      assert.ok(alt.metadata?.amount === 1500);
    }
    console.log('  ✔ Passed: 15 concurrent emergency loans produced exactly 15 distinct, verified manager alerts.');
    passedCount++;

    // 4.2 Concurrent Submissions by the SAME Employee (Double-Dip / Race Condition)
    console.log('  Testing 4.2: Same employee fires 2 concurrent emergency advances...');
    const sameEmpResults = await Promise.all([
      new Promise((res) => {
        setImmediate(() => {
          try {
            const l = loanService.applyLoan('emp_conc_10', {
              type: 'emergency_advance',
              amount: 1000,
              installmentsCount: 1,
              purpose: 'Duplicate attempt 1',
            });
            res({ ok: true, l });
          } catch (e) {
            res({ ok: false, e });
          }
        });
      }),
      new Promise((res) => {
        setImmediate(() => {
          try {
            const l = loanService.applyLoan('emp_conc_10', {
              type: 'emergency_advance',
              amount: 1000,
              installmentsCount: 1,
              purpose: 'Duplicate attempt 2',
            });
            res({ ok: true, l });
          } catch (e) {
            res({ ok: false, e });
          }
        });
      }),
    ]);

    // Since emp_conc_10 already had a loan from 4.1, BOTH should fail with 409
    const failedDoubleDip = sameEmpResults.filter((r) => !r.ok && r.e?.statusCode === 409);
    assert.strictEqual(failedDoubleDip.length, 2, 'Both duplicate attempts must be rejected with 409');
    console.log('  ✔ Passed: Duplicate concurrent emergency loans rejected with 409 (active loan exists).');
    passedCount++;

    // 4.3 Idempotent Retry Bug Analysis
    console.log('  Testing 4.3: Retrying loan submission with same idempotencyKey...');
    // Clear loans for emp_3
    db().loans = (db().loans || []).filter((l) => l.employeeId !== 'emp_3');
    const preRetryAlertCount = db().alerts.filter((a) => a.type === alertService.ALERT_TYPES.EMERGENCY_LOAN).length;

    // First attempt
    const loan1 = loanService.applyLoan('emp_3', {
      type: 'emergency_advance',
      amount: 1200,
      installmentsCount: 1,
      purpose: 'Emergency car repair',
      idempotencyKey: 'idem_emp3_repair_001',
    });
    const postFirstAlertCount = db().alerts.filter((a) => a.type === alertService.ALERT_TYPES.EMERGENCY_LOAN).length;
    assert.strictEqual(postFirstAlertCount, preRetryAlertCount + 1, 'First attempt must create 1 alert');

    // Second attempt (identical idempotency key retry)
    let loan2Error = null;
    let loan2 = null;
    try {
      loan2 = loanService.applyLoan('emp_3', {
        type: 'emergency_advance',
        amount: 1200,
        installmentsCount: 1,
        purpose: 'Emergency car repair',
        idempotencyKey: 'idem_emp3_repair_001',
      });
    } catch (e) {
      loan2Error = e;
    }

    if (loan2Error) {
      // If getLoanEligibility blocked it with 409:
      findings.push({
        area: 'Idempotency vs Eligibility Ordering',
        severity: 'LOW',
        description:
          "In loanService.js, getLoanEligibility is evaluated before the idempotency check inside transaction. An idempotent retry by a client that didn't receive the original 200 response will receive a 409 'active_emergency_advance_exists' rather than returning the existing loan record.",
      });
      console.log('  ⚠ Finding detected: Idempotent retry received 409 instead of returning existing loan.');
    } else if (loan2) {
      assert.strictEqual(loan1.id, loan2.id, 'Idempotent call should return the exact same loan');
      const postSecondAlertCount = db().alerts.filter((a) => a.type === alertService.ALERT_TYPES.EMERGENCY_LOAN).length;
      if (postSecondAlertCount > postFirstAlertCount) {
        findings.push({
          area: 'Duplicate Alert Generation on Idempotent Retries',
          severity: 'MEDIUM',
          description:
            'In loanService.js (line 253), alertService.createAlert is called after the database transaction returns the loan record. When an idempotent request is re-submitted with the same idempotencyKey, the transaction correctly returns the existing loan, but lines 253-281 unconditionally trigger a duplicate EMERGENCY_LOAN manager alert for the already-existing loan.',
        });
        console.log('  ⚠ Finding detected: Idempotent retry triggered duplicate manager alert for the same loan ID.');
      } else {
        console.log('  ✔ Passed: Idempotent retry returned existing loan without duplicate alert.');
        passedCount++;
      }
    }

    // 4.4 Validation Failure Alert Suppression
    console.log('  Testing 4.4: Invalid loan submission (excessive amount) must NOT generate alert...');
    const alertCountBeforeInvalid = db().alerts.length;
    let invalidThrew = false;
    try {
      loanService.applyLoan('emp_2', {
        type: 'emergency_advance',
        amount: 9999999, // Exceeds cap
        installmentsCount: 1,
        purpose: 'Excessive advance',
      });
    } catch (err) {
      invalidThrew = true;
      assert.strictEqual(err.statusCode, 422);
    }
    assert.ok(invalidThrew, 'Excessive amount loan must throw 422');
    assert.strictEqual(db().alerts.length, alertCountBeforeInvalid, 'Failed loan must NOT generate any alert');
    console.log('  ✔ Passed: Invalid loan rejected with 422 with zero spurious alerts created.');
    passedCount++;

    console.log('\n=============================================================');
    console.log(`ALL CHALLENGER TEST SUITES COMPLETED`);
    console.log(`Passed Checks: ${passedCount}`);
    console.log(`Findings Discovered: ${findings.length}`);
    console.log('=============================================================');

    if (findings.length > 0) {
      console.log('\n--- FINDINGS SUMMARY ---');
      findings.forEach((f, idx) => {
        console.log(`[${idx + 1}] [${f.severity}] ${f.area}:`);
        console.log(`    ${f.description}\n`);
      });
    }

    // Output JSON findings for automated consumption
    console.log('__CHALLENGER_RESULTS_JSON__');
    console.log(JSON.stringify({ passedCount, findings }, null, 2));

  } catch (err) {
    console.error('❌ Challenger Suite Failure:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
})();
