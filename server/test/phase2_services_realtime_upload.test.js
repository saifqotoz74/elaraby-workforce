// Phase 2 Test Suite: Vacation Balance Safety, Realtime SSE Bridge, Multipart Upload, and Domain Services
process.env.NODE_ENV = 'test';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = require('../server');
const { data, save } = require('../src/db');
const { signToken } = require('../src/auth');

const PORT = 3997;
let server;

function request(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: data,
          json: json,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
    }
    req.end();
  });
}

function openSseConnection(urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const events = [];
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n\n');
        while (parts.length > 1) {
          const raw = parts.shift().trim();
          if (raw && !raw.startsWith(':')) {
            const lines = raw.split('\n');
            let event = 'message';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) event = line.slice(7).trim();
              if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
            }
            let parsed = null;
            try {
              parsed = JSON.parse(dataStr);
            } catch (_) {
              parsed = dataStr;
            }
            events.push({ event, data: parsed });
          }
        }
        buffer = parts[0] || '';
      });

      resolve({
        req,
        res,
        events,
        close: () => req.destroy(),
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function buildMultipartBody(boundary, filename, fileBuffer) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileBuffer, tail]);
}

async function runTests() {
  console.log('=============================================================');
  console.log('PHASE 2 TEST SUITE: Vacation Balance, SSE Realtime & Multipart');
  console.log('=============================================================');

  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`Phase 2 test server running on port ${PORT}`);
      resolve();
    });
  });

  try {
    const adminToken = signToken({ sub: 'admin', scope: 'admin', role: 'superadmin' });
    const authHeader = { Authorization: `Bearer ${adminToken}` };

    // 1. Vacation Balance Safety & Strict Bounds
    console.log('\n--- Section 1: Vacation Balance Safety & Validation ---');
    const d = data();
    const testEmp = {
      id: 'emp_phase2_balance',
      name: 'Balance Test Employee',
      nationalId: '29001019876543',
      employeeCode: 'EG-2026-BAL',
      factory: '10th of Ramadan',
      department: 'Production A',
      position: 'Operator',
      active: true,
      vacationBalance: 20,
    };
    d.employees = d.employees.filter((e) => e.id !== testEmp.id);
    d.employees.push(testEmp);
    save();

    // 1a. Negative vacation balance rejection
    const negRes = await request('PUT', `/api/admin/employees/${testEmp.id}`, authHeader, {
      vacationBalance: -5,
    });
    assert.strictEqual(negRes.status, 400);
    assert.strictEqual(negRes.json.error, 'vacation_balance_cannot_be_negative');
    console.log('✔ Blocked negative vacation balance (-5) with 400.');

    // 1b. Excessive vacation balance rejection (> 60 days)
    const excessRes = await request('PUT', `/api/admin/employees/${testEmp.id}`, authHeader, {
      vacationBalance: 65,
    });
    assert.strictEqual(excessRes.status, 400);
    assert.strictEqual(excessRes.json.error, 'vacation_balance_exceeds_maximum_60');
    console.log('✔ Blocked excessive vacation balance (65 > 60) with 400.');

    // 1c. Decimal fraction validation (> 1 decimal place rejected)
    const decimalRes = await request('PUT', `/api/admin/employees/${testEmp.id}`, authHeader, {
      vacationBalance: 14.333,
    });
    assert.strictEqual(decimalRes.status, 400);
    assert.strictEqual(decimalRes.json.error, 'vacation_balance_max_one_decimal_place');
    console.log('✔ Blocked fractional balance with > 1 decimal place with 400.');

    // 1d. Valid half-day vacation balance accepted
    const validBalRes = await request('PUT', `/api/admin/employees/${testEmp.id}`, authHeader, {
      vacationBalance: 21.5,
    });
    assert.strictEqual(validBalRes.status, 200);
    assert.strictEqual(validBalRes.json.employee.vacationBalance, 21.5);
    console.log('✔ Allowed valid vacation balance (21.5) with 200.');

    // 2. Enhanced Audit Log Trail with Before/After
    console.log('\n--- Section 2: Audit Logs Before/After Diffing ---');
    const auditRes = await request('GET', '/api/admin/audit-logs?limit=5', authHeader);
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.json.auditLogs.length > 0);
    const lastLog = auditRes.json.auditLogs[0];
    assert.strictEqual(lastLog.action, 'update_employee');
    assert.ok(lastLog.before !== undefined);
    assert.ok(lastLog.after !== undefined);
    assert.strictEqual(lastLog.after.vacationBalance, 21.5);
    console.log('✔ Audit log correctly captured immutable before and after states.');

    // 3. Streaming Multipart Image Upload
    console.log('\n--- Section 3: Streaming Multipart Upload & Magic-Byte Validation ---');
    const boundary = '----WebKitFormBoundaryPhase2Test123456';
    // Valid 1x1 PNG Buffer
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);
    const multipartBody = buildMultipartBody(boundary, 'avatar.png', validPngBuffer);

    const uploadRes = await request(
      'POST',
      '/api/admin/upload-file',
      {
        ...authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      multipartBody
    );
    assert.strictEqual(uploadRes.status, 200);
    assert.ok(uploadRes.json.url.startsWith('/uploads/img_'));
    assert.strictEqual(uploadRes.json.size, validPngBuffer.length);
    console.log('✔ Multipart upload successfully processed and saved with magic-byte check.');

    // Reject disguised non-image
    const fakeImageBuffer = Buffer.from('console.log("malicious shell script")');
    const fakeMultipartBody = buildMultipartBody(boundary, 'malicious.png', fakeImageBuffer);
    const fakeUploadRes = await request(
      'POST',
      '/api/admin/upload-file',
      {
        ...authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      fakeMultipartBody
    );
    assert.strictEqual(fakeUploadRes.status, 400);
    assert.strictEqual(fakeUploadRes.json.error, 'invalid_image_data');
    console.log('✔ Disguised file with false extension rejected by magic-byte validator (400).');

    // 4. Realtime SSE Bridge
    console.log('\n--- Section 4: Realtime SSE Bridge (Admin ↔ Mobile Event Flow) ---');
    const sseClient = await openSseConnection('/api/admin/realtime', authHeader);
    await new Promise((r) => setTimeout(r, 100)); // Wait for handshake

    assert.ok(sseClient.events.some((e) => e.event === 'connected'));
    console.log('✔ Admin connected to Realtime SSE event stream.');

    // 4a. Mobile employee creates leave request -> Admin receives realtime event
    const empToken = signToken({ sub: testEmp.id, scope: 'employee' });
    const createReqRes = await request('POST', '/api/requests', {
      Authorization: `Bearer ${empToken}`,
    }, {
      type: 'Leave',
      title: 'Annual Leave Realtime Test',
      requestedDays: 2,
    });
    assert.strictEqual(createReqRes.status, 200);
    const createdReqId = createReqRes.json.request.id;

    await new Promise((r) => setTimeout(r, 150));
    const reqCreatedEvent = sseClient.events.find((e) => e.event === 'leave.request.created');
    assert.ok(reqCreatedEvent, 'SSE client must receive leave.request.created event');
    assert.strictEqual(reqCreatedEvent.data.request.id, createdReqId);
    console.log('✔ Realtime event "leave.request.created" delivered to connected Admin client.');

    // 4b. Admin approves request -> Realtime broadcast leave.request.approved
    const approveRes = await request('POST', `/api/admin/requests/${createdReqId}/decide`, authHeader, {
      status: 'approved',
    });
    assert.strictEqual(approveRes.status, 200);

    await new Promise((r) => setTimeout(r, 150));
    const reqApprovedEvent = sseClient.events.find((e) => e.event === 'leave.request.approved');
    assert.ok(reqApprovedEvent, 'SSE client must receive leave.request.approved event');
    console.log('✔ Realtime event "leave.request.approved" delivered to connected clients.');

    // 4c. Announcement Creation -> Realtime event announcement.created
    const annRes = await request('POST', '/api/admin/announcements', authHeader, {
      title: 'Realtime Announcement',
      body: 'Broadcasted to all workforce devices',
    });
    assert.strictEqual(annRes.status, 200);

    await new Promise((r) => setTimeout(r, 150));
    const annCreatedEvent = sseClient.events.find((e) => e.event === 'announcement.created');
    assert.ok(annCreatedEvent, 'SSE client must receive announcement.created event');
    console.log('✔ Realtime event "announcement.created" delivered.');

    sseClient.close();

    console.log('\n=============================================================');
    console.log('PHASE 2 COMPLETE: ALL SERVICES, REALTIME & SAFETY TESTS PASSED');
    console.log('=============================================================');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ PHASE 2 TEST FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
