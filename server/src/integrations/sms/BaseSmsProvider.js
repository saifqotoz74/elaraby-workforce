// Enterprise SMS Provider Abstraction
// Supports: Mock (dev/test), Twilio, Cequens (Egypt), Vodafone (Egypt), VictoryLink

class BaseSmsProvider {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    return false;
  }

  /**
   * Normalizes local Egyptian numbers (01XXXXXXXXX) to international E.164 (+201XXXXXXXXX).
   */
  normalizePhone(raw) {
    let digits = String(raw || '').replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('1')) return `+20${digits}`;
    return digits.startsWith('20') ? `+${digits}` : `+20${digits}`;
  }

  /**
   * Sends an SMS message.
   * @param {string} to - Recipient phone number
   * @param {string} body - SMS text content
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async send(to, body) {
    throw new Error('Method "send" must be implemented by concrete SMS provider');
  }
}

module.exports = BaseSmsProvider;
