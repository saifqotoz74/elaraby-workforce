const BaseSmsProvider = require('./BaseSmsProvider');

class TwilioSmsProvider extends BaseSmsProvider {
  constructor() {
    super('twilio');
  }

  isConfigured() {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_PHONE || process.env.TWILIO_PHONE_NUMBER)
    );
  }

  async send(to, body) {
    if (!this.isConfigured()) {
      return { success: false, error: 'twilio_not_configured' };
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE || process.env.TWILIO_PHONE_NUMBER;
    const normalizedTo = this.normalizePhone(to);

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const params = new URLSearchParams({
        To: normalizedTo,
        From: from,
        Body: body,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[sms:twilio] dispatch failed with status:', res.status);
        return { success: false, error: `twilio_http_${res.status}`, details: errorText.slice(0, 150) };
      }

      const json = await res.json();
      return {
        success: true,
        messageId: json.sid,
        provider: 'twilio',
      };
    } catch (err) {
      console.error('[sms:twilio] network or timeout exception:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = TwilioSmsProvider;
