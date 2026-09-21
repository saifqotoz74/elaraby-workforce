'use strict';

const crypto = require('crypto');

/**
 * Default fallback secret for non-production environments
 */
const DEFAULT_SECRET = process.env.BANKING_HMAC_SECRET || 'workforce-cbe-secure-key-2026';

/**
 * HmacManifestSigner
 * Cryptographic batch signing and verification for Central Bank of Egypt (CBE) and ACH disbursement files.
 * Generates canonical SHA-256 payload hashes, pipe-delimited canonical manifest strings, HMAC-SHA256 digital
 * signatures, and performs constant-time timing-safe verification.
 */
class HmacManifestSigner {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.secretKey] - Secret key for HMAC signing/verification
   * @param {string} [options.tenantId='elaraby'] - Active tenant ID
   */
  constructor(options = {}) {
    this.secretKey = options.secretKey || DEFAULT_SECRET;
    this.tenantId = options.tenantId || 'elaraby';
  }

  /**
   * Computes SHA-256 hash of batch file payload with 'sha256:' prefix.
   * @param {string|Buffer} payload - Raw batch file content
   * @returns {string} Formatted hash string, e.g. 'sha256:abcd...'
   */
  static computePayloadHash(payload) {
    if (payload === null || payload === undefined) {
      throw new Error('MISSING_PAYLOAD: Batch payload cannot be null or undefined.');
    }
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'utf8');
    const digest = crypto.createHash('sha256').update(buffer).digest('hex');
    return `sha256:${digest}`;
  }

  /**
   * Builds the deterministic canonical string for HMAC signing.
   * Format: batchReference|bankCode|timestamp|lineCount|totalAmount|payloadHash
   * 
   * @param {Object} params
   * @param {string} params.batchReference
   * @param {string} params.bankCode
   * @param {string} params.timestamp
   * @param {number|string} params.lineCount
   * @param {number|string} params.totalAmount
   * @param {string} params.payloadHash
   * @returns {string} Canonical pipe-delimited string
   */
  static buildCanonicalString(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('INVALID_PARAMS: Parameters object is required to build canonical string.');
    }

    const {
      batchReference,
      bankCode,
      timestamp,
      lineCount,
      totalAmount,
      payloadHash,
    } = params;

    if (!batchReference) throw new Error('MISSING_FIELD: batchReference is required.');
    if (!bankCode) throw new Error('MISSING_FIELD: bankCode is required.');
    if (!timestamp) throw new Error('MISSING_FIELD: timestamp is required.');
    if (lineCount === undefined || lineCount === null) throw new Error('MISSING_FIELD: lineCount is required.');
    if (totalAmount === undefined || totalAmount === null) throw new Error('MISSING_FIELD: totalAmount is required.');
    if (!payloadHash) throw new Error('MISSING_FIELD: payloadHash is required.');

    const normBatchRef = String(batchReference).trim();
    const normBankCode = String(bankCode).trim().toLowerCase();
    const normTimestamp = String(timestamp).trim();
    if (typeof lineCount !== 'number' && typeof lineCount !== 'string') {
      throw new Error('Invalid lineCount: must be a non-negative integer');
    }
    if (typeof lineCount === 'string' && !/^\d+$/.test(lineCount.trim())) {
      throw new Error('Invalid lineCount: must be a non-negative integer');
    }
    const countNum = Number(lineCount);
    if (!Number.isInteger(countNum) || countNum < 0) {
      throw new Error('Invalid lineCount: must be a non-negative integer');
    }
    const normLineCount = String(countNum);
    const normTotalAmount = Number(totalAmount).toFixed(2);
    const normPayloadHash = String(payloadHash).trim().toLowerCase();

    return [
      normBatchRef,
      normBankCode,
      normTimestamp,
      normLineCount,
      normTotalAmount,
      normPayloadHash,
    ].join('|');
  }

  /**
   * Generates HMAC-SHA256 signature over a canonical string.
   * @param {string} canonicalString
   * @param {string} secretKey
   * @returns {string} 64-character lowercase hex signature
   */
  static signCanonicalString(canonicalString, secretKey) {
    const key = secretKey || DEFAULT_SECRET;
    if (!key) throw new Error('MISSING_SECRET_KEY: Secret key cannot be empty.');
    return crypto.createHmac('sha256', key).update(canonicalString, 'utf8').digest('hex');
  }

  /**
   * Signs a batch file and generates an immutable manifest object.
   * 
   * @param {Object} params
   * @param {string|Buffer} params.payload - Batch file content
   * @param {string} params.batchReference - Unique batch reference
   * @param {string} params.bankCode - CBE bank code ('cib', 'nbe', etc.)
   * @param {string} [params.secretKey] - Tenant or bank secret key
   * @param {number} [params.lineCount] - Number of detail lines (auto-calculated if omitted)
   * @param {number} [params.totalAmount=0.00] - Total net salary
   * @param {string} [params.timestamp] - ISO timestamp (defaults to Date.now())
   * @param {string} [params.tenantId='elaraby'] - Tenant ID
   * @param {string} [params.currency='EGP'] - Currency
   * @returns {Object} Manifest object
   */
  static createManifest(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('INVALID_PARAMS: Options object required.');
    }

    const {
      payload,
      batchReference,
      bankCode,
      secretKey = DEFAULT_SECRET,
      lineCount,
      totalAmount = 0,
      timestamp = new Date().toISOString(),
      tenantId = 'elaraby',
      currency = 'EGP',
    } = params;

    if (!payload && payload !== '') {
      throw new Error('MISSING_PAYLOAD: Batch payload is required to create manifest.');
    }
    if (!batchReference) throw new Error('MISSING_FIELD: batchReference is required.');
    if (!bankCode) throw new Error('MISSING_FIELD: bankCode is required.');

    // Auto-calculate line count from payload if not passed explicitly
    let resolvedLineCount = lineCount;
    if (resolvedLineCount === undefined || resolvedLineCount === null) {
      const payloadStr = typeof payload === 'string' ? payload : payload.toString('utf8');
      const lines = payloadStr.split(/\r?\n/).filter((l) => l.trim().length > 0);
      resolvedLineCount = lines.length;
    }

    const payloadHash = HmacManifestSigner.computePayloadHash(payload);

    const canonicalString = HmacManifestSigner.buildCanonicalString({
      batchReference,
      bankCode,
      timestamp,
      lineCount: resolvedLineCount,
      totalAmount: Number(totalAmount) || 0,
      payloadHash,
    });

    const hmacSignature = HmacManifestSigner.signCanonicalString(canonicalString, secretKey);

    return {
      batchReference: String(batchReference).trim(),
      bankCode: String(bankCode).trim().toLowerCase(),
      timestamp: String(timestamp).trim(),
      lineCount: parseInt(resolvedLineCount, 10),
      totalAmount: Number(Number(totalAmount).toFixed(2)),
      payloadHash,
      hmacSignature,
      signature: hmacSignature,
      tenantId,
      currency,
      algorithm: 'HMAC-SHA256',
    };
  }

  /**
   * Verifies the authenticity and integrity of a batch payload against its manifest.
   * Performs constant-time timing-safe comparison.
   * 
   * @param {Object} params
   * @param {string|Buffer} params.payload - The received batch payload
   * @param {Object} params.manifest - The cryptographic manifest
   * @param {string} [params.secretKey] - The verification secret key
   * @returns {{ valid: boolean, error?: string, details?: string }}
   */
  static verifyManifest(params) {
    if (!params || typeof params !== 'object') {
      return { valid: false, error: 'INVALID_PARAMS', details: 'Parameters object is required.' };
    }

    const { payload, manifest, secretKey = DEFAULT_SECRET } = params;

    if (payload === undefined || payload === null) {
      return { valid: false, error: 'MISSING_PAYLOAD', details: 'Batch payload is required.' };
    }
    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, error: 'MISSING_MANIFEST', details: 'Manifest object is required.' };
    }
    if (!secretKey) {
      return { valid: false, error: 'MISSING_SECRET_KEY', details: 'Secret key is required.' };
    }

    const {
      batchReference,
      bankCode,
      timestamp,
      lineCount,
      totalAmount,
      payloadHash,
      hmacSignature,
    } = manifest;

    if (!batchReference || !bankCode || !timestamp || lineCount === undefined || totalAmount === undefined || !payloadHash || !hmacSignature) {
      return { valid: false, error: 'INVALID_MANIFEST_STRUCTURE', details: 'Manifest is missing required fields.' };
    }

    // Step 1: Check payload hash integrity
    let computedPayloadHash;
    try {
      computedPayloadHash = HmacManifestSigner.computePayloadHash(payload);
    } catch (err) {
      return { valid: false, error: 'PAYLOAD_HASH_MISMATCH', details: err.message };
    }

    if (computedPayloadHash.toLowerCase() !== String(payloadHash).trim().toLowerCase()) {
      return {
        valid: false,
        error: 'PAYLOAD_HASH_MISMATCH',
        details: `Calculated hash ${computedPayloadHash} did not match manifest hash ${payloadHash}`,
      };
    }

    // Step 2: Rebuild canonical string from manifest metadata
    let canonicalString;
    try {
      canonicalString = HmacManifestSigner.buildCanonicalString({
        batchReference,
        bankCode,
        timestamp,
        lineCount,
        totalAmount,
        payloadHash: computedPayloadHash,
      });
    } catch (err) {
      return { valid: false, error: 'INVALID_MANIFEST_STRUCTURE', details: err.message };
    }

    // Step 3: Compute expected HMAC
    const expectedSignature = HmacManifestSigner.signCanonicalString(canonicalString, secretKey);

    // Step 4: Constant-time timing-safe comparison
    if (typeof hmacSignature !== 'string') {
      return { valid: false, error: 'SIGNATURE_MISMATCH', details: 'hmacSignature must be a string.' };
    }

    const receivedBuf = Buffer.from(String(hmacSignature).trim(), 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    // Prevent RangeError in timingSafeEqual when buffer lengths differ
    if (receivedBuf.length !== expectedBuf.length || receivedBuf.length === 0) {
      return {
        valid: false,
        error: 'SIGNATURE_MISMATCH',
        details: 'HMAC signature length or format does not match expected digest.',
      };
    }

    const isMatch = crypto.timingSafeEqual(receivedBuf, expectedBuf);
    if (!isMatch) {
      return {
        valid: false,
        error: 'SIGNATURE_MISMATCH',
        details: 'HMAC signature verification failed. Manifest has been altered or secret key is invalid.',
      };
    }

    return { valid: true };
  }

  // Instance method delegates for dependency-injected usage
  createManifest(params) {
    return HmacManifestSigner.createManifest({
      ...params,
      secretKey: params?.secretKey || this.secretKey,
      tenantId: params?.tenantId || this.tenantId,
    });
  }

  verifyManifest(params) {
    return HmacManifestSigner.verifyManifest({
      ...params,
      secretKey: params?.secretKey || this.secretKey,
    });
  }
}

module.exports = HmacManifestSigner;
