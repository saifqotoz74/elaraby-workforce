const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const { data: db, save } = require('../src/db');
const { signToken } = require('../src/auth');
const shiftService = require('../src/services/shiftService');
const attendanceService = require('../src/services/attendanceService');

// Create test app with admin & employee routers
const app = express();
app.use(express.json());
app.use('/api/admin', require('../src/routes/admin'));
app.use('/api', require('../src/routes/employee'));

let server;
let baseUrl;
const adminToken = signToken({ sub: 'admin_test', username: 'admin', role: 'superadmin', scope: 'admin' });
const empToken = signToken({ sub: 'emp_1', scope: 'employee', tenantId: 'elaraby', tokenVersion: 1 });

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

test('=== AI SMART ROSTER & BULK ATTENDANCE SYNC SUITE ===', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  await t.test('1. Circadian Turnaround Fatigue & Conflict Detection', () => {
    const problematicRosters = [
      {
        employeeId: 'emp_test_1',
        employeeName: 'Fatigued Worker',
        skillTier: 'standard_operator',
        shifts: {
          sunday: 'night',
          monday: 'morning', // Fatal circadian fatigue! (0h rest)
          tuesday: 'morning',
          wednesday: 'evening',
          thursday: 'morning', // Short turnaround warning (8h rest)
          friday: 'morning',
          saturday: 'morning', // Consecutive 7 days working!
        },
      },
    ];

    const evaluation = shiftService.evaluateRosterConflicts(problematicRosters);
    assert.ok(evaluation.conflicts.length >= 3, 'Must detect multiple fatigue and rule conflicts');

    const fatalFatigue = evaluation.conflicts.find((c) => c.type === 'CIRCADIAN_FATIGUE_FATAL');
    assert.ok(fatalFatigue, 'Must detect night->morning fatigue');
    assert.equal(fatalFatigue.severity, 'CRITICAL');

    const consecutiveDays = evaluation.conflicts.find((c) => c.type === 'CONSECUTIVE_DAYS_BREACH');
    assert.ok(consecutiveDays, 'Must detect 7-day consecutive work breach');
    assert.equal(consecutiveDays.severity, 'CRITICAL');
  });

  await t.test('2. AI Smart Roster Auto-Generator Engine', () => {
    const result = shiftService.generateSmartRoster({
      tenantId: 'elaraby',
      factory: 'Quesna',
      lineQuotas: { morning: 2, evening: 1, night: 1 },
    });

    assert.ok(result.rosters.length > 0, 'Should generate rosters for candidates');
    assert.ok(result.lineBalanceScore >= 80, 'Balance score should be >= 80%');

    // Verify Friday and Saturday are preserved as rest days
    for (const r of result.rosters) {
      assert.equal(r.shifts.friday, 'off', 'Friday must be rest day');
      assert.equal(r.shifts.saturday, 'off', 'Saturday must be rest day');
    }
  });

  await t.test('3. 1-Click Zero-Reload Schedule Optimizer', () => {
    const problematicRosters = [
      {
        employeeId: 'emp_opt_1',
        employeeName: 'Tired Tech',
        shifts: {
          sunday: 'night',
          monday: 'morning', // Turnaround violation
          tuesday: 'morning',
          wednesday: 'evening',
          thursday: 'evening',
          friday: 'morning', // Rest day violation
          saturday: 'morning', // Rest day violation
        },
      },
    ];

    const optResult = shiftService.optimizeRoster({ rosters: problematicRosters });
    assert.ok(optResult.adjustmentsMade.length >= 2, 'Should make adjustments');
    assert.equal(optResult.totalConflictsRemaining, 0, 'Zero critical conflicts remaining');

    const fixedShifts = optResult.optimizedRosters[0].shifts;
    assert.equal(fixedShifts.monday, 'evening', 'Night->Morning must be optimized to Evening');
    assert.equal(fixedShifts.friday, 'off', 'Friday must be off');
  });

  await t.test('4. HTTP GET /api/admin/rosters', async () => {
    const res = await request('GET', '/api/admin/rosters?factory=Quesna', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.ok(Array.isArray(res.json.rosters));
    assert.ok(res.json.lineBalanceScore !== undefined);
  });

  await t.test('5. HTTP POST /api/admin/rosters/auto-generate', async () => {
    const res = await request('POST', '/api/admin/rosters/auto-generate', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      factory: 'Quesna',
      lineQuotas: { morning: 3, evening: 2, night: 1 },
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.ok(Array.isArray(res.json.generatedRosters));
  });

  await t.test('6. HTTP POST /api/admin/rosters/optimize', async () => {
    const res = await request('POST', '/api/admin/rosters/optimize', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      rosters: [
        {
          employeeId: 'emp_1',
          shifts: { sunday: 'night', monday: 'morning', tuesday: 'off', wednesday: 'off', thursday: 'off', friday: 'off', saturday: 'off' },
        },
      ],
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.equal(res.json.totalConflictsRemaining, 0);
  });

  await t.test('7. HTTP PUT /api/admin/rosters/bulk', async () => {
    const res = await request('PUT', '/api/admin/rosters/bulk', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      rosters: [
        {
          employeeId: 'emp_1',
          weekStart: '2026-09-20',
          shifts: { sunday: 'morning', monday: 'morning', tuesday: 'morning', wednesday: 'morning', thursday: 'morning', friday: 'off', saturday: 'off' },
        },
      ],
    });
    assert.equal(res.status, 200);
    assert.ok(res.json.ok);
    assert.equal(res.json.updatedCount, 1);
  });

  await t.test('8. HTTP POST /api/attendance/bulk-sync with 120s Deduplication', async () => {
    // Clear recent punches for emp_1 to ensure clean 120s sliding window
    const database = db();
    if (database.attendanceRecords) {
      database.attendanceRecords = database.attendanceRecords.filter(
        (r) => !(r.employeeId === 'emp_1' && r.type === 'in' && Math.abs((r.timestamp || 0) - Date.now()) <= 150000)
      );
    }

    const clientPunchId = `client_pch_${Date.now()}`;
    const timestamp = Date.now();

    // First submission -> accepted
    const syncRes1 = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${empToken}`,
    }, {
      punches: [
        {
          clientPunchId,
          type: 'in',
          lat: 30.5518,
          lng: 31.1442,
          timestamp,
        },
      ],
    });
    assert.equal(syncRes1.status, 200);
    assert.equal(syncRes1.json.acceptedCount, 1);
    assert.equal(syncRes1.json.duplicateCount, 0);
    assert.equal(syncRes1.json.results[0].status, 'accepted');

    // Duplicate submission with same clientPunchId or within 120s -> marked duplicate
    const syncRes2 = await request('POST', '/api/attendance/bulk-sync', {
      Authorization: `Bearer ${empToken}`,
    }, {
      punches: [
        {
          clientPunchId,
          type: 'in',
          lat: 30.5518,
          lng: 31.1442,
          timestamp: timestamp + 5000, // 5 seconds later
        },
      ],
    });
    assert.equal(syncRes2.status, 200);
    assert.equal(syncRes2.json.acceptedCount, 0);
    assert.equal(syncRes2.json.duplicateCount, 1);
    assert.equal(syncRes2.json.results[0].status, 'duplicate');
  });
});
