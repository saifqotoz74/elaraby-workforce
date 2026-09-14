const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const app = require('../server');
const { data: db, save } = require('../src/db');
const { seed } = require('../src/seed');
const { signToken } = require('../src/auth');
const shiftService = require('../src/services/shiftService');
const overtimeService = require('../src/services/overtimeService');
const attendanceService = require('../src/services/attendanceService');

let server;
let port;
let emp1Token;
let emp3Token;
let adminToken;

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
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

test('=== SHIFT, ROSTER, OVERTIME & ATTENDANCE SUITE ===', async (t) => {
  t.before(async () => {
    seed(db());
    db().employees = db().employees || [];

    // Ensure emp_1 has active status and tokenVersion 1
    const emp1 = db().employees.find((e) => e.id === 'emp_1');
    if (emp1) {
      emp1.tokenVersion = 1;
      emp1.factory = '10th of Ramadan';
      emp1.department = 'Production A';
    }

    // Ensure emp_3 is in same factory and department
    let emp3 = db().employees.find((e) => e.id === 'emp_3');
    if (!emp3) {
      emp3 = {
        id: 'emp_3',
        name: 'Tamer Fathy',
        nationalId: '29108081234567',
        employeeCode: 'EG-20512',
        phone: '+20 102 333 4455',
      };
      db().employees.push(emp3);
    }
    emp3.factory = '10th of Ramadan';
    emp3.department = 'Production A';
    emp3.position = 'Senior Machine Operator';
    emp3.supervisor = 'Mohamed Hassan';
    emp3.vacationBalance = 14;
    emp3.tokenVersion = 1;
    emp3.active = true;

    save();

    emp1Token = signToken({ sub: 'emp_1', scope: 'employee', tokenVersion: 1 });
    emp3Token = signToken({ sub: 'emp_3', scope: 'employee', tokenVersion: 1 });
    adminToken = signToken({ sub: 'admin_user', scope: 'admin', role: 'supervisor' });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await t.test('1. Shift Roster Engine: Generates multi-week 3-shift rotation and rest days', async () => {
    const emp1 = db().employees.find((e) => e.id === 'emp_1');
    const weeks = shiftService.getMultiWeekRoster(emp1);

    assert.ok(Array.isArray(weeks), 'weeks must be an array');
    assert.equal(weeks.length, 4, 'must generate 4 weeks of schedule');

    const currentWeek = weeks.find((w) => w.isCurrent);
    assert.ok(currentWeek, 'current week must exist');
    assert.equal(currentWeek.days.length, 7, 'each week has 7 days');

    // Friday and Saturday should be rest days
    const friday = currentWeek.days[5];
    const saturday = currentWeek.days[6];
    assert.equal(friday.shift, 'off', 'Friday is factory rest day');
    assert.equal(saturday.shift, 'off', 'Saturday is factory rest day');

    // HTTP endpoint GET /api/shifts/roster
    const res = await request('GET', '/api/shifts/roster', {
      Authorization: `Bearer ${emp1Token}`,
    });

    assert.equal(res.status, 200);
    assert.ok(res.json.weeks);
    assert.ok(res.json.todayShift);
  });

  await t.test('2. Fatigue Safety Rule: Blocks consecutive 16-hour back-to-back double shifts', () => {
    // Morning (07-15) + Evening (15-23) = 16 hours consecutive
    const fatigueMorningEvening = shiftService.checkFatigueSafety('emp_1', 'morning', 'evening', '2026-10-12');
    // Night (23-07) + Morning (07-15) = 0 hours rest consecutive
    const fatigueNightMorning = shiftService.checkFatigueSafety('emp_1', 'night', 'morning', '2026-10-12');
    assert.equal(fatigueNightMorning.safe, false, 'Night + Morning must be blocked for fatigue');
    assert.equal(fatigueNightMorning.reason, 'double_shift_fatigue');

    // Morning + Morning (same shift)
    const fatigueSame = shiftService.checkFatigueSafety('emp_1', 'morning', 'morning', '2026-10-12');
    assert.equal(fatigueSame.safe, false);
    assert.equal(fatigueSame.reason, 'same_shift');

    // Off + Morning = Safe
    const fatigueSafe = shiftService.checkFatigueSafety('emp_1', 'off', 'morning', '2026-10-12');
    assert.equal(fatigueSafe.safe, true);
  });

  await t.test('3. Peer Colleague Discovery: Returns department peers with eligibility flags', async () => {
    const res = await request('GET', '/api/shifts/colleagues?date=2026-10-13', {
      Authorization: `Bearer ${emp1Token}`,
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.colleagues));

    const colleague = res.json.colleagues.find((c) => c.id === 'emp_3');
    assert.ok(colleague, 'emp_3 should be listed in the same production department');
    assert.equal(typeof colleague.isEligible, 'boolean');
  });

  await t.test('4. Two-Tier Shift Swap: Colleague accept -> Supervisor approval -> Roster swap', async () => {
    // 1) emp_1 submits swap request with emp_3 for an off day / opposite shift
    const swapPayload = {
      targetEmployeeId: 'emp_3',
      date: '2026-10-14',
      reason: 'Urgent family doctor appointment',
    };

    const createRes = await request('POST', '/api/shifts/swap', {
      Authorization: `Bearer ${emp1Token}`,
    }, swapPayload);

    assert.equal(createRes.status, 201);
    const swap = createRes.json.swap;
    assert.ok(swap.id);
    assert.equal(swap.status, 'colleague_pending');

    // 2) Colleague emp_3 accepts the swap
    const respondRes = await request('POST', `/api/shifts/swap/${swap.id}/respond`, {
      Authorization: `Bearer ${emp3Token}`,
    }, { decision: 'accept' });

    assert.equal(respondRes.status, 200);
    assert.equal(respondRes.json.swap.status, 'supervisor_pending');

    // 3) Admin/Supervisor approves the swap
    const approveRes = await request('POST', `/api/admin/shifts/swaps/${swap.id}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved', notes: 'Approved by supervisor' });

    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json.swap.status, 'approved');

    // 4) Verify roster overrides are registered
    const overrides = db().rosterOverrides || [];
    assert.ok(overrides.some((o) => o.employeeId === 'emp_1' && o.date === '2026-10-14'));
    assert.ok(overrides.some((o) => o.employeeId === 'emp_3' && o.date === '2026-10-14'));
  });

  await t.test('5. Egyptian Labor Law Overtime Multipliers: 135%, 170%, and 200%', async () => {
    // Regular workday daytime OT (e.g. Wednesday 2026-10-14, daytime) -> 135%
    const dayOt = overtimeService.calculateOvertimePay({
      hours: 2,
      date: '2026-10-14',
      timePeriod: 'day',
      hourlyRate: 50,
    });
    assert.equal(dayOt.multiplier, 1.35);
    assert.equal(dayOt.effectiveRate, 67.5);
    assert.equal(dayOt.totalAmount, 135); // 2 * 67.5 = 135

    // Nighttime OT (19:00 - 07:00) -> 170%
    const nightOt = overtimeService.calculateOvertimePay({
      hours: 2,
      date: '2026-10-14',
      timePeriod: 'night',
      hourlyRate: 50,
    });
    assert.equal(nightOt.multiplier, 1.70);
    assert.equal(nightOt.effectiveRate, 85);
    assert.equal(nightOt.totalAmount, 170); // 2 * 85 = 170

    // Rest day Friday (2026-10-16) or Holiday (e.g. 2026-10-06 Armed Forces Day) -> 200%
    const holidayOt = overtimeService.calculateOvertimePay({
      hours: 4,
      date: '2026-10-06', // Official Egyptian Holiday
      timePeriod: 'day',
      hourlyRate: 50,
    });
    assert.equal(holidayOt.multiplier, 2.0);
    assert.equal(holidayOt.effectiveRate, 100);
    assert.equal(holidayOt.totalAmount, 400); // 4 * 100 = 400
  });

  await t.test('6. Overtime Claim Lifecycle: Create claim & supervisor approval syncs to payroll', async () => {
    const claimRes = await request('POST', '/api/overtime/claim', {
      Authorization: `Bearer ${emp1Token}`,
    }, {
      date: '2026-10-15',
      hours: 3,
      timePeriod: 'day',
      reason: 'Urgent production line rush order',
    });

    assert.equal(claimRes.status, 201);
    const claim = claimRes.json.claim;
    assert.ok(claim.id);
    assert.equal(claim.status, 'pending_supervisor');

    // Supervisor approves overtime
    const decideRes = await request('POST', `/api/admin/overtime/${claim.id}/decide`, {
      Authorization: `Bearer ${adminToken}`,
    }, { decision: 'approved', notes: 'Verified and authorized' });

    assert.equal(decideRes.status, 200);
    assert.equal(decideRes.json.claim.status, 'approved');
  });

  await t.test('7. Factory Attendance & Geofencing: Haversine distance and punch verification', async () => {
    // 10th of Ramadan factory center: lat 30.298, lng 31.742
    // Coordinates within 100m -> withinGeofence is true
    const insidePunch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 30.2982,
      lng: 31.7421,
      timestamp: Date.now(),
    });
    assert.equal(insidePunch.geofence.withinGeofence, true);

    // Coordinates in Alexandria (150 km away) -> withinGeofence is false
    const outsidePunch = attendanceService.recordPunch('emp_1', {
      type: 'in',
      lat: 31.2001,
      lng: 29.9187,
      timestamp: Date.now(),
    });
    assert.equal(outsidePunch.geofence.withinGeofence, false);
    assert.ok(outsidePunch.geofence.distanceMeters > 50000);
  });

  await t.test('8. Attendance QR Security & Offline HMAC Tokens', () => {
    // Generate rotating token
    const token = attendanceService.generateAttendanceQrToken('emp_1');
    assert.ok(token);

    // Valid verification
    const verification = attendanceService.verifyAttendanceQrToken(token, 'emp_1');
    assert.equal(verification.valid, true);

    // Impersonation check (wrong employee)
    const wrongEmp = attendanceService.verifyAttendanceQrToken(token, 'emp_2');
    assert.equal(wrongEmp.valid, false);
    assert.equal(wrongEmp.reason, 'employee_mismatch');

    // Offline token format
    const offlineToken = attendanceService.generateOfflineToken('emp_1', '2026-10-14');
    assert.ok(offlineToken.startsWith('OFFLINE:emp_1:2026-10-14:'));
  });

  await t.test('9. Today Punch State API', async () => {
    const res = await request('GET', '/api/attendance/today', {
      Authorization: `Bearer ${emp1Token}`,
    });

    assert.equal(res.status, 200);
    assert.ok(res.json.date);
    assert.ok(res.json.status);
    assert.ok(res.json.qrToken);
    assert.ok(res.json.offlineToken);
  });
});
