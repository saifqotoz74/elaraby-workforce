'use strict';

const crypto = require('crypto');
const { alertService } = require('../../services/alertService');

// Seed default industrial access control devices
const DEFAULT_DEVICES = [
  {
    id: 'DEV_QSN_GATE_1',
    tenantId: 'elaraby',
    name: 'مجمع قويسنا - بوابة 1 رئيسية (دخول)',
    factory: 'مجمع مصانع قويسنا',
    ipAddress: '192.168.10.51',
    port: 4370,
    protocol: 'zkteco_tcp',
    direction: 'IN',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 12,
    rollingLatencyEma: 14.5,
    consecutiveFailures: 0,
  },
  {
    id: 'DEV_QSN_GATE_2',
    tenantId: 'elaraby',
    name: 'مجمع قويسنا - بوابة 2 خروج',
    factory: 'مجمع مصانع قويسنا',
    ipAddress: '192.168.10.52',
    port: 4370,
    protocol: 'zkteco_tcp',
    direction: 'OUT',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 15,
    rollingLatencyEma: 16.0,
    consecutiveFailures: 0,
  },
  {
    id: 'DEV_BNH_GATE_1',
    tenantId: 'elaraby',
    name: 'مصنع بنها - بوابة الدخول الذكية MinMoe',
    factory: 'مصنع بنها للإلكترونيات',
    ipAddress: '192.168.20.101',
    port: 80,
    protocol: 'hikvision_isapi',
    direction: 'IN',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 8,
    rollingLatencyEma: 9.2,
    consecutiveFailures: 0,
  },
  {
    id: 'DEV_10R_GATE_1',
    tenantId: 'elsewedy',
    name: 'العاشر من رمضان - بوابة خط الكابلات',
    factory: 'مجمع مصانع العاشر من رمضان',
    ipAddress: '192.168.30.12',
    port: 4370,
    protocol: 'zkteco_tcp',
    direction: 'IN',
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    latencyMs: 18,
    rollingLatencyEma: 20.1,
    consecutiveFailures: 0,
  },
];

const _devices = [...DEFAULT_DEVICES];
const _emergencyStates = new Map(); // tenantId -> { action, activatedAt, activatedBy, status }
const _seenNonces = new Set();

const QR_SECRET = process.env.QR_HMAC_SECRET || 'workforce_qr_rotating_secret_key_v1';

/**
 * Returns registered devices, optionally filtered by tenant.
 */
function getDevices(tenantId = null) {
  if (!tenantId) return [..._devices];
  return _devices.filter((d) => d.tenantId === tenantId);
}

/**
 * Finds a device by its ID.
 */
function getDeviceById(id) {
  return _devices.find((d) => d.id === id) || null;
}

/**
 * Updates a device's heartbeat and rolling latency.
 */
function recordHeartbeat(id, latencyMs, isSuccess = true) {
  const dev = _devices.find((d) => d.id === id);
  if (!dev) return null;

  dev.lastHeartbeat = new Date().toISOString();
  if (isSuccess) {
    dev.consecutiveFailures = 0;
    dev.latencyMs = Number(latencyMs);
    dev.rollingLatencyEma = Math.round((0.2 * dev.latencyMs + 0.8 * (dev.rollingLatencyEma || dev.latencyMs)) * 10) / 10;
    dev.status = dev.latencyMs > 400 ? 'DEGRADED' : 'ONLINE';
  } else {
    dev.consecutiveFailures = (dev.consecutiveFailures || 0) + 1;
    if (dev.consecutiveFailures >= 3) {
      dev.status = 'OFFLINE';
    } else {
      dev.status = 'DEGRADED';
    }
  }

  return { ...dev };
}

/**
 * High-Performance Emergency Gate Override (<50ms SLA)
 * Instantly transitions all gates for a tenant/factory into an emergency state.
 */
