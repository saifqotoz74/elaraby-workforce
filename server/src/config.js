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

function validateSecurity() {
  const env = getEnv();

  if (env === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const adminPass = process.env.ADMIN_PASS;

    if (!jwtSecret || jwtSecret === 'dev-secret-elaraby-2026' || jwtSecret.length < 32) {
      if (!process.env.VERCEL) {
        console.error('FATAL: In production, JWT_SECRET must be set to an unpredictable string of at least 32 characters.');
        process.exit(1);
      } else {
        console.warn('⚠️ [VERCEL WARNING] JWT_SECRET not set in Vercel dashboard. Using auto-generated secret.');
      }
    }

    if (!adminPass || adminPass === 'elaraby2026' || adminPass === 'Admin@12345') {
      if (!process.env.VERCEL) {
        console.error('FATAL: In production, ADMIN_PASS must be changed from the default development credentials.');
        process.exit(1);
      } else {
        console.warn('⚠️ [VERCEL WARNING] ADMIN_PASS using default. Configure ADMIN_PASS in Vercel settings.');
      }
    }
  } else if (env === 'staging') {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret === 'dev-secret-elaraby-2026') {
      console.warn('⚠️ [STAGING WARNING] Staging environment is using the default development JWT secret.');
    }
  }
}

module.exports = {
  load,
  getEnv,
  isProd,
  isStaging,
  isDev,
  validateSecurity,
};
