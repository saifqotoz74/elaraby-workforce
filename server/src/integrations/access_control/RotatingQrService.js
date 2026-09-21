'use strict';

/**
 * Offline Rotating QR Gate-Pass Service
 *
 * Implements a time-decaying 30-second TOTP/HMAC-SHA256 sliding window
 * with ±1 step drift tolerance (90s window), multi-tenant cryptographic key isolation,
 * and 120-second TTL anti-replay protection.
 */

const crypto = require('crypto');

const MASTER_QR_SECRET = process.env.ACCESS_CONTROL_QR_SECRET ||
  process.env.QR_HMAC_SECRET ||
  'workforce-iot-turnstile-master-salt-2026';

class RotatingQrService {
  static MASTER_SECRET = MASTER_QR_SECRET;
  // Map of replayKey -> expiryTimestamp (TTL = 120s)
  static replayCache = new Map();

  /**
   * Generates a dynamic rotating QR gate-pass token.
   * Format: `v1:<tenantId>:<employeeId>:<epochStep>:<nonce>:<hmacDigest>`
   *
   * @param {Object} params
   * @param {string} [params.tenantId='elaraby']
   * @param {string} params.employeeId
   * @param {number} [params.timestamp] - Milliseconds epoch (defaults to Date.now())
   * @param {string} [params.nonce] - Random hex salt
   * @param {string} [params.secretKey] - Master secret
   * @returns {string} Encoded gate-pass token
   */
  static generateGatePassToken({
    tenantId = 'elaraby',
    employeeId,
    timestamp = Date.now(),
    nonce = crypto.randomBytes(2).toString('hex'),
    secretKey = RotatingQrService.MASTER_SECRET,
  } = {}) {
    if (!employeeId) {
      throw new Error('employeeId is required to generate gate pass token');
    }

    const epochStep = Math.floor(timestamp / 30000);
    const tenantSecret = crypto.createHmac('sha256', secretKey).update(tenantId.toLowerCase()).digest();
    const payloadToSign = `v1:${tenantId}:${employeeId}:${epochStep}:${nonce}`;
    const hmacDigest = crypto.createHmac('sha256', tenantSecret).update(payloadToSign).digest('hex').slice(0, 16);

    return `v1:${tenantId}:${employeeId}:${epochStep}:${nonce}:${hmacDigest}`;
  }

  /**
   * Verifies an offline rotating QR gate-pass token.
   *
   * @param {Object} params
   * @param {string} params.token - Scanned QR token string
   * @param {string} [params.expectedEmployeeId] - Expected employee badge/ID
   * @param {string} [params.tenantId] - Enforced gate tenant
   * @param {string} [params.secretKey] - Master secret
   * @returns {Object} `{ valid: boolean, employeeId?: string, tenantId?: string, reason?: string }`
   */
  static verifyGatePassToken({
    token,
    expectedEmployeeId,
    tenantId,
    secretKey = RotatingQrService.MASTER_SECRET,
  } = {}) {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'EMPTY_OR_INVALID_FORMAT', error: 'EMPTY_QR_DATA' };
    }

    const parts = token.trim().split(':');
    if (parts.length !== 6 || parts[0] !== 'v1') {
      return { valid: false, reason: 'MALFORMED_TOKEN_STRUCTURE', error: 'INVALID_QR_STRUCTURE' };
    }

    const [, tokenTenant, tokenEmpId, stepStr, nonce, receivedHmac] = parts;

    // 1. Multi-Tenant Isolation Check
    if (tenantId && tokenTenant.toLowerCase() !== tenantId.toLowerCase()) {
      return { valid: false, reason: 'TENANT_MISMATCH' };
    }

    // 2. Expected Employee Match
    if (expectedEmployeeId && tokenEmpId !== expectedEmployeeId) {
      return { valid: false, reason: 'EMPLOYEE_MISMATCH' };
    }

    // 3. Sliding Time Window Check (30-second step, tolerance ±1 step = 90s total window)
    const tokenStep = parseInt(stepStr, 10);
    if (isNaN(tokenStep)) {
      return { valid: false, reason: 'INVALID_TIMESTAMP_STEP' };
    }

    const currentStep = Math.floor(Date.now() / 30000);
    if (Math.abs(currentStep - tokenStep) > 1) {
      return { valid: false, reason: 'TOKEN_EXPIRED_OR_CLOCK_DRIFT', error: 'QR_CODE_EXPIRED' };
    }

    // 4. Cryptographic Signature Validation (Authenticity checked before stateful cache)
    const tenantSecret = crypto.createHmac('sha256', secretKey).update(tokenTenant.toLowerCase()).digest();
    const payloadToSign = `v1:${tokenTenant}:${tokenEmpId}:${tokenStep}:${nonce}`;
    const expectedHmac = crypto.createHmac('sha256', tenantSecret).update(payloadToSign).digest('hex').slice(0, 16);

    let isSigValid = false;
    try {
      const bufRecv = Buffer.from(receivedHmac, 'hex');
      const bufExp = Buffer.from(expectedHmac, 'hex');
      if (bufRecv.length === bufExp.length && crypto.timingSafeEqual(bufRecv, bufExp)) {
        isSigValid = true;
      }
    } catch (_) {
      isSigValid = false;
    }

    if (!isSigValid) {
      return { valid: false, reason: 'SIGNATURE_INVALID', error: 'INVALID_SIGNATURE' };
    }

    // 5. Anti-Replay Verification (TTL = 120s)
    RotatingQrService._pruneReplayCache();
    const replayKey = `${tokenTenant.toLowerCase()}:${tokenEmpId}:${tokenStep}:${nonce}`;
    if (RotatingQrService.replayCache.has(replayKey)) {
      return { valid: false, reason: 'REPLAY_ATTACK_DETECTED' };
    }

    // 6. Register in Anti-Replay Cache (TTL = 120 seconds)
    RotatingQrService.replayCache.set(replayKey, Date.now() + 120000);

    return {
      valid: true,
      tenantId: tokenTenant,
      employeeId: tokenEmpId,
      step: tokenStep,
      verifiedAt: Date.now(),
      timestamp: tokenStep * 30000,
    };
  }

  /**
   * Prunes expired replay cache entries.
   */
  static _pruneReplayCache() {
    const now = Date.now();
    for (const [k, expiry] of RotatingQrService.replayCache.entries()) {
      if (expiry < now) {
        RotatingQrService.replayCache.delete(k);
      }
    }
  }

  /**
   * Clears the anti-replay cache (for tests).
   */
  static clearReplayCache() {
    RotatingQrService.replayCache.clear();
  }
}

// Backward-compatible function exports
function generateRotatingQrGatePass(employeeId, tenantId = 'elaraby') {
  return RotatingQrService.generateGatePassToken({ employeeId, tenantId });
}

function verifyRotatingQrGatePass(qrData, expectedEmployeeId = null) {
  return RotatingQrService.verifyGatePassToken({ token: qrData, expectedEmployeeId });
}

module.exports = {
  RotatingQrService,
  MASTER_QR_SECRET,
  generateRotatingQrGatePass,
  verifyRotatingQrGatePass,
};
