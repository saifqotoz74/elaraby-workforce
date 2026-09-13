const BaseBiometricAdapter = require('./BaseBiometricAdapter');

class MockBiometricAdapter extends BaseBiometricAdapter {
  constructor() {
    super('mock');
    this.ingestedPunches = [];
  }

  async ingestPunches(punches = []) {
    const normalized = punches.map((p) => this.normalizePunch(p));
    this.ingestedPunches.push(...normalized);
    return {
      success: true,
      count: normalized.length,
      timestamp: Date.now(),
    };
  }

  clear() {
    this.ingestedPunches = [];
  }
}

module.exports = MockBiometricAdapter;
