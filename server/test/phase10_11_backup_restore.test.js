// Phase 10 & 11: Database Backup, Verification & Restore Test Suite
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createBackup } = require('../scripts/backup-database');
const { verifyAndRestore } = require('../scripts/restore-database');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 10 & 11: BACKUP & DISASTER RECOVERY TESTS ---');
  console.log('=============================================================');

  // Test 1: Create Real Backup & Manifest
  console.log('\n--- 1. Automated Backup Creation & SHA-256 Manifest ---');
  const backupRes = await createBackup();
  assert.ok(fs.existsSync(backupRes.backupFile), 'Backup JSON file must exist on disk');
  assert.ok(fs.existsSync(backupRes.manifestFile), 'Manifest file must exist on disk');

  const manifest = JSON.parse(fs.readFileSync(backupRes.manifestFile, 'utf8'));
  assert.ok(manifest.sha256, 'Manifest must contain sha256 checksum');
  assert.ok(manifest.recordCounts, 'Manifest must record table counts');
  assert.ok(manifest.sizeBytes > 100, 'Backup size must be > 100 bytes');
  console.log(`✔ Backup created: ${path.basename(backupRes.backupFile)} (${manifest.sizeBytes} bytes, SHA256: ${manifest.sha256.slice(0, 16)}...).`);

  // Test 2: Integrity Verification against Manifest
  console.log('\n--- 2. Pre-Restoration Checksum & Archive Verification ---');
  const verifyRes = await verifyAndRestore(backupRes.backupFile, true);
  assert.strictEqual(verifyRes.ok, true, 'Verification of valid backup must succeed');
  assert.strictEqual(verifyRes.verified, true, 'Verified flag must be true');
  assert.strictEqual(verifyRes.actualHash, manifest.sha256, 'Actual hash must match manifest');
  console.log('✔ Backup archive verified intact against cryptographic manifest.');

  // Test 3: Rejection of Tampered / Corrupted Archive
  console.log('\n--- 3. Rejection of Tampered Archive (Security Gate) ---');
  const tempTamperedPath = backupRes.backupFile.replace('.json', '.tampered.json');
  const originalContent = fs.readFileSync(backupRes.backupFile, 'utf8');
  // Alter 1 character
  const tamperedContent = originalContent.replace('{', '{ "tampered": true, ');
  fs.writeFileSync(tempTamperedPath, tamperedContent);

  // Copy original manifest to tampered manifest path
  const tamperedManifestPath = tempTamperedPath.replace('.json', '.manifest.json');
  fs.copyFileSync(backupRes.manifestFile, tamperedManifestPath);

  let errorCaught = false;
  try {
    await verifyAndRestore(tempTamperedPath, true);
  } catch (err) {
    errorCaught = true;
    assert.ok(err.message.includes('Checksum mismatch'), 'Must abort with Checksum mismatch error');
  }
  assert.strictEqual(errorCaught, true, 'Corrupted / tampered backup MUST be rejected');

  // Clean up tampered test files
  try {
    fs.unlinkSync(tempTamperedPath);
    fs.unlinkSync(tamperedManifestPath);
  } catch (_) {}
  console.log('✔ Tampered backup was strictly rejected by cryptographic verification gate.');

  console.log('\n=============================================================');
  console.log('ALL PHASE 10 & 11 BACKUP & RESTORE TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 10 & 11 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
