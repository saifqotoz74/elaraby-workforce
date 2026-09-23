// ZKTeco ADMS (BioTime Push Protocol) Cloud Hardware Listener
// Implements standard ADMS push endpoints for direct hardware cloud connectivity:
// - GET  /iclock/cdata (Device Handshake & Heartbeat)
// - POST /iclock/cdata?table=ATTLOG (Real-time Tab-separated Attendance Logs)
// - POST /iclock/cdata?table=OPERLOG (Hardware Operational Events)
// - GET  /iclock/getrequest (Device Command Polling)
// - POST /iclock/devicecmd (Device Command Execution Acknowledgement)

const express = require('express');
const { data: db, save } = require('../db');
const attendanceService = require('../services/attendanceService');
const biometrics = require('../integrations/biometrics');
const { getCurrentTenantId, runWithTenantContext } = require('../tenantContext');

const router = express.Router();

// Ensure raw plain-text payload can be ingested even when device omits standard headers
router.use(express.text({ type: '*/*', limit: '10mb' }));
router.use((req, res, next) => {
  if (typeof req.body === 'string') return next();
  if (Buffer.isBuffer(req.body)) {
    req.body = req.body.toString('utf8');
    return next();
  }
  if (req.body && typeof req.body === 'object') {
    if (typeof req.body.data === 'string') req.body = req.body.data;
    else if (typeof req.body.punch === 'string') req.body = req.body.punch;
    else req.body = JSON.stringify(req.body);
    return next();
  }
  if (req.readableEnded || req.complete) {
    if (!req.body) req.body = '';
    return next();
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    if (!req.body || typeof req.body !== 'string') {
      req.body = raw;
    }
    next();
  });
  req.on('error', () => {
    req.body = raw || '';
    next();
  });
});

/**
 * Matches an employee across the database using UserPin/Badge sent by hardware.
 */
function matchEmployee(userPin, tenantId) {
  if (!userPin) return null;
  const pin = String(userPin).trim().toLowerCase();
  const d = db();
  const employees = (d.employees || []).filter((e) => {
    if (!tenantId) return true;
    return (e.tenantId || 'elaraby').toLowerCase() === tenantId.toLowerCase();
  });

  // 1. Exact match on employeeCode
  let match = employees.find((e) => e.employeeCode && e.employeeCode.toLowerCase() === pin);
  if (match) return match;

  // 2. Exact match on nationalId
  match = employees.find((e) => e.nationalId && e.nationalId.toLowerCase() === pin);
  if (match) return match;

  // 3. Exact match on system ID
  match = employees.find((e) => e.id && e.id.toLowerCase() === pin);
  if (match) return match;

  // 4. Match where employee code ends with the numeric PIN (e.g. pin "20481" matches "EG-20481")
  match = employees.find((e) => e.employeeCode && e.employeeCode.toLowerCase().endsWith(pin));
  if (match) return match;

  // 5. Match by numeric digits extraction
  const cleanPinDigits = pin.replace(/\D/g, '');
  if (cleanPinDigits.length >= 3) {
    match = employees.find((e) => {
      const codeDigits = (e.employeeCode || '').replace(/\D/g, '');
      return codeDigits === cleanPinDigits || (e.nationalId && e.nationalId.endsWith(cleanPinDigits));
    });
  }

  return match || null;
}

/**
 * Parses ZKTeco ADMS ATTLOG punch lines.
 * Standard format: <PIN>\t<Time>\t<Status>\t<VerifyType>\t<WorkCode>\t<Reserved1>\t<Reserved2>
 */
function parseAttlogPayload(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return [];
  const lines = bodyText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const punches = [];

  for (const line of lines) {
    // Delimited by tabs or multiple spaces
    const parts = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}|\s+/);
    if (parts.length >= 2) {
      const pin = parts[0].trim();
      const timeStr = parts[1].trim();
      const status = parts[2] !== undefined ? parts[2].trim() : '0';
      const verifyType = parts[3] !== undefined ? parts[3].trim() : '1';
      const workCode = parts[4] !== undefined ? parts[4].trim() : '0';

      const punchDate = new Date(timeStr);
      const isValidDate = !isNaN(punchDate.getTime());

      punches.push({
        pin,
        timeStr,
        timestamp: isValidDate ? punchDate.getTime() : Date.now(),
        status, // 0 = check-in, 1 = check-out, 2 = break-out, 3 = break-in, 4 = ot-in, 5 = ot-out
        verifyType, // 1 = Fingerprint, 2 = Face, 4 = Password, 15 = RFID
        workCode,
        rawLine: line,
      });
    }
  }

  return punches;
}

