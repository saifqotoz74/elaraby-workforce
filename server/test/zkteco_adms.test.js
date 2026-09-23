'use strict';

// Test Suite: ZKTeco ADMS (BioTime) Cloud Biometric Push Protocol
// Validates:
// 1. GET  /iclock/cdata device handshake and heartbeat
// 2. POST /iclock/cdata?table=ATTLOG punch stream ingestion & employee resolution
// 3. Punch verification in attendanceService and biometric integration store
// 4. POST /iclock/cdata?table=OPERLOG hardware operational logging
// 5. GET  /iclock/getrequest device command polling
// 6. POST /iclock/devicecmd command execution feedback

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const { data: db, save, transaction } = require('../src/db');
const iclockRouter = require('../src/routes/iclock');
const attendanceService = require('../src/services/attendanceService');
const { runWithTenantContext } = require('../src/tenantContext');

const app = express();
app.use('/iclock', iclockRouter);

let server;
let baseUrl;
const highEntropySuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const testTenantId = `zk_corp_${highEntropySuffix}`;
const testSn = `ZK_SN_${highEntropySuffix}`;

const testEmployeeCode = `ZK-${Math.floor(10000 + Math.random() * 90000)}`;
const testNationalId = '29304051409988';
let testEmpId;

function requestRaw(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'X-Tenant-ID': testTenantId,
          ...headers,
        },
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: text.trim(),
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Seed test employee
  transaction((state) => {
    testEmpId = `emp_${highEntropySuffix}`;
    state.employees.push({
      id: testEmpId,
      tenantId: testTenantId,
      name: 'Biometric Test Worker',
      employeeCode: testEmployeeCode,
      nationalId: testNationalId,
      factory: '10th of Ramadan',
      department: 'Assembly',
      position: 'Operator',
      active: true,
      tokenVersion: 1,
      createdAt: Date.now(),
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('1. GET /iclock/cdata: Device Handshake & Heartbeat', async () => {
  const res = await requestRaw('GET', `/iclock/cdata?SN=${testSn}&options=all&pushver=2.4.1`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.text.includes('GET OPTION FROM'));
  assert.ok(res.text.includes(testSn));
  assert.ok(res.text.includes('OK'));
});

test('2. POST /iclock/cdata?table=ATTLOG: Punch Ingestion & Matching by Employee Code', async () => {
  const punchTimeStr = '2026-09-23 08:15:30';
  // Delimited by tabs: PIN, Time, Status (0 = in), VerifyType (1 = fingerprint), WorkCode
  const attlogPayload = `${testEmployeeCode}\t${punchTimeStr}\t0\t1\t0\t0\t0\r\n`;

  const res = await requestRaw(
    'POST',
    `/iclock/cdata?SN=${testSn}&table=ATTLOG`,
    { 'Content-Type': 'text/plain' },
    attlogPayload
  );

  assert.strictEqual(res.status, 200);
  assert.match(res.text, /^OK:?\s*\d*/);

  // Verify punch recorded in database
  const d = db();
  const todayKey = '2026-09-23';
  const punchRecord = (d.attendanceRecords || []).find((a) => a.employeeId === testEmpId && a.date === todayKey && a.type === 'in');
  assert.ok(punchRecord, 'Expected punch record in database attendanceRecords');
  assert.ok(punchRecord.timestamp, 'Expected in timestamp to be recorded');
});

test('3. POST /iclock/cdata?table=ATTLOG: Punch Matching by National ID', async () => {
  const punchTimeStr = '2026-09-23 17:05:00';
  // Status 1 = check-out
  const attlogPayload = `${testNationalId}\t${punchTimeStr}\t1\t2\t0\t0\t0\r\n`;

  const res = await requestRaw(
    'POST',
    `/iclock/cdata?SN=${testSn}&table=ATTLOG`,
    { 'Content-Type': 'text/plain' },
    attlogPayload
  );

  assert.strictEqual(res.status, 200);
  assert.match(res.text, /^OK:?\s*\d*/);

  // Verify check-out was recorded
  const d = db();
  const todayKey = '2026-09-23';
  const punchRecord = (d.attendanceRecords || []).find((a) => a.employeeId === testEmpId && a.date === todayKey && a.type === 'out');
  assert.ok(punchRecord, 'Expected check-out punch record in database attendanceRecords');
  assert.ok(punchRecord.timestamp, 'Expected out timestamp to be recorded');
});

test('4. POST /iclock/cdata?table=OPERLOG: Hardware Operational Events', async () => {
  const operlogPayload = 'OPLOG 1001 2026-09-23 08:00:00 1 0 0\r\n';
  const res = await requestRaw(
    'POST',
    `/iclock/cdata?SN=${testSn}&table=OPERLOG`,
    { 'Content-Type': 'text/plain' },
    operlogPayload
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'OK');
});

test('5. GET /iclock/getrequest: Command Polling', async () => {
  const res = await requestRaw('GET', `/iclock/getrequest?SN=${testSn}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'OK');
});

test('6. POST /iclock/devicecmd: Command Execution Acknowledgment', async () => {
  const res = await requestRaw('POST', `/iclock/devicecmd?SN=${testSn}`, {}, 'ID=1&Return=0\r\n');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'OK');
});

test('7. Case-Insensitive Query Parameters: ?sn=...&table=attlog', async () => {
  const punchTimeStr = '2026-09-23 12:30:00';
  const attlogPayload = `${testEmployeeCode}\t${punchTimeStr}\t0\t1\t0\t0\t0\r\n`;

  const res = await requestRaw(
    'POST',
    `/iclock/cdata?sn=${testSn}&table=attlog&tenantid=${testTenantId}`,
    { 'Content-Type': 'text/plain' },
    attlogPayload
  );

  assert.strictEqual(res.status, 200);
  assert.match(res.text, /^OK:?\s*\d*/);
});

test('8. Non-Hanging Protection on JSON Content-Type or Parsed Object Bodies', async () => {
  // If express.json parses the body, iclock router must not hang on consumed streams
  const res = await requestRaw(
    'POST',
    `/iclock/cdata?SN=${testSn}&table=OPERLOG`,
    { 'Content-Type': 'application/json' },
    JSON.stringify({ event: 'ping', status: 'ready' })
  );

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.text, 'OK');
});

test('9. Ambient Context Isolation: Tenant Context Preserved in Punch Service Calls', async () => {
  const customTenant = `corp_scope_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const empCode = `EG_SCOPE_${Math.floor(1000 + Math.random() * 9000)}`;
  const empId = `emp_scope_${Date.now()}`;

  transaction((state) => {
    state.employees.push({
      id: empId,
      tenantId: customTenant,
      name: 'Scoped Tenant Worker',
      employeeCode: empCode,
      nationalId: '29801011501234',
      factory: '10th of Ramadan',
      active: true,
      createdAt: Date.now(),
    });
  });

  const nowStr = '2026-09-23 09:00:00';
  const payload = `${empCode}\t${nowStr}\t0\t1\t0\t0\t0\r\n`;

  const res = await requestRaw(
    'POST',
    `/iclock/cdata?SN=${testSn}&table=ATTLOG&tenantId=${customTenant}`,
    { 'Content-Type': 'text/plain' },
    payload
  );

  assert.strictEqual(res.status, 200);
  const d = db();
  const record = (d.attendanceRecords || []).find((a) => a.employeeId === empId);
  assert.ok(record, 'Punch should be recorded');
  assert.strictEqual(record.tenantId, customTenant, 'Record tenantId must match ambient tenant');
});
