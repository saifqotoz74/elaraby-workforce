const BasePushProvider = require('./BasePushProvider');

class MockPushProvider extends BasePushProvider {
  constructor() {
    super('mock');
    this.sentNotifications = [];
    this.invalidTokens = new Set(['invalid_token_test', 'revoked_token_123']);
  }

  isConfigured() {
    return true;
  }

  markTokenInvalid(token) {
    this.invalidTokens.add(token);
  }

  async sendToToken(token, title, body, data = {}) {
    if (!token) {
      return { success: false, error: 'empty_token', isInvalidToken: true };
    }

    if (this.invalidTokens.has(token)) {
      return {
        success: false,
        isInvalidToken: true,
        error: 'token_unregistered_or_revoked',
      };
    }

    const messageId = `mock_fcm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.sentNotifications.push({
      messageId,
      token,
      title,
      body,
      data,
      timestamp: Date.now(),
    });

    return {
      success: true,
      messageId,
      provider: 'mock',
    };
  }

  clear() {
    this.sentNotifications = [];
  }
}

module.exports = MockPushProvider;
