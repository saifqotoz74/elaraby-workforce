'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const accessControl = require('../src/integrations/access_control');
const {
  ZkTecoParser,
  HikvisionIsapiParser,
  AntiPassbackEngine,
  DeviceRegistry,
  defaultRegistry,
  HeartbeatMonitor,
  TurnstileHealthMonitor,
  defaultMonitor,
  EmergencyOverrideService,
  RotatingQrService,
} = accessControl;

const accessControlRoutes = require('../src/routes/accessControl');
const adminRoutes = require('../src/routes/admin');
const { signToken } = require('../src/auth');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(accessControlRoutes);

let server;
let baseUrl;
const adminToken = signToken({ sub: 'admin_sys', username: 'admin', role: 'superadmin', scope: 'admin' });

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      },
    );
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

  // =========================================================================
  // 1. ZKTeco Binary Protocol & 16-Bit Checksum
  // =========================================================================
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

    // Test ZkTecoParser class static methods
    const staticParsed = ZkTecoParser.parseTcpPacket(packet);
    assert.equal(staticParsed.isValid, true);
    assert.equal(staticParsed.commandId, 1000);
    assert.equal(staticParsed.sessionId, 101);

    // Test Checksum Mismatch Detection
    const corruptedPacket = Buffer.from(packet);
    corruptedPacket[10] ^= 0xff; // Corrupt inner payload byte
    const badParsed = ZkTecoParser.parseTcpPacket(corruptedPacket);
    assert.equal(badParsed.isValid, false);
    assert.equal(badParsed.error, 'CHECKSUM_MISMATCH');

    // Test Truncated Packet Detection
    const truncatedPacket = packet.subarray(0, 10);
    const truncParsed = ZkTecoParser.parseTcpPacket(truncatedPacket);
    assert.equal(truncParsed.isValid, false);

    // Test CMD_UNLOCK Packet Generation
    const unlockPacket = ZkTecoParser.createUnlockPacket(2, 4000, 77, 3);
    const parsedUnlock = ZkTecoParser.parseTcpPacket(unlockPacket);
    assert.equal(parsedUnlock.isValid, true);
    assert.equal(parsedUnlock.cmd, accessControl.OPCODES.CMD_UNLOCK);
    assert.equal(parsedUnlock.sessionId, 77);
    assert.equal(parsedUnlock.replyId, 3);
    assert.equal(parsedUnlock.payload.readUInt8(0), 2); // doorIndex
    assert.equal(parsedUnlock.payload.readUInt16LE(2), 4000); // durationMs
  });

  // =========================================================================
  // 2. ZKTeco Packed Timestamp & 40-Byte ATTLOG Record
  // =========================================================================
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
    recordBuf.writeUInt8(15, 2); // verifyType: Face
    recordBuf.writeUInt32LE(packed, 4);
    recordBuf.writeUInt8(0, 8); // punchStatus: Check-In (IN)
    recordBuf.writeUInt8(1, 9); // workCode
    Buffer.from('EMP-9901').copy(recordBuf, 10);

    const parsedRecord = accessControl.parseAttLogRecord(recordBuf, 0);
    assert.equal(parsedRecord.userPin, 42);
    assert.equal(parsedRecord.employeeCode, 'EMP-9901');
    assert.equal(parsedRecord.verifyMode, 'FACE');
    assert.equal(parsedRecord.direction, 'IN');

    // Test 40-byte ATTLOG chunk decoding in TCP packet
    const multiLogBuf = Buffer.concat([recordBuf, recordBuf]);
    const attlogPacket = ZkTecoParser.createTcpPacket(13, 1, 1, multiLogBuf);
    const parsedAttlog = ZkTecoParser.parseTcpPacket(attlogPacket);
    assert.equal(parsedAttlog.isValid, true);
    assert.equal(parsedAttlog.punches.length, 2);
    assert.equal(parsedAttlog.punches[0].employeeCode, 'EMP-9901');
    assert.equal(parsedAttlog.punches[0].punchType, 'check-in');
  });

  // =========================================================================
  // 3. Hikvision ISAPI JSON & XML Event Stream Parsing
  // =========================================================================
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

    // Test Major 2 Exception (Anti-Passback violation / Denied event)
    const deniedJson = {
      AccessControllerEvent: {
        majorEventType: 2,
        subEventType: 8,
        employeeNoString: 'emp_violator',
        attendanceStatus: 'checkIn',
      },
    };
    const parsedDenied = HikvisionIsapiParser.parseEvent(deniedJson, 'application/json');
    assert.equal(parsedDenied.isValid, true);
    assert.equal(parsedDenied.status, 'DENIED');
    assert.equal(parsedDenied.isAuthorized, false);

    // Test RemoteControlDoor command creation
    const openCmd = JSON.parse(HikvisionIsapiParser.createRemoteControlPayload('open'));
    assert.equal(openCmd.RemoteControlDoor.cmd, 'open');

    const lockCmd = JSON.parse(HikvisionIsapiParser.createRemoteControlPayload('alwaysClose'));
    assert.equal(lockCmd.RemoteControlDoor.cmd, 'alwaysClose');

    const alwaysOpenCmd = accessControl.buildRemoteDoorCommand('alwaysOpen');
    assert.equal(alwaysOpenCmd.RemoteControlDoor.cmd, 'alwaysOpen');
  });

  // =========================================================================
  // 4. Anti-Passback Strict & Soft Modes
  // =========================================================================
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
    assert.ok(
      punch2.reason === 'CONSECUTIVE_ENTRY_WITHOUT_EXIT' ||
      punch2.violationType === 'CONSECUTIVE_ENTRY' ||
      punch2.violation === 'DOUBLE_ENTRY',
    );

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

    // Consecutive Exit (Strict): Blocked!
    const punchExitDouble = accessControl.validateAntiPassback({
      tenantId: 'elaraby',
      employeeId: 'emp_apb_1',
      direction: 'OUT',
      gateId: 'GATE_OUT_2',
      timestamp: 350000,
      mode: 'strict',
    });
    assert.equal(punchExitDouble.allowed, false);

    // VIP Exemption: Allowed consecutive entry
    const vipPunch1 = AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_sec_vip',
      direction: 'IN',
    });
    const vipPunch2 = AntiPassbackEngine.validatePunch({
      tenantId: 'elaraby',
      employeeId: 'emp_sec_vip',
      direction: 'IN',
    });
    assert.equal(vipPunch1.allowed, true);
    assert.equal(vipPunch2.allowed, true);
    assert.equal(vipPunch2.exempt, true);

    // Admin Reset
    const reset = accessControl.resetAntiPassbackState('elaraby', 'emp_apb_1', 'OUTSIDE', 'Forgot badge');
    assert.equal(reset.ok, true);
    assert.equal(reset.currentState, 'OUT');

    // Midnight Auto-Forgiveness
    const forgiveRes = AntiPassbackEngine.autoForgiveMidnight(0); // 0 hours cutoff clears past states
    assert.equal(forgiveRes.ok, true);
  });

  // =========================================================================
  // 5. Offline Rotating QR Gate-Pass Verification
  // =========================================================================
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

    // Tenant Isolation Mismatch
    const tokenElaraby = RotatingQrService.generateGatePassToken({ tenantId: 'elaraby', employeeId: 'emp_cross' });
    const verifyCrossTenant = RotatingQrService.verifyGatePassToken({ token: tokenElaraby, tenantId: 'elsewedy' });
    assert.equal(verifyCrossTenant.valid, false);
    assert.equal(verifyCrossTenant.reason, 'TENANT_MISMATCH');

    // Clock Drift Beyond ±1 Step (>90s)
    const staleToken = RotatingQrService.generateGatePassToken({
      tenantId: 'elaraby',
      employeeId: 'emp_stale',
      timestamp: Date.now() - 120000,
    });
    const verifyStale = RotatingQrService.verifyGatePassToken({ token: staleToken, tenantId: 'elaraby' });
    assert.equal(verifyStale.valid, false);
    assert.equal(verifyStale.reason, 'TOKEN_EXPIRED_OR_CLOCK_DRIFT');
  });

  // =========================================================================
  // 6. Turnstile Manager Heartbeats & Emergency Override (<50ms SLA)
  // =========================================================================
  await t.test('6. Turnstile Manager Heartbeats & Emergency Override (<50ms SLA)', async () => {
    const devices = accessControl.getDevices('elaraby');
    assert.ok(devices.length >= 2);

    // Heartbeat update
    const devId = devices[0].id;
    const updated = accessControl.recordHeartbeat(devId, 25, true);
    assert.equal(updated.status, 'ONLINE');
    assert.ok(updated.rollingLatencyEma > 0);

    // Deadman switch: 3 failures -> OFFLINE
    accessControl.recordHeartbeat('DEV_DEAD_TEST', 0, false);
    accessControl.recordHeartbeat('DEV_DEAD_TEST', 0, false);
    const deadDev = accessControl.recordHeartbeat('DEV_DEAD_TEST', 0, false);
    assert.equal(deadDev.status, 'OFFLINE');
    assert.equal(deadDev.consecutiveFailures, 3);

    // Recovery from OFFLINE back to ONLINE
    const recovered = accessControl.recordHeartbeat('DEV_DEAD_TEST', 20, true);
    assert.equal(recovered.status, 'ONLINE');
    assert.equal(recovered.consecutiveFailures, 0);

    // Emergency Override SLA check (<50ms)
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

    // Parallel broadcast async override
    const asyncOverride = await EmergencyOverrideService.executeOverride({
      tenantId: 'elaraby',
      action: 'LOCKDOWN_ALL',
      factoryId: 'Quesna',
      deviceCount: 20,
    });
    assert.equal(asyncOverride.ok, true);
    assert.equal(asyncOverride.affectedGatesCount, 20);
    assert.ok(asyncOverride.executionTimeMs < 50, 'Async broadcast must complete in <50ms');
    assert.ok(asyncOverride.overrideId.startsWith('OVR-'));

    // Restore Override
    const restoreRes = accessControl.emergencyOverride({
      tenantId: 'elaraby',
      factory: 'all',
      action: 'RESTORE',
      adminId: 'admin_sys',
    });
    assert.equal(restoreRes.status, 'NORMAL');
  });

  // =========================================================================
  // 7. HTTP Admin Endpoints Integration
  // =========================================================================
  await t.test('7. HTTP Admin Endpoints: Devices, Emergency Override & APB', async () => {
    // GET /api/admin/access-control/devices
    const devRes = await request('GET', '/api/admin/access-control/devices', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(devRes.status, 200);
    assert.ok(Array.isArray(devRes.json.devices));

    // POST /api/admin/access-control/emergency-override
    const overrideHttp = await request('POST', '/api/admin/access-control/emergency-override', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      action: 'UNLOCK_ALL',
      factory: 'all',
    });
    assert.equal(overrideHttp.status, 200);
    assert.equal(overrideHttp.json.slaCompliant, true);
    assert.ok(overrideHttp.json.executionLatencyMs < 50);

    // POST /api/admin/access-control/apb/validate
    const apbHttp = await request('POST', '/api/admin/access-control/apb/validate', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      employeeId: 'emp_http_apb',
      direction: 'IN',
      gateId: 'GATE_1',
    });
    assert.equal(apbHttp.status, 200);
    assert.equal(apbHttp.json.allowed, true);

    // POST /api/admin/access-control/apb/reset
    const apbResetHttp = await request('POST', '/api/admin/access-control/apb/reset', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      employeeId: 'emp_http_apb',
      resetState: 'OUT',
      reason: 'Admin Shift Overwrite',
    });
    assert.equal(apbResetHttp.status, 200);
    assert.equal(apbResetHttp.json.currentState, 'OUT');

    // GET /api/admin/access-control/apb/violations
    const apbViolationsHttp = await request('GET', '/api/admin/access-control/apb/violations', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(apbViolationsHttp.status, 200);
    assert.ok(Array.isArray(apbViolationsHttp.json.violations));

    // POST /api/integrations/access_control/verify-qr
    const qrToken = RotatingQrService.generateGatePassToken({
      tenantId: 'elaraby',
      employeeId: 'emp_verify_endpoint',
    });
    const verifyHttp = await request('POST', '/api/integrations/access_control/verify-qr', {}, {
      token: qrToken,
      expectedEmployeeId: 'emp_verify_endpoint',
      tenantId: 'elaraby',
    });
    assert.equal(verifyHttp.status, 200);
    assert.equal(verifyHttp.json.valid, true);
    assert.equal(verifyHttp.json.employeeId, 'emp_verify_endpoint');
  });
});
