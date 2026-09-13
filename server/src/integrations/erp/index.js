// Enterprise ERP Integration Boundary & Provider Resolver
const MockErpAdapter = require('./MockErpAdapter');
const SapAdapter = require('./SapAdapter');
const OracleAdapter = require('./OracleAdapter');
const RestErpAdapter = require('./RestErpAdapter');

const adapters = {
  mock: new MockErpAdapter(),
  sap: new SapAdapter(),
  oracle: new OracleAdapter(),
  rest: new RestErpAdapter(),
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
};