/**
 * GET /iclock/cdata
 * Device handshake and heartbeat response.
 */
router.get('/cdata', (req, res) => {
  const sn = req.query.SN || req.query.sn || req.headers['x-device-sn'] || 'UNKNOWN_SN';
  const pushver = req.query.pushver || req.query.Pushver || req.query.pushVersion || '2.4.1';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  // Standard ADMS initialization handshake response
  res.status(200).send(`GET OPTION FROM: ${sn}\r\nStamp=9999\r\nOpStamp=9999\r\nErrorDelay=60\r\nDelay=30\r\nResLogDay=180\r\nResLogDelType=1\r\nResLogCount=50000\r\nTransTimes=00:00;14:05\r\nTransInterval=1\r\nTransFlag=1111000000\r\nRealtime=1\r\nEncrypt=0\r\nPushOptionsFlag=1\r\nServerVersion=${pushver}\r\nOK\r\n`);
});

/**
 * POST /iclock/cdata
 * Handles real-time punch data (ATTLOG) and operational logs (OPERLOG).
 */
router.post('/cdata', async (req, res) => {
  const table = (req.query.table || req.query.Table || '').toUpperCase();
  const sn = req.query.SN || req.query.sn || req.headers['x-device-sn'] || 'ZKTECO_TERMINAL';
  const tenantId = (
    req.query.tenantId ||
    req.query.tenantid ||
    req.query.tenant ||
    req.headers['x-tenant-id'] ||
    getCurrentTenantId() ||
    'elaraby'
  ).toString().trim().toLowerCase();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  return runWithTenantContext({ tenantId, actor: `zkteco_${sn}` }, async () => {
    // 1. Process ATTLOG Attendance Punch stream
    if (table === 'ATTLOG') {
      const punches = parseAttlogPayload(req.body);
      let recordedCount = 0;
      const biometricBatch = [];

      for (const p of punches) {
        const isOut = p.status === '1' || p.status.toUpperCase().includes('OUT');
        const punchType = isOut ? 'out' : 'in';
        const employee = matchEmployee(p.pin, tenantId);

        if (employee) {
          try {
            attendanceService.recordPunch(employee.id, {
              type: punchType,
              timestamp: p.timestamp,
              strict: false,
              isOffline: true,
              clientPunchId: `zk_${sn}_${p.pin}_${p.timestamp}`,
            });
            recordedCount++;
          } catch (_) {}
        }

        biometricBatch.push({
          badgeNumber: p.pin,
          nationalId: employee?.nationalId || null,
          deviceId: sn,
          punchTime: new Date(p.timestamp),
          punchType: isOut ? 'CHECK_OUT' : 'CHECK_IN',
          status: p.status,
          verifyType: p.verifyType,
        });
      }

      if (biometricBatch.length > 0) {
        try {
          await biometrics.ingest(biometricBatch);
        } catch (_) {}
      }

      // Standard ADMS acknowledgement
      return res.status(200).send(`OK: ${recordedCount > 0 ? recordedCount : punches.length}\r\n`);
    }

    // 2. Operational events log (OPERLOG)
    if (table === 'OPERLOG') {
      return res.status(200).send('OK\r\n');
    }

    // Default fallback acknowledgement
    return res.status(200).send('OK\r\n');
  });
});

/**
 * GET /iclock/getrequest
 * Polling endpoint for commands queued for the device.
 */
router.get('/getrequest', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send('OK\r\n');
});

/**
 * POST /iclock/devicecmd
 * Device response when command execution completes.
 */
router.post('/devicecmd', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send('OK\r\n');
});

module.exports = router;
