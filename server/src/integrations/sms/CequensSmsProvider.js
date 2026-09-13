const BaseSmsProvider = require('./BaseSmsProvider');

// Cequens Enterprise SMS Gateway (Leading Egyptian Telecom Aggregator)
class CequensSmsProvider extends BaseSmsProvider {
  constructor() {
    super('cequens');
  }

  isConfigured() {
    return !!(process.env.CEQUENS_API_KEY && process.env.CEQUENS_SENDER_ID);
  }

  async send(to, body) {
    if (!this.isConfigured()) {
      return { success: false, error: 'cequens_not_configured' };
    }

    const apiKey = process.env.CEQUENS_API_KEY;
    const senderId = process.env.CEQUENS_SENDER_ID || 'ELARABY';
    const baseUrl = process.env.CEQUENS_API_URL || 'https://api.cequens.com/sms/v1/messages';
    const normalizedTo = this.normalizePhone(to);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          senderName: senderId,
          messageText: body,
          recipients: normalizedTo,
          messageType: 'text',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return { success: false, error: `cequens_http_${res.status}` };
      }

      const json = await res.json();
      return {
        success: true,
        messageId: json.messageId || json.id || `ceq_${Date.now()}`,
        provider: 'cequens',
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = CequensSmsProvider;
