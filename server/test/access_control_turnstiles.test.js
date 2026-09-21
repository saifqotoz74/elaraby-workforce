'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const accessControl = require('../src/integrations/access_control');
const { signToken } = require('../src/auth');

const app = express();
app.use(express.json());
app.use('/api/admin', require('../src/routes/admin'));

let server;
let baseUrl;
const adminToken = signToken({ sub: 'admin_sys', username: 'admin', role: 'superadmin', scope: 'admin' });

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

test('=== HARDWARE IOT TURNSTILES & ACCESS CONTROL TEST SUITE ===', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  // 1. ZKTeco Binary Protocol & 16-Bit Checksum
  await t.test('1. ZKTeco Binary Protocol Framing & 16-Bit Checksum', () => {
    const payload = Buffer.from('TEST_PAYLOAD_DATA');
    const packet = accessControl.buildZkPacket(accessControl.OPCODES.CMD_CONNECT, 101, 1, payload);

    assert.ok(packet.length >= 16);
    assert.equal(packet.readUInt32LE(0), accessControl.MAGIC_TAG_LE);

    const parsed = accessControl.parseZkPacket(packet);
    assert.equal(parsed.cmd, accessControl.OPCODES.CMD_CONNECT);
    assert.equal(parsed.cmdName, 'CMD_CONNECT');
    assert.equal(parsed.sessionId, 101);
    assert.equal(parsed.replyId, 1);
    assert.equal(parsed.isChecksumValid, true);
    assert.equal(parsed.payload.toString('utf8'), 'TEST_PAYLOAD_DATA');
  });

  // 2. ZKTeco Packed Timestamp & 40-Byte ATTLOG Record
  await t.test('2. ZKTeco Packed Timestamp Bitfield & 40-Byte ATTLOG Record', () => {
    const originalDate = new Date('2026-09-21T08:30:15.000Z');
    const packed = accessControl.encodeZkTimestamp(originalDate);
    const decoded = accessControl.decodeZkTimestamp(packed);

    assert.equal(decoded.getUTCFullYear(), 2026);
    assert.equal(decoded.getUTCMonth(), 8); // Sep (0-indexed)
    assert.equal(decoded.getUTCDate(), 21);
    assert.equal(decoded.getUTCHours(), 8);
    assert.equal(decoded.getUTCMinutes(), 30);
    assert.equal(decoded.getUTCSeconds(), 15);

    // Build 40-byte record
    const recordBuf = Buffer.alloc(40);
    recordBuf.writeUInt16LE(42, 0); // user PIN
    recordBuf.writeUInt8(15, 2);    // verifyType: Face
    recordBuf.writeUInt32LE(packed, 4);
    recordBuf.writeUInt8(0, 8);     // punchStatus: Check-In (IN)
    recordBuf.writeUInt8(1, 9);     // workCode
    Buffer.from('EMP-9901').copy(recordBuf, 10);

    const parsedRecord = accessControl.parseAttLogRecord(recordBuf, 0);
    assert.equal(parsedRecord.userPin, 42);
    assert.equal(parsedRecord.employeeCode, 'EMP-9901');
    assert.equal(parsedRecord.verifyMode, 'FACE');
    assert.equal(parsedRecord.direction, 'IN');
  });

  // 3. Hikvision ISAPI JSON & XML Event Stream Parsing
  await t.test('3. Hikvision ISAPI JSON & XML Event Stream Parsing', () => {
    const jsonEvent = {
      ipAddress: '192.168.10.120',
      dateTime: '2026-09-21T08:45:00+02:00',
      AccessControllerEvent: {
        majorEventType: 5,
        subEventType: 75,
        name: 'Tamer Hosny',
        employeeNoString: 'emp_tamer',
        currentVerifyMode: 'face',
        attendanceStatus: 'checkIn',
        doorNo: 1,
      },
    };

    const parsedJson = accessControl.parseHikvisionJsonEvent(jsonEvent);
    assert.equal(parsedJson.isAuthorized, true);
    assert.equal(parsedJson.employeeCode, 'emp_tamer');
    assert.equal(parsedJson.verifyMode, 'FACE');
    assert.equal(parsedJson.direction, 'IN');

    const xmlEvent = `<?xml version="1.0" encoding="UTF-8"?>
    <EventNotificationAlert version="2.0">
      <ipAddress>192.168.10.121</ipAddress>
      <dateTime>2026-09-21T17:00:00+02:00</dateTime>
      <AccessControllerEvent>
        <majorEventType>5</majorEventType>
        <subEventType>1</subEventType>
        <name>Mahmoud Sami</name>
        <employeeNoString>emp_sami</employeeNoString>
        <currentVerifyMode>card</currentVerifyMode>
        <attendanceStatus>checkOut</attendanceStatus>
        <doorNo>2</doorNo>
      </AccessControllerEvent>
    </EventNotificationAlert>`;

    const parsedXml = accessControl.parseHikvisionXmlEvent(xmlEvent);
    assert.equal(parsedXml.isAuthorized, true);
    assert.equal(parsedXml.employeeCode, 'emp_sami');
    assert.equal(parsedXml.verifyMode, 'RFID_CARD');
    assert.equal(parsedXml.direction, 'OUT');
    assert.equal(parsedXml.doorNo, 2);
  });

  // 4. Anti-Passback Strict & Soft Modes
  await t.test('4. Anti-Passback (APB) Strict & Soft Rules Enforcement', () => {
    accessControl.clearAntiPassbackStore();

    // First Entry: Allowed
    const punch1 = accessControl.validateAntiPassback({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      direction: 'IN',
      gateId: 'GATE_1',
      timestamp: 100000,
    });
    assert.equal(punch1.allowed, true);

    // Consecutive Entry (Strict): Blocked!
    const punch2 = accessControl.validateAntiPassback({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      direction: 'IN',
      gateId: 'GATE_2',
      timestamp: 150000,
      mode: 'strict',
    });
    assert.equal(punch2.allowed, false);
    assert.equal(punch2.reason, 'CONSECUTIVE_ENTRY_WITHOUT_EXIT');

    // Debounce Check (<3s): Blocked
    const punchDebounce = accessControl.validateAntiPassback({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      direction: 'IN',
      gateId: 'GATE_1',
      timestamp: 101000, // 1s after punch1
    });
    assert.equal(punchDebounce.allowed, false);
    assert.equal(punchDebounce.reason, 'DEBOUNCE_DUPLICATE');

    // Consecutive Entry (Soft): Allowed with violation logged
    const punchSoft = accessControl.validateAntiPassback({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      direction: 'IN',
      gateId: 'GATE_1',
      timestamp: 200000,
      mode: 'soft',
    });
    assert.equal(punchSoft.allowed, true);
    assert.equal(punchSoft.violationLogged, true);

    // Valid Exit: Allowed
    const punchExit = accessControl.validateAntiPassback({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      direction: 'OUT',
      gateId: 'GATE_OUT_1',
      timestamp: 300000,
    });
    assert.equal(punchExit.allowed, true);

    // Admin Reset
    const reset = accessControl.resetAntiPassbackState('elaraby', 'emp_apb_1', 'OUTSIDE', 'Forgot badge');
    assert.equal(reset.ok, true);
    assert.equal(reset.currentState, 'OUT');
  });

  // 5. Offline Rotating QR Gate-Pass Verification
  await t.test('5. Offline Rotating QR Gate-Pass Verification & Anti-Replay', () => {
    const validQr = accessControl.generateRotatingQrGatePass('emp_qr_test', 'elaraby');
    assert.ok(validQr.startsWith('v1:elaraby:emp_qr_test:'));

    // First scan -> Valid
    const verify1 = accessControl.verifyRotatingQrGatePass(validQr, 'emp_qr_test');
    assert.equal(verify1.valid, true);
    assert.equal(verify1.employeeId, 'emp_qr_test');

    // Second scan (same token) -> Replay Attack Blocked!
    const verifyReplay = accessControl.verifyRotatingQrGatePass(validQr, 'emp_qr_test');
    assert.equal(verifyReplay.valid, false);
    assert.equal(verifyReplay.reason, 'REPLAY_ATTACK_DETECTED');

    // Tampered Token -> Signature Invalid
    const tamperedQr = validQr.slice(0, -4) + 'ffff';
    const verifyTampered = accessControl.verifyRotatingQrGatePass(tamperedQr, 'emp_qr_test');
    assert.equal(verifyTampered.valid, false);
    assert.equal(verifyTampered.reason, 'SIGNATURE_INVALID');

    // Employee Mismatch
    const anotherQr = accessControl.generateRotatingQrGatePass('emp_other', 'elaraby');
    const verifyMismatch = accessControl.verifyRotatingQrGatePass(anotherQr, 'emp_qr_test');
    assert.equal(verifyMismatch.valid, false);
    assert.equal(verifyMismatch.reason, 'EMPLOYEE_MISMATCH');
  });

  // 6. Turnstile Manager Heartbeats & Emergency Override (<50ms SLA)
  await t.test('6. Turnstile Manager Heartbeats & Emergency Override (<50ms SLA)', async () => {
    const devices = accessControl.getDevices('elaraby');
    assert.ok(devices.length >= 2);

    // Heartbeat update
    const devId = devices[0].id;
    const updated = accessControl.recordHeartbeat(devId, 25, true);
    assert.equal(updated.status, 'ONLINE');
    assert.ok(updated.rollingLatencyEma > 0);

    // Emergency Override SLA check
    const overrideRes = accessControl.emergencyOverride({
      tenantId: 'elaraby',
      factory: 'all',
      action: 'UNLOCK_ALL',
      adminId: 'admin_sys',
    });
    assert.equal(overrideRes.ok, true);
    assert.equal(overrideRes.action, 'UNLOCK_ALL');
    assert.equal(overrideRes.status, 'EMERGENCY_UNLOCKED');
    assert.ok(overrideRes.executionLatencyMs < 50, 'Must comply with <50ms SLA');
    assert.equal(overrideRes.slaCompliant, true);

    // Restore Override
    const restoreRes = accessControl.emergencyOverride({
      tenantId: 'elaraby',
      factory: 'all',
      action: 'RESTORE',
      adminId: 'admin_sys',
    });
    assert.equal(restoreRes.status, 'NORMAL');
  });

  // 7. HTTP Admin Endpoints Integration
  await t.test('7. HTTP Admin Endpoints: Devices, Emergency Override & APB', async () => {
    // GET /devices
    const devRes = await request('GET', '/api/admin/access-control/devices', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(devRes.status, 200);
    assert.ok(Array.isArray(devRes.json.devices));

    // POST /emergency-override
    const overrideHttp = await request('POST', '/api/admin/access-control/emergency-override', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      action: 'UNLOCK_ALL',
      factory: 'all',
    });
    assert.equal(overrideHttp.status, 200);
    assert.equal(overrideHttp.json.slaCompliant, true);

    // POST /apb/validate
    const apbHttp = await request('POST', '/api/admin/access-control/apb/validate', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      employeeId: 'emp_http_apb',
      direction: 'IN',
      gateId: 'GATE_1',
    });
    assert.equal(apbHttp.status, 200);
    assert.equal(apbHttp.json.allowed, true);
  });
});
