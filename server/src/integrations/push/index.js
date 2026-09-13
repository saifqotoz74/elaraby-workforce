// Enterprise Push Notification Gateway & Factory
const MockPushProvider = require('./MockPushProvider');
const FirebasePushProvider = require('./FirebasePushProvider');

const providers = {
  mock: new MockPushProvider(),
  firebase: new FirebasePushProvider(),
};

let _activeProvider = null;

function getActiveProvider() {
  if (_activeProvider) return _activeProvider;

  const requested = (process.env.PUSH_PROVIDER || '').toLowerCase().trim();
  if (requested && providers[requested]) {
    _activeProvider = providers[requested];
    return _activeProvider;
  }

  if (providers.firebase.isConfigured()) {
    _activeProvider = providers.firebase;
  } else {
    _activeProvider = providers.mock;
  }

  return _activeProvider;
}

function setActiveProvider(nameOrInstance) {
  if (typeof nameOrInstance === 'string' && providers[nameOrInstance]) {
    _activeProvider = providers[nameOrInstance];
  } else if (nameOrInstance && typeof nameOrInstance.sendToToken === 'function') {
    _activeProvider = nameOrInstance;
  }
}

async function sendToToken(token, title, body, data = {}) {
  const provider = getActiveProvider();
  return provider.sendToToken(token, title, body, data);
}

async function sendMulticast(tokens, title, body, data = {}) {
  const provider = getActiveProvider();
  return provider.sendMulticast(tokens, title, body, data);
}

function isConfigured() {
  const provider = getActiveProvider();
  return provider.isConfigured();
}

module.exports = {
  sendToToken,
  sendMulticast,
  getActiveProvider,
  setActiveProvider,
  isConfigured,
  providers,
};
