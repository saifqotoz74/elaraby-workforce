// Phase 5: FCM Push Notification & Provider Abstraction Tests
const assert = require('assert');
const push = require('../src/integrations/push');
const MockPushProvider = require('../src/integrations/push/MockPushProvider');
const FirebasePushProvider = require('../src/integrations/push/FirebasePushProvider');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 5: PUSH NOTIFICATION PROVIDER TEST SUITE ---');
  console.log('=============================================================');

  // Test 1: Mock Push Delivery
  console.log('\n--- 1. Mock Push Delivery & Message Receipt ---');
  const mock = new MockPushProvider();
  mock.clear();

  const sendRes = await mock.sendToToken(
    'valid_device_token_abc',
    'إشعار إداري جديد',
    'تمت الموافقة على طلب الإجازة بنجاح',
    { route: '/requests' }
  );
  assert.strictEqual(sendRes.success, true, 'Mock send must succeed');
  assert.ok(sendRes.messageId, 'Must return generated messageId');
  assert.strictEqual(mock.sentNotifications.length, 1, 'Sent notifications count must be 1');
  assert.strictEqual(mock.sentNotifications[0].data.route, '/requests', 'Custom data must be preserved');
  console.log('✔ Mock push provider successfully recorded targeted push notification.');

  // Test 2: Invalid / Revoked Token Detection
  console.log('\n--- 2. Invalid Token Detection & Lifecycle Handling ---');
  const invalidRes = await mock.sendToToken(
    'invalid_token_test',
    'عنوان',
    'محتوى'
  );
  assert.strictEqual(invalidRes.success, false, 'Invalid token must fail');
  assert.strictEqual(invalidRes.isInvalidToken, true, 'Must flag isInvalidToken: true for database pruning');
  console.log('✔ Revoked / invalid token properly flagged for pruning from database.');

  // Test 3: Multicast Batch Push
  console.log('\n--- 3. Multicast Batch Push Delivery ---');
  const tokens = ['token_1', 'token_2', 'token_3'];
  const multiRes = await mock.sendMulticast(tokens, 'تنبيه جماعي', 'صيانة مجدولة لنظام الرواتب');
  assert.strictEqual(multiRes.length, 3, 'Must return 3 delivery results');
  assert.ok(multiRes.every((r) => r.success), 'All valid tokens must succeed in multicast');
  console.log('✔ Multicast push delivery verified across multiple device tokens.');

  // Test 4: Real Firebase Provider Configuration Safety
  console.log('\n--- 4. Firebase Production Provider Configuration Safety ---');
  const fcm = new FirebasePushProvider();
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !fcm.isConfigured()) {
    const unconfiguredRes = await fcm.sendToToken('token_xyz', 'Title', 'Body');
    assert.strictEqual(unconfiguredRes.success, false, 'Unconfigured FCM must fail cleanly');
    assert.ok(unconfiguredRes.error.includes('not_configured'), 'Error must report unconfigured');
  }
  console.log('✔ Firebase push provider safely verifies credentials before attempting network dispatch.');

  // Test 5: Global Push Factory Resolution
  console.log('\n--- 5. Push Gateway Factory Resolution ---');
  const defaultProvider = push.getActiveProvider();
  assert.ok(defaultProvider, 'Factory must return an active push provider');
  assert.strictEqual(typeof defaultProvider.sendToToken, 'function', 'Provider must implement sendToToken()');
  console.log(`✔ Global Push factory resolved active provider: ${defaultProvider.name}.`);

  console.log('\n=============================================================');
  console.log('ALL PHASE 5 PUSH NOTIFICATION TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 5 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
