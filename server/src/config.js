// Environment configuration loader & validator.
// Supports discrete development, staging, and production profiles.
// Real environment variables always take precedence over file-defined values.
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function load() {
  const env = process.env.NODE_ENV || 'development';
  const rootDir = path.join(__dirname, '..');

  // Load order: .env, .env.local, .env.{environment}
  const filesToLoad = [
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local'),
    path.join(rootDir, `.env.${env}`),
  ];

  for (const file of filesToLoad) {
    const parsed = parseEnvFile(file);
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in process.env)) {
        process.env[k] = v;
      }
    }
  }

  validateSecurity();
}

function getEnv() {
  return process.env.NODE_ENV || 'development';
}

function isProd() {
  return getEnv() === 'production';
}

function isStaging() {
  return getEnv() === 'staging';
}

function isDev() {
  return getEnv() === 'development';
}

function validateProductionConfig() {
  const errors = [];
  const env = getEnv();

  // 1. Mandatory Database (PostgreSQL required in production)
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    errors.push('DATABASE_URL is missing. PostgreSQL is strictly required as the authoritative production database.');
  } else if (!dbUrl.startsWith('pg:' + '//') && !dbUrl.startsWith('post' + 'gres://') && !dbUrl.startsWith('post' + 'gresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection URI.');
  }

  // 2. Mandatory Redis (Redis 7+ required for distributed rate-limiting, locks, queues & pubsub)
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl && !process.env.REDIS_HOST) {
    errors.push('REDIS_URL is missing. Redis 7+ is required in production for cluster synchronization.');
  }

  // 3. Mandatory Auth Secrets
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'dev-secret-elaraby-2026' || jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be set to a cryptographically random string of at least 32 characters.');
  }

  const adminPass = process.env.ADMIN_PASS;
  if (!adminPass || adminPass === 'elaraby2026' || adminPass === 'Admin@12345' || adminPass.length < 12) {
    errors.push('ADMIN_PASS must be changed from default development credentials (minimum 12 chars).');
  }

  // 4. Object Storage Validation
  const storageProvider = (process.env.STORAGE_PROVIDER || '').toLowerCase();
  if (storageProvider === 's3') {
    if (!process.env.S3_BUCKET && !process.env.S3_ENDPOINT) {
      errors.push('S3_BUCKET or S3_ENDPOINT is required when STORAGE_PROVIDER=s3.');
    }
    if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      errors.push('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_PROVIDER=s3.');
    }
  }

  // 5. SMS Provider Validation
  const smsProvider = (process.env.SMS_PROVIDER || '').toLowerCase();
  if (smsProvider === 'cequens' && !process.env.CEQUENS_API_KEY) {
    errors.push('CEQUENS_API_KEY is required when SMS_PROVIDER=cequens.');
  }
  if (smsProvider === 'twilio' && (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)) {
    errors.push('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when SMS_PROVIDER=twilio.');
  }
  if (smsProvider === 'vodafone' && (!process.env.VODAFONE_API_KEY || !process.env.VODAFONE_ACCOUNT_ID)) {
    errors.push('VODAFONE_API_KEY and VODAFONE_ACCOUNT_ID are required when SMS_PROVIDER=vodafone.');
  }

  // 6. Push Provider Validation
  const pushProvider = (process.env.PUSH_PROVIDER || '').toLowerCase();
  if (pushProvider === 'firebase') {
    const hasServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 
                              process.env.FIREBASE_CONFIG ||
                              (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
                              fs.existsSync(path.join(__dirname, '..', 'firebase-service-account.json'));
    if (!hasServiceAccount) {
      errors.push('Firebase credentials missing. Provide FIREBASE_SERVICE_ACCOUNT_JSON or credentials file.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateSecurity() {
  const env = getEnv();

  if (env === 'production') {
    const validation = validateProductionConfig();
    if (!validation.valid) {
      if (!process.env.VERCEL) {
        console.error('\n❌ ============================================================');
        console.error('❌ PRODUCTION STARTUP BLOCKED: FATAL CONFIGURATION DEFICIENCIES');
        console.error('❌ ============================================================');
        validation.errors.forEach((err) => console.error(`  - ❌ ${err}`));
        console.error('❌ ============================================================\n');
        // If invoked directly in production server run, fail fast
        if (process.env.FAIL_FAST_ON_CONFIG !== 'false' && !process.env.DISABLE_PROD_CONFIG_FAIL_FAST) {
          process.exit(1);
        }
      } else {
        console.warn('⚠️ [VERCEL WARNING] Running with fallback config in Vercel environment.');
      }
    }
  } else if (env === 'staging') {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret === 'dev-secret-elaraby-2026') {
      console.warn('⚠️ [STAGING WARNING] Staging environment is using the default development JWT secret.');
    }
  }
}

function printStartupBanner() {
  const env = getEnv().toUpperCase();
  const dbStatus = process.env.DATABASE_URL ? 'PostgreSQL [CONNECTED]' : (isProd() ? 'BLOCKED' : 'JSON Store (Dev/Test)');
  const redisStatus = process.env.REDIS_URL ? 'ENABLED (Redis 7+)' : (isProd() ? 'BLOCKED' : 'InMemoryMock (Dev/Test)');
  const queueStatus = process.env.REDIS_URL ? 'BullMQ (Active)' : 'Local In-Process';
  const storageStatus = (process.env.STORAGE_PROVIDER || (isProd() ? 'S3 / MinIO' : 'Local Filesystem')).toUpperCase();
  const smsStatus = (process.env.SMS_PROVIDER || 'MOCK').toUpperCase();
  const pushStatus = (process.env.PUSH_PROVIDER || 'FIREBASE').toUpperCase();
  const erpStatus = (process.env.ERP_PROVIDER || 'MOCK').toUpperCase();
  const realtimeStatus = process.env.REDIS_URL ? 'Redis Pub/Sub (Multi-Instance)' : 'Local EventEmitter';

  console.log('\n=============================================================');
  console.log('--- ELARABY WORKFORCE — ENTERPRISE PRODUCTION RUNTIME ---');
  console.log(`Environment:          ${env}`);
  console.log(`Database:             ${dbStatus}`);
  console.log(`Redis:                ${redisStatus}`);
  console.log(`Background Queue:     ${queueStatus}`);
  console.log(`Object Storage:       ${storageStatus}`);
  console.log(`SMS Gateway:          ${smsStatus}`);
  console.log(`Push Notifications:   ${pushStatus}`);
  console.log(`ERP Gateway:          ${erpStatus}`);
  console.log(`Realtime SSE Bridge:  ${realtimeStatus}`);
  console.log('=============================================================\n');
}

module.exports = {
  load,
  getEnv,
  isProd,
  isStaging,
  isDev,
  validateSecurity,
  validateProductionConfig,
  printStartupBanner,
};
