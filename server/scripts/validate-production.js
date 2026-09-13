#!/usr/bin/env node
// Enterprise Production Configuration Validator
// Validates all infrastructure, secrets, provider adapters, and security parameters
// Reports PASS / WARN / FAIL without leaking sensitive values.

require('../src/config').load();
const postgres = require('../src/db/postgres');
const redis = require('../src/queue/redis');
const sms = require('../src/integrations/sms');
const push = require('../src/integrations/push');
const erp = require('../src/integrations/erp');

const results = [];

function check(name, status, details = '') {
  results.push({ name, status, details });
}

async function validate() {
  console.log('=============================================================');
  console.log('--- ELARABY WORKFORCE — PRODUCTION CONFIGURATION AUDIT ---');
  console.log('=============================================================\n');

  // 1. Environment & Server Mode
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    check('NODE_ENV (Production Mode)', 'PASS', 'production');
  } else {
    check('NODE_ENV (Production Mode)', 'WARN', `Running in "${env}" mode`);
  }

  // 2. JWT Security
  const jwt = process.env.JWT_SECRET || '';
  if (jwt && jwt.length >= 32 && jwt !== 'replace_with_cryptographically_secure_random_string_min_48_chars') {
    check('JWT Secret Cryptographic Strength', 'PASS', `${jwt.length} chars`);
  } else if (env === 'production') {
    check('JWT Secret Cryptographic Strength', 'FAIL', 'JWT_SECRET missing or default placeholder');
  } else {
    check('JWT Secret Cryptographic Strength', 'WARN', 'Using development placeholder secret');
  }

  // 3. Admin Authentication Credentials
  const adminPass = process.env.ADMIN_PASS || '';
  if (adminPass && adminPass.length >= 16 && !adminPass.includes('replace_with') && adminPass !== 'elaraby2026') {
    check('Admin Password Hardening', 'PASS', 'Configured securely');
  } else if (env === 'production') {
    check('Admin Password Hardening', 'FAIL', 'ADMIN_PASS missing or weak');
  } else {
    check('Admin Password Hardening', 'WARN', 'Using development placeholder password');
  }

  // 4. Primary Database (PostgreSQL)
  if (postgres.isConfigured()) {
    const health = await postgres.checkHealth();
    if (health.ok) {
      check('PostgreSQL Primary Database', 'PASS', `Connected: ${health.database} (${health.latencyMs}ms)`);
    } else {
      check('PostgreSQL Primary Database', 'FAIL', `Connection error: ${health.error}`);
    }
  } else if (env === 'production') {
    check('PostgreSQL Primary Database', 'FAIL', 'DATABASE_URL missing. Production strictly requires PostgreSQL.');
  } else {
    check('PostgreSQL Primary Database', 'PASS', 'Local compatibility store active for dev/test');
  }

  // 5. Distributed Cache & Queues (Redis)
  if (redis.isConfigured()) {
    const health = await redis.checkHealth();
    if (health.ok) {
      check('Redis Distributed Cache & Queues', 'PASS', `Connected (${health.latencyMs}ms)`);
    } else {
      check('Redis Distributed Cache & Queues', 'FAIL', `Connection error: ${health.error}`);
    }
  } else if (env === 'production') {
    check('Redis Distributed Cache & Queues', 'FAIL', 'REDIS_URL missing. Production strictly requires Redis 7+.');
  } else {
    check('Redis Distributed Cache & Queues', 'WARN', 'REDIS_URL not configured; using in-memory mock fallback for dev/test');
  }

  // 6. External SMS Gateway
  const smsProvider = sms.getActiveProvider();
  if (sms.isConfigured()) {
    check('SMS Gateway Integration', 'PASS', `Active provider: ${smsProvider.name}`);
  } else {
    check('SMS Gateway Integration', 'WARN', `Credentials unconfigured; using MockSmsProvider (${smsProvider.name})`);
  }

  // 7. Firebase Cloud Messaging Push
  const pushProvider = push.getActiveProvider();
  if (push.isConfigured()) {
    check('Firebase Push Notifications (FCM)', 'PASS', `Active provider: ${pushProvider.name}`);
  } else {
    check('Firebase Push Notifications (FCM)', 'WARN', `Service account unconfigured; using MockPushProvider`);
  }

  // 8. Enterprise ERP Integration
  const erpAdapter = erp.getActiveAdapter();
  if (erp.isConfigured()) {
    check('Enterprise ERP Gateway (SAP/Oracle)', 'PASS', `Active adapter: ${erpAdapter.name}`);
  } else {
    check('Enterprise ERP Gateway (SAP/Oracle)', 'WARN', `Production ERP endpoint unconfigured; using MockErpAdapter`);
  }

  // 9. Observability & APM Monitoring
  if (process.env.SENTRY_DSN) {
    check('Sentry APM Error Monitoring', 'PASS', 'Configured');
  } else {
    check('Sentry APM Error Monitoring', 'WARN', 'SENTRY_DSN unconfigured; using local error tracking');
  }

  // 10. CORS Security Whitelist
  const cors = process.env.CORS_ORIGIN || '';
  if (cors && cors !== '*') {
    check('CORS Origin Whitelist', 'PASS', cors);
  } else {
    check('CORS Origin Whitelist', 'WARN', 'Wildcard CORS (*) active; whitelist specific domains for production');
  }

  // Print Formatted Report
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const r of results) {
    const padName = r.name.padEnd(42, '.');
    let badge = r.status;
    if (r.status === 'PASS') {
      passCount++;
      badge = '\x1b[32mPASS\x1b[0m';
    } else if (r.status === 'WARN') {
      warnCount++;
      badge = '\x1b[33mWARN\x1b[0m';
    } else {
      failCount++;
      badge = '\x1b[31mFAIL\x1b[0m';
    }
    const details = r.details ? ` (${r.details})` : '';
    console.log(`${padName} [${badge}]${details}`);
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`Summary: ${passCount} Passed, ${warnCount} Warnings, ${failCount} Failures`);
  console.log('-------------------------------------------------------------');

  if (failCount > 0) {
    console.error('\n❌ Production validation failed: Critical engineering blockers remain.');
    return false;
  } else {
    console.log('\n✔ Configuration validator passed cleanly (All parameters safe).');
    return true;
  }
}

if (require.main === module) {
  validate()
    .then((ok) => {
      postgres.closePool().then(() => process.exit(ok ? 0 : 1));
    })
    .catch((err) => {
      console.error('Validator crashed:', err);
      process.exit(1);
    });
}

module.exports = { validate };
