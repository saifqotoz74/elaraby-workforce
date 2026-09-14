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
let driverToken;

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
  db().routeDepartures = {};
  save();

  // Assign emp_1 to route_101
  transportService.selectPickupStop('emp_1', {
    routeId: 'route_101',
    stopId: 'stop_101_1',
  });

  driverToken = signToken({
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

test('=== IN-VEHICLE DRIVER & SUPERVISOR TABLET CONSOLE SUITE ===', async (t) => {
  await t.test('1. Passenger Manifest: Groups passengers by stop and computes headcount counters', () => {
    // Ensure emp_1 is assigned to route_101
    transportService.getEmployeeAssignment('emp_1');

    const manifest = transportService.getRouteManifest('route_101');
    assert.strictEqual(manifest.route.id, 'route_101');
    assert.ok(manifest.stops.length >= 3);
    assert.ok(manifest.manifestByStop);
    assert.ok(manifest.totalPassengers >= 1);
    assert.strictEqual(typeof manifest.boardedCount, 'number');
    assert.strictEqual(typeof manifest.waitingCount, 'number');
    assert.strictEqual(typeof manifest.optedOutCount, 'number');
  });

  await t.test('2. Manual Boarding Fallback: Supervisor checks in passenger with cracked screen or dead battery', () => {
    const boarding = transportService.manualBoardPassenger('drv_101', {
      employeeId: 'emp_1',
      routeId: 'route_101',
    });

    assert.ok(boarding.id.startsWith('BRD-MANUAL-'));
    assert.strictEqual(boarding.employeeId, 'emp_1');
    assert.strictEqual(boarding.transitStatus, 'in_transit');
    assert.strictEqual(boarding.verifiedByDriver, 'drv_101');

    // Verify manifest reflects boarded status
    const manifest = transportService.getRouteManifest('route_101');
    assert.ok(manifest.boardedCount >= 1);
  });

  await t.test('3. Highway Stop Progression: Driver records departure and triggers telemetry advancement', () => {
    const depRes = transportService.advanceStopDeparture('drv_101', {
      routeId: 'route_101',
      stopId: 'stop_101_1',
    });

    assert.strictEqual(depRes.success, true);
    assert.ok(depRes.departedStops.includes('stop_101_1'));

    // Duplicate call should be idempotent
    const depRes2 = transportService.advanceStopDeparture('drv_101', {
      routeId: 'route_101',
      stopId: 'stop_101_1',
    });
    assert.strictEqual(depRes2.departedStops.filter((s) => s === 'stop_101_1').length, 1);
  });

  await t.test('4. Route Arrival Completion: Transitions in-transit passengers to arrived_at_factory', () => {
    const completeRes = transportService.completeRouteArrival('drv_101', {
      routeId: 'route_101',
    });

    assert.strictEqual(completeRes.success, true);
    assert.ok(completeRes.arrivedCount >= 1);
    assert.strictEqual(completeRes.destinationComplex, '10th of Ramadan');

    // Check passenger status transitioned
    const manifest = transportService.getRouteManifest('route_101');
    assert.strictEqual(manifest.routeState.completed, true);
    assert.ok(manifest.routeState.completedAt > 0);
  });

  await t.test('5. Driver Cockpit HTTP Endpoints: GET manifest & POST actions', async () => {
    // 1. GET Manifest
    const manifestRes = await request(
      'GET',
      '/api/transport/driver/manifest?routeId=route_101',
      { Authorization: `Bearer ${driverToken}` }
    );
    assert.strictEqual(manifestRes.status, 200);
    assert.strictEqual(manifestRes.json.route.id, 'route_101');
    assert.ok(manifestRes.json.stops.length > 0);

    // 2. POST Manual Board
    const boardRes = await request(
      'POST',
      '/api/transport/driver/board-manual',
      { Authorization: `Bearer ${driverToken}` },
      { employeeId: 'emp_2', routeId: 'route_101' }
    );
    assert.strictEqual(boardRes.status, 200);
    assert.strictEqual(boardRes.json.ok, true);
    assert.strictEqual(boardRes.json.boarding.employeeId, 'emp_2');

    // 3. POST Depart Stop
    const departRes = await request(
      'POST',
      '/api/transport/driver/depart-stop',
      { Authorization: `Bearer ${driverToken}` },
      { routeId: 'route_101', stopId: 'stop_101_2' }
    );
    assert.strictEqual(departRes.status, 200);
    assert.strictEqual(departRes.json.success, true);

    // 4. POST Complete Run
    const completeRes = await request(
      'POST',
      '/api/transport/driver/complete-run',
      { Authorization: `Bearer ${driverToken}` },
      { routeId: 'route_101' }
    );
    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeRes.json.success, true);
  });
});
