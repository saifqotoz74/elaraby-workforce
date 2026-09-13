// Enterprise Production Configuration & Zero-Mock Security Enforcement Test Suite
// Verifies Rule A (No Fake Readiness) and Rule B (Zero Silent Development Fallbacks in Production)

const assert = require('assert');
const config = require('../src/config');
const db = require('../src/db');
const redis = require('../src/queue/redis');
const { readinessProbe } = require('../src/observability/healthCheck');

async function runTests() {
  console.log('=============================================================');
  console.log('--- PRODUCTION CONFIGURATION & ZERO-MOCK HARDENING SUITE ---');
  console.log('=============================================================\n');

  const originalEnv = { ...process.env };

  try {
    // 1. Production Mode Missing Mandatory Database Assertion
    console.log('--- 1. Production Mode Database Requirement (Rule B) ---');
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ALLOW_JSON_IN_PROD;

    const validationNoDb = config.validateProductionConfig();
    assert.strictEqual(validationNoDb.valid, false);
    const hasDbError = validationNoDb.errors.some((e) => e.includes('DATABASE_URL'));
    assert.strictEqual(hasDbError, true, 'DATABASE_URL absence must trigger validation failure');

    // Verify db.data() refuses JSON persistence in production
    try {
      db.data();
      assert.fail('db.data() must fail in production when DATABASE_URL is missing');
    } catch (err) {
      assert.ok(err.message.includes('strictly forbids JSON persistence'));
      console.log('✔ db.data() strictly refuses JSON persistence in production mode.');
    }

    // 2. Production Mode Missing Mandatory Redis Assertion
    console.log('\n--- 2. Production Mode Redis Requirement (Rule B) ---');
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.ALLOW_REDIS_MOCK_IN_PROD;

    const validationNoRedis = config.validateProductionConfig();
    assert.strictEqual(validationNoRedis.valid, false);
    const hasRedisError = validationNoRedis.errors.some((e) => e.includes('REDIS_URL'));
    assert.strictEqual(hasRedisError, true, 'REDIS_URL absence must trigger validation failure');

    // Verify redis.getRedisClient() refuses InMemoryRedisMock in production
    try {
      redis.getRedisClient();
      assert.fail('redis.getRedisClient() must fail in production when REDIS_URL is missing');
    } catch (err) {
      assert.ok(err.message.includes('strictly forbids InMemoryRedisMock'));
      console.log('✔ redis.getRedisClient() strictly refuses InMemoryRedisMock fallback in production.');
    }

    // 3. Production Health Probe Dependency Readiness Gate
    console.log('\n--- 3. Production Health Probe Dependency Readiness Gate ---');
    let statusCode = 200;
    let responseBody = null;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await readinessProbe({}, mockRes);
    assert.strictEqual(statusCode, 503, 'Readiness probe must return 503 Service Unavailable in production when dependencies unconfigured');
    assert.strictEqual(responseBody.status, 'DOWN');
    assert.strictEqual(responseBody.ready, false);
    console.log('✔ Kubernetes readiness probe returns 503 DOWN when production infrastructure is unconfigured.');

    // 4. Valid Production Configuration Acceptance
    console.log('\n--- 4. Valid Production Configuration Acceptance ---');
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db?sslmode=require';
    process.env.REDIS_URL = 'redis://:pass@host:6379';
    process.env.JWT_SECRET = 'a_very_secure_and_cryptographically_random_jwt_secret_with_over_32_characters';
    process.env.ADMIN_PASS = 'StrongEnterpriseAdminPass2026!';
    process.env.STORAGE_PROVIDER = 'local'; // allowed if local provider chosen explicitly

    const validCheck = config.validateProductionConfig();
    assert.strictEqual(validCheck.valid, true, 'Valid production configuration must pass');
    assert.strictEqual(validCheck.errors.length, 0);
    console.log('✔ Complete production configuration passes validation with 0 errors.');

    // 5. Development Mode Tolerance (Local compatibility store & in-memory mock allowed)
    console.log('\n--- 5. Development Mode Local Mocks Tolerance ---');
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    process.env.JWT_SECRET = 'dev-secret-elaraby-2026';

    const devData = db.data();
    assert.ok(devData, 'Development mode allows local compatibility data access');
    const devRedis = redis.getRedisClient();
    assert.ok(devRedis instanceof redis.InMemoryRedisMock, 'Development mode allows InMemoryRedisMock');
    console.log('✔ Development mode preserves rapid local developer workflows without crashing.');

    console.log('\n=============================================================');
    console.log('ALL PRODUCTION HARDENING TESTS PASSED (0 FAILURES)');
    console.log('=============================================================\n');
  } finally {
    // Restore environment
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
  }
}

if (require.main === module) {
  runTests().catch((err) => {
    console.error('Production hardening tests failed:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
