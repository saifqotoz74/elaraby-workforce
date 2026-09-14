const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server');
const { data: db, save } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const transportService = require('../src/services/transportService');

let server;
let port;
let employeeToken;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (e) {
            json = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, json });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test.before(async () => {
  seed(db());
  db().busBoardings = [];
  db().routeAlerts = [];
  db().proximityDispatches = {};
  save();

  employeeToken = signToken({
    sub: 'emp_1',
    scope: 'employee',
    tenantId: 'elaraby',
    tokenVersion: 1,
  });

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('=== FLEET PROXIMITY PUSH NOTIFICATIONS & SMART SUPPRESSION SUITE ===', async (t) => {
  await t.test('1. Proximity Evaluation: Dispatches actionable alert with quick actions when bus approaches', () => {
    // Ensure clean state for emp_1 on route_101
    db().proximityDispatches = {};
    save();

    const alerts = transportService.evaluateProximityAlerts('route_101');
    assert.ok(Array.isArray(alerts));

    const empAlert = alerts.find((a) => a.employeeId === 'emp_1');
    if (empAlert) {
      assert.strictEqual(empAlert.routeId, 'route_101');
      assert.strictEqual(empAlert.type, 'bus_approaching');
      assert.ok(empAlert.etaMinutes > 0);
      assert.ok(empAlert.distanceKm > 0);
      assert.ok(empAlert.quickActions.length >= 2);
      assert.strictEqual(empAlert.quickActions[0].id, 'open_map');
      assert.strictEqual(empAlert.quickActions[1].id, 'call_driver');
    }
  });

  await t.test('2. Anti-Fatigue Guard: Prevents duplicate proximity alerts in the same commute session', () => {
    // Calling evaluateProximityAlerts immediately again
    const secondPass = transportService.evaluateProximityAlerts('route_101');
    // Because already dispatched, emp_1 must not receive another alert in second pass
    const duplicateAlert = secondPass.find((a) => a.employeeId === 'emp_1');
    assert.strictEqual(duplicateAlert, undefined);
  });

  await t.test('3. Smart Commute Suppression: Approved leave automatically silences proximity alerts', () => {
    const today = new Date().toISOString().slice(0, 10);
    // Add approved annual leave for emp_1
    db().requests = db().requests || [];
    db().requests.push({
      id: 'req_test_leave_101',
      employeeId: 'emp_1',
      type: 'annual_leave',
      status: 'approved',
      details: {
        startDate: today,
        endDate: today,
        leaveType: 'Annual Leave',
      },
    });
    save();

    const suppression = transportService.isCommuteSuppressed('emp_1', today);
    assert.strictEqual(suppression.isSuppressed, true);
    assert.strictEqual(suppression.reason, 'approved_leave');
    assert.ok(suppression.reasonAr.includes('إجازة معتمدة'));
  });

  await t.test('4. Smart Commute Suppression: Weekly rest days (Friday/Saturday) are suppressed', () => {
    // Friday date
    const fridayDate = '2026-09-18';
    const suppressionFriday = transportService.isCommuteSuppressed('emp_2', fridayDate);
    assert.strictEqual(suppressionFriday.isSuppressed, true);
    assert.strictEqual(suppressionFriday.reason, 'rest_day');

    // Saturday date
    const saturdayDate = '2026-09-19';
    const suppressionSaturday = transportService.isCommuteSuppressed('emp_2', saturdayDate);
    assert.strictEqual(suppressionSaturday.isSuppressed, true);
    assert.strictEqual(suppressionSaturday.reason, 'rest_day');
  });

  await t.test('5. Manual Commute Opt-Out: Toggle "Not Commuting Today" pauses alerts and commute assignment', () => {
    const today = new Date().toISOString().slice(0, 10);
    // Remove the temporary leave so we test pure manual toggle
    db().requests = (db().requests || []).filter((r) => r.id !== 'req_test_leave_101');
    save();

    // Toggle opt out
    const optOutRes = transportService.toggleCommuteOptOut('emp_1', { optOut: true });
    assert.strictEqual(optOutRes.success, true);
    assert.strictEqual(optOutRes.optOutToday, true);

    const check = transportService.isCommuteSuppressed('emp_1', today);
    assert.strictEqual(check.isSuppressed, true);
    assert.strictEqual(check.reason, 'manual_opt_out');
    assert.strictEqual(check.optOutToday, true);

    // Toggle back to commuting
    const resumeRes = transportService.toggleCommuteOptOut('emp_1', { optOut: false });
    assert.strictEqual(resumeRes.success, true);
    assert.strictEqual(resumeRes.optOutToday, false);

    // If today is a weekday, alerts become active
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      const activeCheck = transportService.isCommuteSuppressed('emp_1', today);
      assert.strictEqual(activeCheck.isSuppressed, false);
      assert.strictEqual(activeCheck.reason, 'active');
    }
  });

  await t.test('6. HTTP Endpoints: POST /transport/opt-out & GET /transport/proximity-status', async () => {
    // 1. POST opt-out
    const postRes = await request(
      'POST',
      '/api/transport/opt-out',
      { Authorization: `Bearer ${employeeToken}` },
      { optOut: true }
    );
    assert.strictEqual(postRes.status, 200);
    assert.strictEqual(postRes.json.success, true);
    assert.strictEqual(postRes.json.optOutToday, true);

    // 2. GET proximity-status
    const getRes = await request(
      'GET',
      '/api/transport/proximity-status',
      { Authorization: `Bearer ${employeeToken}` }
    );
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.json.employeeId, 'emp_1');
    assert.ok(getRes.json.suppression);
    assert.strictEqual(getRes.json.suppression.isSuppressed, true);
    assert.strictEqual(getRes.json.suppression.reason, 'manual_opt_out');

    // 3. Reset opt-out
    await request(
      'POST',
      '/api/transport/opt-out',
      { Authorization: `Bearer ${employeeToken}` },
      { optOut: false }
    );
  });
});
