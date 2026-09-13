// Enterprise Firebase Phone Authentication Service
// Validates Firebase ID Tokens using Google Admin SDK with project credential caching
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');
const fs = require('fs');

let _auth = null;
let _initialized = false;

/**
 * Returns an initialized Firebase Admin Auth instance or null if credentials are not configured.
 */
function getFirebaseAuth() {
  if (_auth) return _auth;
  if (_initialized && !_auth) return null;
  _initialized = true;

  try {
    let key = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch (err) {
        console.warn('[firebaseAuth] Failed parsing FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
      }
    }

    if (!key) {
      const keyPath = process.env.FCM_SERVICE_ACCOUNT_PATH || path.join(__dirname, '..', 'firebase-service-account.json');
      if (fs.existsSync(keyPath)) {
        try {
          key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        } catch (_) {
          try {
            key = require('../firebase-service-account.json');
          } catch (_) {}
        }
      }
    }

    if (!key || !key.client_email || !key.private_key) {
      console.warn('[firebaseAuth] No valid Firebase service account found. Phone Auth fallback active.');
      return null;
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(key) });
    _auth = getAuth(app);
    return _auth;
  } catch (err) {
    console.warn('[firebaseAuth] Initialization error:', err.message);
    return null;
  }
}

/**
 * Verifies a client-provided Firebase ID Token.
 * Returns { ok: true, decoded } on success or { ok: false, error } on failure.
 *
 * In test environments or when mock tokens are used, parses mock tokens cleanly.
 */
async function verifyFirebaseIdToken(token) {
  if (!token || typeof token !== 'string') {
    return { ok: false, error: 'missing_token' };
  }

  // Support for testing & simulation in non-production environments
  if (process.env.NODE_ENV !== 'production' && (token.startsWith('mock_') || token.startsWith('test_'))) {
    const parts = token.split(':');
    const mockPhone = parts[1] || '+201229105279';
    return {
      ok: true,
      decoded: {
        uid: 'mock_firebase_uid',
        phone_number: mockPhone,
        auth_time: Math.floor(Date.now() / 1000),
      },
    };
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return { ok: false, error: 'firebase_not_configured' };
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    return { ok: true, decoded };
  } catch (err) {
    console.warn('[firebaseAuth] ID token verification failed:', err.message);
    return { ok: false, error: err.code || 'invalid_token', message: err.message };
  }
}

module.exports = {
  getFirebaseAuth,
  verifyFirebaseIdToken,
};
