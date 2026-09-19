// Enterprise ERP Integration Boundary & Provider Resolver
const MockErpAdapter = require('./MockErpAdapter');
const SapAdapter = require('./SapAdapter');
const OracleAdapter = require('./OracleAdapter');
const RestErpAdapter = require('./RestErpAdapter');
const SapSuccessFactorsConnector = require('./SapSuccessFactorsConnector');
const OracleFusionHcmConnector = require('./OracleFusionHcmConnector');

const connectors = {
  sap: new SapSuccessFactorsConnector(),
  oracle: new OracleFusionHcmConnector(),
};

const adapters = {
  mock: new MockErpAdapter(),
  sap: new SapAdapter(),
  oracle: new OracleAdapter(),
  rest: new RestErpAdapter(),
  sap_successfactors: connectors.sap,
  oracle_fusion: connectors.oracle,
};

let _activeAdapter = null;

function getActiveAdapter() {
  if (_activeAdapter) return _activeAdapter;

  const requested = (process.env.ERP_PROVIDER || '').toLowerCase().trim();
  if (requested && adapters[requested]) {
    _activeAdapter = adapters[requested];
    return _activeAdapter;
  }

  if (adapters.sap.isConfigured()) {
    _activeAdapter = adapters.sap;
  } else if (adapters.oracle.isConfigured()) {
    _activeAdapter = adapters.oracle;
  } else if (adapters.rest.isConfigured()) {
    _activeAdapter = adapters.rest;
  } else {
    _activeAdapter = adapters.mock;
  }

  return _activeAdapter;
}

function setActiveAdapter(nameOrInstance) {
  if (typeof nameOrInstance === 'string' && adapters[nameOrInstance]) {
    _activeAdapter = adapters[nameOrInstance];
  } else if (nameOrInstance && typeof nameOrInstance.fetchEmployees === 'function') {
    _activeAdapter = nameOrInstance;
  }
}

function getConnector(system = 'sap') {
  const clean = String(system || '').toLowerCase().trim();
  if (clean === 'sap' || clean === 'successfactors' || clean === 'sap_successfactors' || clean === 'sap_sf') {
    return connectors.sap;
  }
  if (clean === 'oracle' || clean === 'fusion' || clean === 'oracle_fusion' || clean === 'oracle_hcm') {
    return connectors.oracle;
  }
  throw new Error(`Unsupported ERP system: ${system}`);
}

function exportSchema(system, entity, records = [], tenantId = null) {
  const connector = getConnector(system);
  return connector.exportSchema(entity, records, tenantId);
}

async function sync(domain = 'employees', options = {}) {
  const adapter = getActiveAdapter();
  if (domain === 'employees') {
    return adapter.fetchEmployees(options);
  }
  if (domain === 'leave_balances') {
    return adapter.fetchLeaveBalances(options.employeeIds);
  }
  if (domain === 'payroll') {
    return adapter.fetchPayrollSummaries(options.month, options.year);
  }
  throw new Error(`Unsupported ERP sync domain: ${domain}`);
}

function isConfigured() {
  const adapter = getActiveAdapter();
  return adapter.isConfigured();
}

module.exports = {
  sync,
  getActiveAdapter,
  setActiveAdapter,
  isConfigured,
  adapters,
  connectors,
  getConnector,
  exportSchema,
  SapSuccessFactorsConnector,
  OracleFusionHcmConnector,
};
