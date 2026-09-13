const BaseSmsProvider = require('./BaseSmsProvider');

class MockSmsProvider extends BaseSmsProvider {
  constructor() {
    super('mock');
    this.sentMessages = [];
    this.shouldFail = false;
  }

  isConfigured() {
    return true; // Mock is always available for test/dev
  }

  setShouldFail(val) {
    this.shouldFail = !!val;
  }

  async send(to, body, options = {}) {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'mock_provider_simulated_outage',
      };
    }

    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const normalizedTo = this.normalizePhone(to);
    
    this.sentMessages.push({
      messageId,
      to: normalizedTo,
      body,
      tenantId: options.tenantId || null,
      senderId: options.senderId || 'default',
      timestamp: Date.now(),
    });

    return {
      success: true,
      messageId,
      provider: 'mock',
      senderId: options.senderId || 'default',
      tenantId: options.tenantId || null,
    };
  }

  clear() {
    this.sentMessages = [];
    this.shouldFail = false;
  }
}

module.exports = MockSmsProvider;
