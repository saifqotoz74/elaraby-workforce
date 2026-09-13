// Enterprise Structured JSON Logger with Sensitive Data Scrubbing
const crypto = require('crypto');

const SENSITIVE_KEYS = new Set([
  'pin', 'pinhash', 'password', 'token', 'jwt', 'secret',
  'otp', 'otpcode', 'authorization', 'cookie', 'csrf',
  'private_key', 'privatekey', 'client_secret',
]);

function scrub(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(scrub);

  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    const lowerKey = k.toLowerCase().replace(/[_-]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      clean[k] = scrub(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'elaraby-workforce-api';
const ENV = process.env.NODE_ENV || 'development';

function formatLog(level, message, meta = {}) {
  const logObj = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    environment: ENV,
    message,
    ...scrub(meta),
  };
  return JSON.stringify(logObj);
}

const logger = {
  info(msg, meta) {
    console.log(formatLog('INFO', msg, meta));
  },
  warn(msg, meta) {
    console.warn(formatLog('WARN', msg, meta));
  },
  error(msg, meta) {
    console.error(formatLog('ERROR', msg, meta));
  },
  debug(msg, meta) {
    if (process.env.DEBUG || ENV === 'development') {
      console.log(formatLog('DEBUG', msg, meta));
    }
  },
  scrub,
};

module.exports = logger;
