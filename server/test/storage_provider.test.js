// Comprehensive Storage Provider & Object Storage Unit & Integration Tests
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const LocalStorageProvider = require('../src/services/storage/LocalStorageProvider');
const S3StorageProvider = require('../src/services/storage/S3StorageProvider');
const storage = require('../src/services/storage');
const uploadService = require('../src/services/uploadService');

async function runTests() {
  console.log('=============================================================');
  console.log('--- STORAGE PROVIDER & OBJECT STORAGE TEST SUITE ---');
  console.log('=============================================================\n');

  const testDir = path.join(__dirname, 'tmp_storage_test');
  await fs.promises.mkdir(testDir, { recursive: true });

  try {
    // 1. LocalStorageProvider Core Tests
    console.log('--- 1. LocalStorageProvider Core Operations ---');
    const local = new LocalStorageProvider({ baseDir: testDir });
    assert.strictEqual(local.isConfigured(), true);

    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const saved = await local.saveFile({
      buffer: pngHeader,
      originalName: 'test_badge.png',
      mimeType: 'image/png',
      isPrivate: false,
    });

    assert.ok(saved.key, 'Key must be generated');
    assert.strictEqual(saved.provider, 'local');
    assert.strictEqual(saved.size, pngHeader.length);

    // Retrieve file
    const retrieved = await local.getFile(saved.key);
    assert.strictEqual(retrieved.contentType, 'image/png');
    assert.strictEqual(retrieved.contentLength, pngHeader.length);
    assert.deepStrictEqual(retrieved.buffer, pngHeader);

    // Health check
    const health = await local.checkHealth();
    assert.strictEqual(health.ok, true);
    assert.strictEqual(health.status, 'healthy');

    // Delete file
    const deleted = await local.deleteFile(saved.key);
    assert.strictEqual(deleted, true);

    // Verify 404 after delete
    try {
      await local.getFile(saved.key);
      assert.fail('Should have thrown 404');
    } catch (err) {
      assert.strictEqual(err.message, 'file_not_found');
    }
    console.log('✔ LocalStorageProvider save, get, delete, and health passed.');

    // 2. Path Traversal Security Gate
    console.log('\n--- 2. Path Traversal Security Gate ---');
    try {
      await local.getFile('../../../secret.txt');
      assert.fail('Should have blocked path traversal');
    } catch (err) {
      assert.ok(err.message.includes('path_traversal') || err.message.includes('not_found'));
      console.log('✔ Directory traversal attack strictly blocked.');
    }

    // 3. S3StorageProvider SigV4 & Configuration Safety
    console.log('\n--- 3. S3StorageProvider SigV4 & Configuration Safety ---');
    const unconfiguredS3 = new S3StorageProvider({
      accessKeyId: '',
      secretAccessKey: '',
    });
    assert.strictEqual(unconfiguredS3.isConfigured(), false);
    const unconfiguredHealth = await unconfiguredS3.checkHealth();
    assert.strictEqual(unconfiguredHealth.ok, false);
    assert.strictEqual(unconfiguredHealth.status, 'not_configured');

    try {
      await unconfiguredS3.saveFile({ buffer: pngHeader, originalName: 'doc.png' });
      assert.fail('Unconfigured S3 must fail safe');
    } catch (err) {
      assert.ok(err.message.includes('S3 credentials not configured'));
    }
    console.log('✔ Unconfigured S3 provider safely detects missing credentials without crashing.');

    // SigV4 Request Construction Verification
    const configuredS3 = new S3StorageProvider({
      endpoint: 'https://s3.me-south-1.amazonaws.com',
      region: 'me-south-1',
      bucket: 'elaraby-test-bucket',
      accessKeyId: 'AKIA_TEST_KEY',
      secretAccessKey: 'SECRET_TEST_KEY_VALUE_FOR_SIGV4',
      forcePathStyle: false,
    });
    assert.strictEqual(configuredS3.isConfigured(), true);

    const reqDetails = configuredS3._buildRequestDetails('PUT', 'uploads/2026/09/sample.png', {}, pngHeader, {
      'content-type': 'image/png',
      'content-length': String(pngHeader.length),
    });

    assert.strictEqual(reqDetails.options.method, 'PUT');
    assert.ok(reqDetails.options.headers['Authorization'].startsWith('AWS4-HMAC-SHA256 Credential=AKIA_TEST_KEY/'));
    assert.ok(reqDetails.options.headers['x-amz-date']);
    assert.ok(reqDetails.options.headers['x-amz-content-sha256']);
    console.log('✔ S3 SigV4 request signer generates standard RFC/AWS compliant authorization headers.');

    // 4. UploadService Integration with Storage
    console.log('\n--- 4. UploadService Integration ---');
    const uploadResult = await uploadService.saveImageBuffer(pngHeader, 'profile.png');
    assert.ok(uploadResult.url);
    assert.strictEqual(uploadResult.size, pngHeader.length);

    // Reject fake image
    try {
      await uploadService.saveImageBuffer(Buffer.from('not an image at all'), 'fake.png');
      assert.fail('Invalid image data must be rejected');
    } catch (err) {
      assert.strictEqual(err.message, 'invalid_image_data');
    }

    // Reject empty buffer
    try {
      await uploadService.saveImageBuffer(Buffer.alloc(0), 'empty.png');
      assert.fail('Empty buffer must be rejected');
    } catch (err) {
      assert.strictEqual(err.message, 'empty_file');
    }

    // Reject > 6MB
    try {
      const hugeBuffer = Buffer.alloc(7 * 1024 * 1024);
      await uploadService.saveImageBuffer(hugeBuffer, 'huge.png');
      assert.fail('Oversized buffer must be rejected');
    } catch (err) {
      assert.strictEqual(err.message, 'max_6mb');
    }
    console.log('✔ UploadService image validation, size checks, and storage integration verified.');

    console.log('\n=============================================================');
    console.log('ALL STORAGE PROVIDER TESTS PASSED (0 FAILURES)');
    console.log('=============================================================\n');
  } finally {
    // Cleanup test files
    try {
      const files = await fs.promises.readdir(testDir);
      for (const f of files) {
        await fs.promises.unlink(path.join(testDir, f));
      }
      await fs.promises.rmdir(testDir);
    } catch (_) {}
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Storage tests failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
