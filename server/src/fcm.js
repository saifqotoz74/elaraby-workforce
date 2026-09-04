// Firebase Cloud Messaging (HTTP v1 API) — zero-dep sender.
// Activates when a service-account JSON exists at FCM_SERVICE_ACCOUNT_PATH
// (default: server/firebase-service-account.json). Without it every call is
// a no-op and push simply doesn't happen; the in-app inbox keeps working.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_PATH =
  process.env.FCM_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, '..', 'firebase-service-account.json');

let _key = null;
let _accessToken = null;
let _tokenExpiry = 0;

function serviceAccount() {
  if (_key !== null) return _key;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      _key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      return _key;
    } catch (_) {}
  }
  try {
    _key = require('../firebase-service-account.json');
    if (_key && _key.client_email) return _key;
  } catch (_) {}
  try {
    _key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  } catch {
    _key = false; // not configured
  }
  return _key || null;
}

function isConfigured() {
  const k = serviceAccount();
  return !!(k?.client_email && k?.private_key && k?.project_id);
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/// OAuth2 access token via a signed JWT (RS256), cached until near-expiry.
async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60000) return _accessToken;
  const k = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: k.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claim}`)
    .sign(k.private_key)
    .toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`,
    }).toString(),
  });
  if (!res.ok) throw new Error(`oauth failed: ${res.status}`);
  const json = await res.json();
  _accessToken = json.access_token;
  _tokenExpiry = Date.now() + (json.expires_in - 120) * 1000;
  return _accessToken;
}

/// Sends to one device token. Returns true on success, false otherwise.
async function sendToToken(fcmToken, title, body) {
  if (!isConfigured() || !fcmToken) return false;
  try {
    const k = serviceAccount();
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${k.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            android: { priority: 'high' },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error('[fcm] send failed:', res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[fcm] send error:', err.message);
    return false;
  }
}

module.exports = { isConfigured, sendToToken };
