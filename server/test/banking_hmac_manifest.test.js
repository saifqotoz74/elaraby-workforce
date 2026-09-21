'use strict';

const assert = require('assert');
const test = require('node:test');
const HmacManifestSigner = require('../src/integrations/banking/HmacManifestSigner');

const TEST_SECRET = 'cbe-super-secret-key-for-testing-purposes-only-32b';
const ALT_SECRET = 'an-entirely-different-secret-key-for-mismatch-tests';

// Sample 200-byte fixed-width / WPS style CBE payload
const SAMPLE_PAYLOAD = [
  '01|EGY-CORP-01|EG440003000000000123456789012|2026-09|2|18000.00|EGP|20260921180000',
  '02|29001011234592|EG9900030000000001000000001|Ahmed Ghannam|8500.00|1870.00|680.00|9690.00|EGP|SALARY',
  '02|29505055443322|EG9900030000000001000000002|Mahmoud El-Sayed|7000.00|1540.00|230.00|8310.00|EGP|SALARY',
].join('\r\n') + '\r\n';

test('HMAC-01: Golden Path Manifest Generation & Verification', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
    lineCount: 2,
    totalAmount: 18000.00,
    timestamp: '2026-09-21T18:30:00.000Z',
  });

  assert.strictEqual(manifest.batchReference, 'BATCH-CIB-2026-09-001');
  assert.strictEqual(manifest.bankCode, 'cib');
  assert.strictEqual(manifest.lineCount, 2);
  assert.strictEqual(manifest.totalAmount, 18000.00);
  assert.ok(manifest.payloadHash.startsWith('sha256:'), 'Payload hash must start with sha256:');
  assert.strictEqual(manifest.payloadHash.length, 7 + 64, 'Payload hash must be 71 characters');
  assert.strictEqual(manifest.hmacSignature.length, 64, 'HMAC signature must be 64 characters');

  const verifyResult = HmacManifestSigner.verifyManifest({
    payload: SAMPLE_PAYLOAD,
    manifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(verifyResult.valid, true, 'Verification should succeed for untampered batch');
});

test('HMAC-02: Single-Character Mutation in Payload Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
    lineCount: 2,
    totalAmount: 18000.00,
  });

  const tamperedPayload = SAMPLE_PAYLOAD.replace('Ahmed Ghannam', 'Ahmee Ghannam');
  const result = HmacManifestSigner.verifyManifest({
    payload: tamperedPayload,
    manifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'PAYLOAD_HASH_MISMATCH');
});

test('HMAC-03: Whitespace Alterations (Trailing Space & LF) Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const tamperedSpace = SAMPLE_PAYLOAD + ' ';
  const resSpace = HmacManifestSigner.verifyManifest({
    payload: tamperedSpace,
    manifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(resSpace.valid, false);
  assert.strictEqual(resSpace.error, 'PAYLOAD_HASH_MISMATCH');

  const tamperedLf = SAMPLE_PAYLOAD.replace(/\r\n/g, '\n');
  const resLf = HmacManifestSigner.verifyManifest({
    payload: tamperedLf,
    manifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(resLf.valid, false);
  assert.strictEqual(resLf.error, 'PAYLOAD_HASH_MISMATCH');
});

test('HMAC-04: Amount Modification in Payload Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const tamperedAmt = SAMPLE_PAYLOAD.replace('9690.00', '9990.00');
  const result = HmacManifestSigner.verifyManifest({
    payload: tamperedAmt,
    manifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'PAYLOAD_HASH_MISMATCH');
});

test('HMAC-05: Manifest Metadata totalAmount Tampering Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const tamperedManifest = { ...manifest, totalAmount: manifest.totalAmount + 5000 };
  const result = HmacManifestSigner.verifyManifest({
    payload: SAMPLE_PAYLOAD,
    manifest: tamperedManifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'SIGNATURE_MISMATCH');
});

test('HMAC-06: Manifest Metadata batchReference Tampering Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const tamperedManifest = { ...manifest, batchReference: 'BATCH-FORGED-002' };
  const result = HmacManifestSigner.verifyManifest({
    payload: SAMPLE_PAYLOAD,
    manifest: tamperedManifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'SIGNATURE_MISMATCH');
});

test('HMAC-07: Secret Key Mismatch Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const result = HmacManifestSigner.verifyManifest({
    payload: SAMPLE_PAYLOAD,
    manifest,
    secretKey: ALT_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'SIGNATURE_MISMATCH');
});

test('HMAC-08: HMAC Signature Bit Flip Rejection', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const corruptedSig = manifest.hmacSignature.slice(0, -1) + (manifest.hmacSignature.slice(-1) === 'a' ? 'b' : 'a');
  const tamperedManifest = { ...manifest, hmacSignature: corruptedSig };
  const result = HmacManifestSigner.verifyManifest({
    payload: SAMPLE_PAYLOAD,
    manifest: tamperedManifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'SIGNATURE_MISMATCH');
});

test('HMAC-09: Truncated Signature Side-Channel Protection (Zero RangeError Crash)', () => {
  const manifest = HmacManifestSigner.createManifest({
    payload: SAMPLE_PAYLOAD,
    batchReference: 'BATCH-CIB-2026-09-001',
    bankCode: 'cib',
    secretKey: TEST_SECRET,
  });

  const truncatedManifest = { ...manifest, hmacSignature: manifest.hmacSignature.substring(0, 16) };
  const result = HmacManifestSigner.verifyManifest({
    payload: SAMPLE_PAYLOAD,
    manifest: truncatedManifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'SIGNATURE_MISMATCH');
});

test('HMAC-10: Binary Buffer Payload Support', () => {
  const bufferPayload = Buffer.from(SAMPLE_PAYLOAD, 'utf8');
  const manifest = HmacManifestSigner.createManifest({
    payload: bufferPayload,
    batchReference: 'BATCH-NBE-BUFFER-001',
    bankCode: 'nbe',
    secretKey: TEST_SECRET,
    lineCount: 2,
    totalAmount: 18000.00,
  });

  const result = HmacManifestSigner.verifyManifest({
    payload: bufferPayload,
    manifest,
    secretKey: TEST_SECRET,
  });
  assert.strictEqual(result.valid, true);
});

test('HMAC-11: Deterministic Golden Master Consistency', () => {
  const fixedPayload = '01|EGY-CORP-01|2026-09\r\n';
  const m1 = HmacManifestSigner.createManifest({
    payload: fixedPayload,
    batchReference: 'REF-FIXED',
    bankCode: 'misr',
    secretKey: 'fixed-key',
    lineCount: 1,
    totalAmount: 100.00,
    timestamp: '2026-09-21T00:00:00.000Z',
  });

  const m2 = HmacManifestSigner.createManifest({
    payload: fixedPayload,
    batchReference: 'REF-FIXED',
    bankCode: 'misr',
    secretKey: 'fixed-key',
    lineCount: 1,
    totalAmount: 100.00,
    timestamp: '2026-09-21T00:00:00.000Z',
  });

  assert.strictEqual(m1.payloadHash, m2.payloadHash);
  assert.strictEqual(m1.hmacSignature, m2.hmacSignature);
});
