// Tiny .env loader (zero deps): reads server/.env into process.env once.
// Real environment variables always win over .env values.
const fs = require('fs');
const path = require('path');

function load() {
  const envFile = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
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
    if (!(key in process.env)) process.env[key] = value;
  }
  validateSecurity();
}

function validateSecurity() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  const jwtSecret = process.env.JWT_SECRET;
  const adminPass = process.env.ADMIN_PASS;

  if (!jwtSecret || jwtSecret === 'dev-secret-change-me-in-production') {
    console.error('FATAL: JWT_SECRET must be set to a cryptographically secure random string in production.');
    process.exit(1);
  }

  if (!adminPass || adminPass === 'elaraby2026') {
    console.error('FATAL: ADMIN_PASS must be changed from the default password in production.');
    process.exit(1);
  }
}

module.exports = { load, validateSecurity };
