// Phase 4: SMS Integration & Enterprise Provider Abstraction Tests
const assert = require('assert');
const sms = require('../src/integrations/sms');
const MockSmsProvider = require('../src/integrations/sms/MockSmsProvider');
const TwilioSmsProvider = require('../src/integrations/sms/TwilioSmsProvider');
const CequensSmsProvider = require('../src/integrations/sms/CequensSmsProvider');
const VodafoneSmsProvider = require('../src/integrations/sms/VodafoneSmsProvider');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 4: SMS PROVIDER ABSTRACTION TEST SUITE ---');
  console.log('=============================================================');

  // Test 1: Phone Number Normalization
  console.log('\n--- 1. Egyptian & International Phone Normalization ---');
  const mock = new MockSmsProvider();
  assert.strictEqual(mock.normalizePhone('01012345678'), '+201012345678', 'Local 010 should format to +2010');
  assert.strictEqual(mock.normalizePhone('01198765432'), '+201198765432', 'Local 011 should format to +2011');
  assert.strictEqual(mock.normalizePhone('01234567890'), '+201234567890', 'Local 012 should format to +2012');
  assert.strictEqual(mock.normalizePhone('01512345678'), '+201512345678', 'Local 015 should format to +2015');
  assert.strictEqual(mock.normalizePhone('+201012345678'), '+201012345678', 'Already formatted +20 should preserve');
  assert.strictEqual(mock.normalizePhone('00201012345678'), '+201012345678', '0020 prefix should format to +20');
  console.log('✔ Egyptian local and international mobile phone normalization verified.');

  // Test 2: Mock SMS Provider Dispatch & Message Recording
  console.log('\n--- 2. Mock SMS Provider Delivery ---');
  mock.clear();
  const sendRes = await mock.send('01012345678', 'رمز التحقق الخاص بك هو: 849201');
  assert.strictEqual(sendRes.success, true, 'Mock send must succeed');
  assert.ok(sendRes.messageId, 'Must return a generated messageId');
  assert.strictEqual(mock.sentMessages.length, 1, 'Sent messages count must be 1');
  assert.strictEqual(mock.sentMessages[0].to, '+201012345678', 'Recipient must be normalized');
  console.log('✔ Mock SMS provider successfully recorded outbound message.');

  // Test 3: SMS Provider Failure & Resilience Handling
  console.log('\n--- 3. Provider Outage Simulation & Error Containment ---');
  mock.setShouldFail(true);
  const failRes = await mock.send('01012345678', 'رمز التحقق');
  assert.strictEqual(failRes.success, false, 'Simulated failure must report success: false');
  assert.strictEqual(failRes.error, 'mock_provider_simulated_outage', 'Must report structured error reason');
  mock.setShouldFail(false);
  console.log('✔ Provider outage gracefully handled without throwing unhandled exceptions.');

  // Test 4: Provider Config & Unconfigured Credentials Safety
  console.log('\n--- 4. Unconfigured Enterprise Provider Safety ---');
  const twilio = new TwilioSmsProvider();
  const cequens = new CequensSmsProvider();
  const vodafone = new VodafoneSmsProvider();

  // Without credentials, these must report isConfigured() === false
  // and fail safely rather than making broken network requests
  if (!process.env.TWILIO_ACCOUNT_SID) {
    assert.strictEqual(twilio.isConfigured(), false, 'Twilio without env vars must report unconfigured');
    const twilioRes = await twilio.send('01012345678', 'Test');
    assert.strictEqual(twilioRes.success, false, 'Unconfigured Twilio must report false');
    assert.strictEqual(twilioRes.error, 'twilio_not_configured');
  }

  if (!process.env.CEQUENS_API_KEY) {
    assert.strictEqual(cequens.isConfigured(), false, 'Cequens without env vars must report unconfigured');
    const ceqRes = await cequens.send('01012345678', 'Test');
    assert.strictEqual(ceqRes.success, false, 'Unconfigured Cequens must report false');
    assert.strictEqual(ceqRes.error, 'cequens_not_configured');
  }

  if (!process.env.VODAFONE_SMS_USER) {
    assert.strictEqual(vodafone.isConfigured(), false, 'Vodafone without env vars must report unconfigured');
    const vodRes = await vodafone.send('01012345678', 'Test');
    assert.strictEqual(vodRes.success, false, 'Unconfigured Vodafone must report false');
    assert.strictEqual(vodRes.error, 'vodafone_not_configured');
  }
  console.log('✔ Real enterprise SMS providers safely handle missing credentials without crashing.');

  // Test 5: Global SMS Gateway Factory Resolution
  console.log('\n--- 5. SMS Gateway Factory & Active Provider Resolution ---');
  const defaultProvider = sms.getActiveProvider();
  assert.ok(defaultProvider, 'Factory must return an active provider');
  assert.strictEqual(typeof defaultProvider.send, 'function', 'Active provider must implement send()');
  
  const dispatchRes = await sms.send('01099887766', 'رسالة تجريبية');
  assert.ok(typeof dispatchRes.success === 'boolean', 'Factory send must return boolean success');
  console.log(`✔ Global SMS factory successfully resolved active provider: ${defaultProvider.name}.`);

  console.log('\n=============================================================');
  console.log('ALL PHASE 4 SMS PROVIDER TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 4 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
