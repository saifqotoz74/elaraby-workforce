// Enterprise Push Notification Base Provider

class BasePushProvider {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    return false;
  }

  /**
   * Sends a push notification to a single device token.
   * @param {string} token - FCM registration token
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} [data] - Optional key-value custom data payload
   * @returns {Promise<{ success: boolean, messageId?: string, isInvalidToken?: boolean, error?: string }>}
   */
  async sendToToken(token, title, body, data = {}) {
    throw new Error('Method "sendToToken" must be implemented by concrete Push provider');
  }

  /**
   * Sends multicast push notifications to multiple device tokens.
   * @param {string[]} tokens - List of FCM tokens
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} [data] - Optional custom data
   */
  async sendMulticast(tokens, title, body, data = {}) {
    const results = [];
    for (const t of tokens) {
      results.push(await this.sendToToken(t, title, body, data));
    }
    return results;
  }
}

module.exports = BasePushProvider;
