// Enterprise SMS Gateway Factory & Integration Boundary
const MockSmsProvider = require('./MockSmsProvider');
const TwilioSmsProvider = require('./TwilioSmsProvider');
const CequensSmsProvider = require('./CequensSmsProvider');
const VodafoneSmsProvider = require('./VodafoneSmsProvider');

const providers = {
  mock: new MockSmsProvider(),
  twilio: new TwilioSmsProvider(),
  cequens: new CequensSmsProvider(),
  vodafone: new VodafoneSmsProvider(),
};

let _activeProvider = null;

function getActiveProvider() {
  if (_activeProvider) return _activeProvider;

  const requested = (process.env.SMS_PROVIDER || '').toLowerCase().trim();
  if (requested && providers[requested]) {
    _activeProvider = providers[requested];
    return _activeProvider;
  }

  // Automatic provider resolution based on credentials
  if (providers.cequens.isConfigured()) {
    _activeProvider = providers.cequens;
  } else if (providers.vodafone.isConfigured()) {
    _activeProvider = providers.vodafone;
  } else if (providers.twilio.isConfigured()) {
    _activeProvider = providers.twilio;
  } else {
    _activeProvider = providers.mock;
  }

  return _activeProvider;
}

function setActiveProvider(nameOrInstance) {
  if (typeof nameOrInstance === 'string' && providers[nameOrInstance]) {
    _activeProvider = providers[nameOrInstance];
  } else if (nameOrInstance && typeof nameOrInstance.send === 'function') {
    _activeProvider = nameOrInstance;
  }
}

/**
 * Sends an SMS message using the active provider adapter or tenant-scoped config.
 * @param {string} to - Recipient phone number
 * @param {string} body - SMS text
 * @param {object} [options] - Optional routing options (tenantId, senderId, provider, etc.)
 * @returns {Promise<{ success: boolean, messageId?: string, provider?: string, error?: string }>}
 */
async function send(to, body, options = {}) {
  let provider = getActiveProvider();
  
  // If specific provider requested per tenant or payload
  if (options.provider && providers[options.provider]) {
    provider = providers[options.provider];
  }

  return provider.send(to, body, options);
}

function isConfigured() {
  const provider = getActiveProvider();
  return provider.isConfigured();
}

module.exports = {
  send,
  getActiveProvider,
  setActiveProvider,
  isConfigured,
  providers,
};