function emergencyOverride({
  tenantId = 'elaraby',
  factory = 'all',
  action = 'UNLOCK_ALL', // 'UNLOCK_ALL' | 'LOCKDOWN_ALL' | 'RESTORE'
  adminId = 'admin_sys',
}) {
  const startTime = Date.now();
  const allowedActions = ['UNLOCK_ALL', 'LOCKDOWN_ALL', 'RESTORE'];
  if (!allowedActions.includes(action)) {
    throw new Error(`Invalid emergency action '${action}'. Allowed: ${allowedActions.join(', ')}`);
  }

  // 1. In-memory atomic state mutation (<1ms)
  const emergencyRecord = {
    tenantId,
    factory,
    action,
    activatedAt: new Date().toISOString(),
    activatedBy: adminId,
    status: action === 'RESTORE' ? 'NORMAL' : (action === 'UNLOCK_ALL' ? 'EMERGENCY_UNLOCKED' : 'EMERGENCY_LOCKDOWN'),
  };
  _emergencyStates.set(tenantId, emergencyRecord);

  // 2. Filter affected devices
  const affectedDevices = _devices.filter((d) => {
    if (d.tenantId !== tenantId) return false;
    if (factory !== 'all' && d.factory !== factory) return false;
    return true;
  });

  // 3. Mark devices in memory
  for (const dev of affectedDevices) {
    dev.gateMode = emergencyRecord.status;
  }

  const executionLatencyMs = Date.now() - startTime;

  return {
    ok: true,
    action,
    status: emergencyRecord.status,
    tenantId,
    factory,
    affectedDeviceCount: affectedDevices.length,
    affectedDeviceIds: affectedDevices.map((d) => d.id),
    executionLatencyMs,
    slaCompliant: executionLatencyMs < 50,
    timestamp: emergencyRecord.activatedAt,
  };
}

/**
 * Returns the current emergency state for a tenant.
 */
function getEmergencyState(tenantId = 'elaraby') {
  return _emergencyStates.get(tenantId) || {
    tenantId,
    status: 'NORMAL',
    action: 'RESTORE',
    activatedAt: null,
    activatedBy: null,
  };
}

/**
 * Verifies rotating QR gate-pass token.
 * Format: `v1:<tenantId>:<employeeId>:<timeMinutes>:<nonce>:<hmac>`
 */
function verifyRotatingQrGatePass(qrData, expectedEmployeeId = null) {
  try {
    if (!qrData || typeof qrData !== 'string') {
      return { valid: false, reason: 'EMPTY_QR_DATA' };
    }

    const parts = qrData.trim().split(':');
    if (parts.length < 6) {
      return { valid: false, reason: 'INVALID_QR_STRUCTURE' };
    }

    const [ver, tenantId, employeeId, timeMinutesStr, nonce, receivedHmac] = parts;
    if (ver !== 'v1') {
      return { valid: false, reason: 'UNSUPPORTED_VERSION' };
    }

    if (expectedEmployeeId && employeeId !== expectedEmployeeId) {
      return { valid: false, reason: 'EMPLOYEE_MISMATCH' };
    }

    // 1. Sliding Window Timestamp Verification (valid for 5 minutes)
    const timeMinutes = parseInt(timeMinutesStr, 10);
    const currentMinutes = Math.floor(Date.now() / 60000);
    if (Math.abs(currentMinutes - timeMinutes) > 5) {
      return { valid: false, reason: 'QR_CODE_EXPIRED' };
    }

    // 2. Cryptographic HMAC Check (Verify signature before stateful replay check)
    const payload = `${ver}:${tenantId}:${employeeId}:${timeMinutesStr}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').substring(0, 16);

    const bufReceived = Buffer.from(receivedHmac);
    const bufExpected = Buffer.from(expectedHmac);
    if (bufReceived.length !== bufExpected.length || !crypto.timingSafeEqual(bufReceived, bufExpected)) {
      return { valid: false, reason: 'SIGNATURE_INVALID' };
    }

    // 3. Anti-Replay Nonce Check
    const nonceKey = `${tenantId}:${employeeId}:${nonce}`;
    if (_seenNonces.has(nonceKey)) {
      return { valid: false, reason: 'REPLAY_ATTACK_DETECTED' };
    }

    // Record nonce to prevent replay
    _seenNonces.add(nonceKey);
    if (_seenNonces.size > 10000) {
      _seenNonces.clear();
    }

    return {
      valid: true,
      tenantId,
      employeeId,
      timestamp: timeMinutes * 60000,
    };
  } catch (err) {
    return { valid: false, reason: 'DECODE_ERROR', error: err.message };
  }
}

/**
 * Helper to generate a rotating QR gate-pass token.
 */
function generateRotatingQrGatePass(employeeId, tenantId = 'elaraby') {
  const ver = 'v1';
  const timeMinutes = Math.floor(Date.now() / 60000);
  const nonce = crypto.randomBytes(2).toString('hex');
  const payload = `${ver}:${tenantId}:${employeeId}:${timeMinutes}:${nonce}`;
  const hmac = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').substring(0, 16);
  return `${payload}:${hmac}`;
}

module.exports = {
  getDevices,
  getDeviceById,
  recordHeartbeat,
  emergencyOverride,
  getEmergencyState,
  verifyRotatingQrGatePass,
  generateRotatingQrGatePass,
};
