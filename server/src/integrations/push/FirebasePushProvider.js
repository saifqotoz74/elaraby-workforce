const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BasePushProvider = require('./BasePushProvider');

class FirebasePushProvider extends BasePushProvider {
  constructor() {
    super('firebase');
    this._key = null;
    this._accessToken = null;
    this._tokenExpiry = 0;
    this._tokenPromise = null;
  }

  getServiceAccount() {
    if (this._key !== null) return this._key;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        this._key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        return this._key;
      } catch (_) {}
    }

    const keyPath = process.env.FCM_SERVICE_ACCOUNT_PATH || path.join(__dirname, '..', '..', '..', 'firebase-service-account.json');
    if (fs.existsSync(keyPath)) {
      try {
        this._key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        return this._key;
      } catch (_) {}
    }

    this._key = false;
    return null;
  }

  isConfigured() {
    const k = this.getServiceAccount();
    if (!k || !k.client_email || !k.private_key || !k.project_id) return false;
    if (k.project_id.includes('placeholder') || k.project_id.includes('YOUR_FIREBASE')) return false;
    return true;
  }

  base64url(buf) {
    return Buffer.from(buf).toString('base64url');
  }

  async getAccessToken() {
    if (this._accessToken && Date.now() < this._tokenExpiry - 60000) {
      return this._accessToken;
    }
    if (this._tokenPromise) return this._tokenPromise;

    this._tokenPromise = (async () => {
      try {
        const k = this.getServiceAccount();
        if (!k) throw new Error('firebase_service_account_not_available');
        const now = Math.floor(Date.now() / 1000);
        const header = this.base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const claim = this.base64url(JSON.stringify({
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

        if (!res.ok) throw new Error(`firebase_oauth_failed_${res.status}`);
        const json = await res.json();
        this._accessToken = json.access_token;
        this._tokenExpiry = Date.now() + (json.expires_in - 120) * 1000;
        return this._accessToken;
      } finally {
        this._tokenPromise = null;
      }
    })();

    return this._tokenPromise;
  }

  async sendToToken(token, title, body, data = {}) {
    if (!this.isConfigured() || !token) {
      return { success: false, error: 'fcm_not_configured_or_empty_token' };
    }

    try {
      const k = this.getServiceAccount();
      const accessToken = await this.getAccessToken();

      const stringData = {};
      for (const [k, v] of Object.entries(data || {})) {
        stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }

      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${k.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: stringData,
              android: {
                priority: 'HIGH',
                notification: { sound: 'default', channel_id: 'elaraby_important' },
              },
              apns: {
                payload: { aps: { sound: 'default', badge: 1 } },
              },
            },
          }),
        }
      );

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const status = errorJson?.error?.status || '';
        const isInvalid = status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT';
        return {
          success: false,
          isInvalidToken: isInvalid,
          error: errorJson?.error?.message || `fcm_http_${res.status}`,
        };
      }

      const json = await res.json();
      return {
        success: true,
        messageId: json.name,
        provider: 'firebase',
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = FirebasePushProvider;
