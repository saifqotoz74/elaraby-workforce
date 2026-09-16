// server/test/admin_manager_alerts.test.js
// Comprehensive test suite for Automated Manager Alerts & Notification Engine
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-2026';

const assert = require('assert');
const http = require('http');
const app = require('../server');
const { data: db } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const alertService = require('../src/services/alertService');
const loanService = require('../src/services/loanService');
const attendanceService = require('../src/services/attendanceService');
const auditService = require('../src/services/auditService');

console.log('=============================================================');
console.log('--- ADMIN AUTOMATED MANAGER ALERTS ENGINE TEST SUITE ---');
console.log('=============================================================\n');

seed(db());
// Initialize alerts array
db().alerts = [];

const adminToken = signToken({ sub: 'adm_1', scope: 'admin', role: 'admin', tenantId: 'elaraby' });
const superAdminToken = signToken({ sub: 'sup_1', scope: 'admin', role: 'superadmin' });
const elsewedyAdminToken = signToken({ sub: 'adm_swd', scope: 'admin', role: 'admin', tenantId: 'elsewedy' });

const PORT = 3994;
let server;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      method,
      path,
      headers: reqHeaders,
    }, (res) => {
      let responseText = '';
      res.on('data', (chunk) => { responseText += chunk; });
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
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(PORT, resolve);
      server.on('error', reject);
    });

    // 1. Authentication Guard Test
    console.log('--- 1. Authentication & Security Guard ---');
    const resUnauth = await request('GET', '/api/admin/alerts');
    assert.strictEqual(resUnauth.status, 401, 'Should reject unauthenticated requests with 401');
    console.log('✔ Unauthorized request successfully blocked with HTTP 401.');

    // 2. Alert Service Unit & Rotation Bounds Test
    console.log('\n--- 2. Alert Service Unit & Rotation Bounds ---');
    assert.throws(() => {
      alertService.createAlert({
        tenantId: 'elaraby',
        type: 'INVALID_TYPE',
        title: 'Bad Type',
        message: 'Should fail',
      });
    }, /Invalid alert type/);

    const alert1 = alertService.createAlert({
      tenantId: 'elaraby',
      type: alertService.ALERT_TYPES.SYSTEM,
      title: 'Database Backup Completed',
      message: 'Automated nightly snapshot stored in vault.',
      severity: alertService.ALERT_SEVERITIES.INFO,
    });
    assert.ok(alert1.id.startsWith('alt_'), 'Alert ID should have alt_ prefix');
    assert.strictEqual(alert1.tenantId, 'elaraby');
    assert.strictEqual(alert1.isRead, false);
    assert.strictEqual(alert1.read, false);
    console.log('✔ Alert created and persisted with valid schema.');

    // Verify 2,000 cap rotation bound
    for (let i = 0; i < 2050; i++) {
      db().alerts.unshift({
        id: `bulk_${i}`,
        tenantId: 'elaraby',
        type: 'SYSTEM',
        title: `Bulk Alert ${i}`,
        message: 'Testing max bound',
        severity: 'info',
        createdAt: Date.now() + i,
        readBy: [],
        isRead: false,
        read: false,
      });
    }
    // Re-trigger alertService to enforce bound
    alertService.createAlert({
      tenantId: 'elaraby',
      type: alertService.ALERT_TYPES.SYSTEM,
      title: 'Bound Check',
      message: 'Ensuring <= 2000 items',
      severity: alertService.ALERT_SEVERITIES.INFO,
    });
    assert.strictEqual(db().alerts.length, 2000, 'Alerts collection must be capped at 2,000');
    console.log('✔ 2,000 alert rotation bound strictly enforced.');

    // Reset alerts for deterministic testing
    db().alerts = [];

    // 3. Automated Trigger 1: Emergency Loan Alert
    console.log('\n--- 3. Automated Trigger: Emergency Loan Request ---');
    db().loans = (db().loans || []).filter((l) => !(l.employeeId === 'emp_1' && l.type === 'emergency_advance'));
    const loan = loanService.applyLoan('emp_1', {
      type: 'emergency_advance',
      amount: 1000,
      installmentsCount: 1,
      purpose: 'Medical emergency',
    });
    assert.ok(loan.id, 'Loan should be created');

    const loanAlert = db().alerts.find((a) => a.type === alertService.ALERT_TYPES.EMERGENCY_LOAN);
    assert.ok(loanAlert, 'Emergency advance must trigger an EMERGENCY_LOAN alert');
    assert.strictEqual(loanAlert.severity, alertService.ALERT_SEVERITIES.WARNING);
    assert.strictEqual(loanAlert.entityType, 'loan');
    assert.strictEqual(loanAlert.entityId, loan.id);
    assert.ok(loanAlert.title.includes('Emergency Loan Requested'));
    console.log(`✔ Emergency loan advance triggered alert "${loanAlert.title}" (severity: ${loanAlert.severity}).`);

    // 4. Automated Trigger 2: Geofence Breach (Strict Rejection & Soft Punch)
    console.log('\n--- 4. Automated Trigger: Geofence Breach Detection ---');
    // 4A: Strict Geofence Rejection (403 + Critical Alert)
    let strictThrew = false;
    try {
      attendanceService.recordPunch('emp_1', {
        type: 'in',
        lat: 25.1234, // Far outside 10th of Ramadan
        lng: 28.5678,
        strict: true,
      });
    } catch (err) {
      strictThrew = true;
      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.code, 'OUT_OF_GEOFENCE');
    }
    assert.ok(strictThrew, 'Strict out-of-geofence punch must throw 403');

    const strictAlert = db().alerts.find((a) => a.type === alertService.ALERT_TYPES.GEOFENCE_BREACH && a.severity === alertService.ALERT_SEVERITIES.CRITICAL);
    assert.ok(strictAlert, 'Strict geofence rejection must trigger CRITICAL GEOFENCE_BREACH alert');
    assert.strictEqual(strictAlert.metadata.strictRejection, true);
    console.log(`✔ Strict geofence breach triggered critical alert "${strictAlert.title}".`);

    // 4B: Soft Out-of-Bounds Punch (Warning Alert)
    const softPunch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 25.1234,
      lng: 28.5678,
      strict: false,
    });
    assert.ok(softPunch.id, 'Soft punch should succeed');
    assert.strictEqual(softPunch.isOutOfBounds, true);

    const softAlert = db().alerts.find((a) => a.type === alertService.ALERT_TYPES.GEOFENCE_BREACH && a.severity === alertService.ALERT_SEVERITIES.WARNING);
    assert.ok(softAlert, 'Soft out-of-bounds punch must trigger WARNING GEOFENCE_BREACH alert');
    assert.strictEqual(softAlert.entityId, softPunch.id);
    console.log(`✔ Soft geofence breach recorded punch and triggered warning alert "${softAlert.title}".`);

    // 5. Automated Trigger 3: Sensitive Audit Event
    console.log('\n--- 5. Automated Trigger: Sensitive Audit Event ---');
    auditService.recordAuditLog(db(), {
      actor: 'system_monitor',
      role: 'superadmin',
      action: 'admin_login_failed',
      details: 'Multiple invalid password attempts from IP',
      ip: '192.168.1.100',
      tenantId: 'elaraby',
    });

    const auditAlert = db().alerts.find((a) => a.type === alertService.ALERT_TYPES.AUDIT_EVENT);
    assert.ok(auditAlert, 'Sensitive audit action must trigger an AUDIT_EVENT alert');
    assert.strictEqual(auditAlert.severity, alertService.ALERT_SEVERITIES.CRITICAL);
    assert.strictEqual(auditAlert.title, 'Admin Login Failed');
    console.log(`✔ Sensitive audit event triggered critical alert "${auditAlert.title}".`);

    // 6. HTTP REST Endpoints: GET /api/admin/alerts & Query Filtering
    console.log('\n--- 6. HTTP REST Endpoints: Query Filtering & Pagination ---');
    const resGet = await request('GET', '/api/admin/alerts', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resGet.status, 200);
    assert.strictEqual(resGet.json.ok, true);
    assert.ok(Array.isArray(resGet.json.alerts));
    assert.strictEqual(resGet.json.total, 4);
    assert.strictEqual(resGet.json.unreadCount, 4);

    // Filter by type: EMERGENCY_LOAN
    const resTypeFilter = await request('GET', '/api/admin/alerts?type=EMERGENCY_LOAN', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resTypeFilter.status, 200);
    assert.strictEqual(resTypeFilter.json.alerts.length, 1);
    assert.strictEqual(resTypeFilter.json.alerts[0].type, 'EMERGENCY_LOAN');

    // Filter by severity: critical
    const resSevFilter = await request('GET', '/api/admin/alerts?severity=critical', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resSevFilter.status, 200);
    assert.strictEqual(resSevFilter.json.alerts.length, 2);
    console.log('✔ GET /api/admin/alerts returned accurate filtered and paginated results.');

    // 7. Mark Individual Alert as Read
    console.log('\n--- 7. Mark Alert as Read ---');
    const targetAlert = loanAlert;
    const resMarkRead = await request('PUT', `/api/admin/alerts/${targetAlert.id}/read`, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resMarkRead.status, 200);
    assert.strictEqual(resMarkRead.json.ok, true);
    assert.strictEqual(resMarkRead.json.alert.isRead, true);
    assert.strictEqual(resMarkRead.json.alert.read, true);
    assert.ok(resMarkRead.json.alert.readBy.some(r => r.adminSub === 'adm_1'));

    // Check that unreadCount is decremented
    const resAfterRead = await request('GET', '/api/admin/alerts?unread=true', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resAfterRead.json.alerts.length, 3);
    assert.strictEqual(resAfterRead.json.unreadCount, 3);
    console.log('✔ Individual alert marked as read with admin sub attribution.');

    // 8. Bulk Mark All Read
    console.log('\n--- 8. Bulk Mark All Alerts as Read ---');
    const resMarkAll = await request('POST', '/api/admin/alerts/mark-all-read', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resMarkAll.status, 200);
    assert.strictEqual(resMarkAll.json.ok, true);
    assert.strictEqual(resMarkAll.json.markedCount, 3);

    const resAllUnread = await request('GET', '/api/admin/alerts?unread=true', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resAllUnread.json.alerts.length, 0);
    assert.strictEqual(resAllUnread.json.unreadCount, 0);
    console.log('✔ Bulk mark-all-read cleared all remaining unread alerts.');

    // 9. Multi-Tenant Isolation
    console.log('\n--- 9. Multi-Tenant Isolation & Cross-Access Guard ---');
    // Create an alert in tenant 'elsewedy'
    const elsewedyAlert = alertService.createAlert({
      tenantId: 'elsewedy',
      type: alertService.ALERT_TYPES.SYSTEM,
      title: 'Elsewedy Transformer Hub Alert',
      message: 'Sokhna high-voltage transformer diagnostic normal.',
      severity: alertService.ALERT_SEVERITIES.INFO,
    });

    // Elaraby admin should NOT see Elsewedy alert
    const resElarabyView = await request('GET', '/api/admin/alerts', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.ok(!resElarabyView.json.alerts.some(a => a.id === elsewedyAlert.id), 'Elaraby admin must not see Elsewedy alert');

    // Elsewedy admin SHOULD see Elsewedy alert
    const resElsewedyView = await request('GET', '/api/admin/alerts', {
      Authorization: `Bearer ${elsewedyAdminToken}`,
    });
    assert.ok(resElsewedyView.json.alerts.some(a => a.id === elsewedyAlert.id), 'Elsewedy admin must see Elsewedy alert');

    // Elaraby admin cannot mark Elsewedy alert as read (403)
    const resCrossMark = await request('PUT', `/api/admin/alerts/${elsewedyAlert.id}/read`, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(resCrossMark.status, 403, 'Cross-tenant alert modification must return 403');

    // Super Admin can inspect all tenants and filter by tenantId
    const resSuper = await request('GET', `/api/admin/alerts?tenantId=elsewedy`, {
      Authorization: `Bearer ${superAdminToken}`,
    });
    assert.ok(resSuper.json.alerts.some(a => a.id === elsewedyAlert.id), 'Superadmin can filter by tenantId');
    console.log('✔ Multi-tenant isolation verified with zero cross-tenant leakage.');

    console.log('\n=============================================================');
    console.log('ALL AUTOMATED MANAGER ALERTS ENGINE TESTS PASSED (0 FAILURES)');
    console.log('=============================================================');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
})();
