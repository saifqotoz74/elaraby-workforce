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
  db().busTransfers = [];
  save();

  employeeToken = signToken({
    sub: 'emp_1',
    scope: 'employee',
    tenantId: 'elaraby',
    tokenVersion: 1,
  });

  adminToken = signToken({
    sub: 'admin',
    scope: 'admin',
    role: 'superadmin',
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

test('=== CORPORATE TRANSPORTATION & FLEET LIVE TRACKING SUITE ===', async (t) => {
  await t.test('1. Bus Routes Catalog: Returns pre-seeded corridors and filters by industrial complex', () => {
    const allRoutes = transportService.getRoutes();
    assert.ok(allRoutes.length >= 5, 'Must contain at least 5 standard factory routes');

    const tenthRoutes = transportService.getRoutes({ factory: '10th of Ramadan' });
    assert.ok(tenthRoutes.length >= 2, 'Must return at least 2 routes for 10th of Ramadan');
    assert.ok(tenthRoutes.every((r) => r.destinationComplex === '10th of Ramadan'));

    const quesnaRoutes = transportService.getRoutes({ factory: 'Quesna' });
    assert.ok(quesnaRoutes.length >= 2, 'Must return at least 2 routes for Quesna');
    assert.ok(quesnaRoutes.every((r) => r.destinationComplex === 'Quesna'));
  });

  await t.test('2. Employee Commute Resolution: Auto-assigns line matching worker complex', () => {
    const commute = transportService.getEmployeeCommute('emp_1');
    assert.ok(commute.route, 'Must resolve an assigned route');
    assert.strictEqual(commute.route.destinationComplex, '10th of Ramadan');
    assert.ok(commute.assignment.selectedStopId, 'Must have a default selected stop');
    assert.ok(commute.telemetry, 'Must compute initial route telemetry');
  });

  await t.test('3. Stop Selection: Updates worker preferred pickup point along assigned route', () => {
    const route = transportService.getRouteById('route_101');
    const secondStop = route.stops[1];

    const result = transportService.selectPickupStop('emp_1', {
      routeId: 'route_101',
      stopId: secondStop.id,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.selectedStopId, secondStop.id);

    const updatedCommute = transportService.getEmployeeCommute('emp_1');
    assert.strictEqual(updatedCommute.assignment.selectedStopId, secondStop.id);
  });

  await t.test('4. Stop Selection Validation: Rejects stop ID not belonging to route', () => {
    assert.throws(
      () => {
        transportService.selectPickupStop('emp_1', {
          routeId: 'route_101',
          stopId: 'stop_non_existent_999',
        });
      },
      (err) => err.statusCode === 400 && err.message === 'stop_not_found_on_route'
    );
  });

  await t.test('5. Temporary Line Transfer: Requests route switch for overtime / shift swap', () => {
    const transfer = transportService.requestRouteTransfer('emp_1', {
      targetRouteId: 'route_102',
      targetStopId: 'stop_102_2',
      reason: 'Assigned to Shift 2 on Factory B',
    });

    assert.ok(transfer.id.startsWith('TRF-'));
    assert.strictEqual(transfer.targetRouteId, 'route_102');
    assert.strictEqual(transfer.status, 'approved');

    const commute = transportService.getEmployeeCommute('emp_1');
    assert.strictEqual(commute.assignment.assignedRouteId, 'route_102');
    assert.strictEqual(commute.assignment.selectedStopId, 'stop_102_2');
  });

  await t.test('6. Live GPS Telemetry: Calculates speed, heading, waypoints and stop ETA countdown', () => {
    const telemetry = transportService.getRouteTelemetry('route_101', 'stop_101_3');
    assert.ok(telemetry, 'Telemetry must be calculated');
    assert.strictEqual(typeof telemetry.currentLat, 'number');
    assert.strictEqual(typeof telemetry.currentLng, 'number');
    assert.ok(telemetry.speedKmh > 0, 'Speed must be positive');
    assert.ok(telemetry.etaMinutes >= 2, 'ETA must be computed');
    assert.ok(['in_transit', 'approaching', 'at_stop'].includes(telemetry.status));
  });

  await t.test('7. Digital Boarding Pass: Generates HMAC token with anti-replay signature', () => {
    const pass = transportService.generateBoardingPass('emp_1');
    assert.ok(pass.qrToken.startsWith('ELARABY-BUS-'));
    assert.ok(pass.employeeName);
    assert.ok(pass.vehiclePlate);
    assert.ok(pass.seatNumber);
    assert.ok(pass.expiresInSeconds > 0 && pass.expiresInSeconds <= 60);
  });

  await t.test('8. Driver Boarding Verification: Scans QR and marks passenger in transit', () => {
    db().busBoardings = [];
    save();
    const pass = transportService.generateBoardingPass('emp_1');
    const boarding = transportService.verifyBoardingPass('drv_101', pass.qrToken);

    assert.ok(boarding.id.startsWith('BRD-'));
    assert.strictEqual(boarding.employeeId, 'emp_1');
    assert.strictEqual(boarding.transitStatus, 'in_transit');
    assert.strictEqual(boarding.excusedForTransitDelay, false);
  });

  await t.test('9. Traffic Delay Alerts & Attendance Excuse Automation', () => {
    const alert = transportService.reportRouteAlert({
      routeId: 'route_102',
      type: 'traffic_delay',
      message: 'تكدس مروري حاد على الطريق الدائري بسبب أعمال صيانة كوبري مسطرد',
      delayMinutes: 25,
      reportedBy: 'Transport Control Room',
    });

    assert.ok(alert.id.startsWith('ALT-'));
    assert.strictEqual(alert.delayMinutes, 25);

    const commute = transportService.getEmployeeCommute('emp_1');
    assert.ok(commute.alerts.length >= 1);
    assert.strictEqual(commute.boarding.excusedForTransitDelay, true);
  });

  await t.test('10. HTTP API Endpoints: Validates GET commute, routes, and admin fleet overview', async () => {
    // 1. Employee Commute
    const commuteRes = await request('GET', '/api/transport/my-commute', {
      Authorization: `Bearer ${employeeToken}`,
    });
    assert.strictEqual(commuteRes.status, 200);
    assert.ok(commuteRes.json.route);
    assert.ok(commuteRes.json.telemetry);

    // 2. Employee Routes Directory
    const routesRes = await request('GET', '/api/transport/routes?factory=Quesna', {
      Authorization: `Bearer ${employeeToken}`,
    });
    assert.strictEqual(routesRes.status, 200);
    assert.ok(routesRes.json.routes.length >= 2);

    // 3. Admin Fleet Overview
    const fleetRes = await request('GET', '/api/admin/transport/fleet', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(fleetRes.status, 200);
    assert.ok(fleetRes.json.fleet.length >= 5);
  });
});
