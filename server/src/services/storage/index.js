// Enterprise Storage Factory & Service Gateway
const LocalStorageProvider = require('./LocalStorageProvider');
const S3StorageProvider = require('./S3StorageProvider');

const providers = {
  local: new LocalStorageProvider(),
  s3: new S3StorageProvider(),
};

let _activeProvider = null;

function getActiveProvider() {
  if (_activeProvider) return _activeProvider;

  const requested = (process.env.STORAGE_PROVIDER || '').toLowerCase().trim();
  if (requested && providers[requested]) {
    _activeProvider = providers[requested];
    return _activeProvider;
  }

  // In production, default to S3 if configured
  if (providers.s3.isConfigured()) {
    _activeProvider = providers.s3;
  } else {
    _activeProvider = providers.local;
  }

  return _activeProvider;
}

function setActiveProvider(nameOrInstance) {
  if (typeof nameOrInstance === 'string' && providers[nameOrInstance]) {
    _activeProvider = providers[nameOrInstance];
  } else if (nameOrInstance && typeof nameOrInstance.saveFile === 'function') {
    _activeProvider = nameOrInstance;
  }
}

async function saveFile(params) {
  const provider = getActiveProvider();
  return provider.saveFile(params);
}

async function getFile(key) {
  const provider = getActiveProvider();
  return provider.getFile(key);
}

async function deleteFile(key) {
  const provider = getActiveProvider();
  return provider.deleteFile(key);
}

async function checkHealth() {
  const provider = getActiveProvider();
  return provider.checkHealth();
}

function isConfigured() {
  const provider = getActiveProvider();
  return provider.isConfigured();
}

module.exports = {
  saveFile,
  getFile,
  deleteFile,
  checkHealth,
  isConfigured,
  getActiveProvider,
  setActiveProvider,
  providers,
};
