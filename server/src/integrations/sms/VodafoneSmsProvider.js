const BaseSmsProvider = require('./BaseSmsProvider');

// Vodafone Egypt Bulk SMS Enterprise Adapter
class VodafoneSmsProvider extends BaseSmsProvider {
  constructor() {
    super('vodafone');
  }

  isConfigured() {
    return !!(
      process.env.VODAFONE_SMS_USER &&
      process.env.VODAFONE_SMS_PASS &&
      process.env.VODAFONE_SMS_SENDER
    );
  }

  async send(to, body) {
    if (!this.isConfigured()) {
      return { success: false, error: 'vodafone_not_configured' };
    }

    const user = process.env.VODAFONE_SMS_USER;
    const pass = process.env.VODAFONE_SMS_PASS;
    const sender = process.env.VODAFONE_SMS_SENDER || 'ELARABY';
    const baseUrl = process.env.VODAFONE_SMS_URL || 'https://bulksms.vodafone.com.eg/api/sms/send';
    const normalizedTo = this.normalizePhone(to);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const params = new URLSearchParams({
        username: user,
        password: pass,
        sender,
        msisdn: normalizedTo,
        message: body,
      });

      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        method: 'POST',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return { success: false, error: `vodafone_http_${res.status}` };
      }

      return {
        success: true,
        messageId: `vod_${Date.now()}`,
        provider: 'vodafone',
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = VodafoneSmsProvider;
