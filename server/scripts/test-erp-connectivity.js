#!/usr/bin/env node
// Enterprise ERP Pre-Production Connectivity & Integration Test Harness
// Enables IT Operations & Enterprise Architecture teams to validate ERP endpoint reachability,
// OAuth2 handshake, and API contract compatibility before activating live sync.

require('../src/config').load();
const erp = require('../src/integrations/erp');

async function testConnectivity() {
  console.log('=============================================================');
  console.log('--- ENTERPRISE ERP CONNECTIVITY & INTEGRATION TEST HARNESS ---');
  console.log('=============================================================\n');

  const providerName = (process.env.ERP_PROVIDER || 'sap').toLowerCase().trim();
  const adapter = erp.adapters[providerName] || erp.getActiveAdapter();

  console.log(`Target ERP Provider: ${adapter.name.toUpperCase()}`);
  console.log(`Configured Status:   ${adapter.isConfigured() ? 'CONFIGURED' : 'UNCONFIGURED'}`);

  if (adapter.baseUrl) {
    console.log(`Endpoint Base URL:   ${adapter.baseUrl}`);
  }

  if (!adapter.isConfigured()) {
    console.warn('\n⚠️ [STATUS: UNCONFIGURED]');
    console.warn('  Missing enterprise environment variables:');
    if (providerName === 'sap') {
      console.warn('  - SAP_BASE_URL (e.g. https://sap-gateway.internal.elarabygroup.com)');
      console.warn('  - SAP_CLIENT_ID / SAP_CLIENT_SECRET');
    } else if (providerName === 'oracle') {
      console.warn('  - ORACLE_BASE_URL (e.g. https://hcm.internal.elarabygroup.com)');
      console.warn('  - ORACLE_CLIENT_ID / ORACLE_CLIENT_SECRET');
    }
    console.warn('\n[OPERATOR ACTION REQUIRED]: Provide credentials in .env.production to enable live ERP synchronization.');
    return { ok: false, reason: 'missing_credentials' };
  }

  console.log('\n--- Initiating Pre-Flight Health & Handshake Probe ---');
  const start = Date.now();

  try {
    const health = await adapter.checkHealth();
    const duration = Date.now() - start;

    if (health.ok) {
      console.log(`✔ [HANDSHAKE SUCCESS] ERP gateway responded cleanly (${duration}ms).`);
      console.log(`  Details: ${JSON.stringify(health)}`);
      return { ok: true };
    } else {
      console.error(`❌ [HANDSHAKE FAILED] ERP gateway error (${duration}ms): ${health.error}`);
      return { ok: false, error: health.error };
    }
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`❌ [NETWORK EXCEPTION] Could not reach ERP endpoint (${duration}ms): ${err.message}`);
    return { ok: false, error: err.message };
  }
}

if (require.main === module) {
  testConnectivity()
    .then((res) => {
      process.exit(res.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('Test harness crashed:', err);
      process.exit(1);
    });
}

module.exports = { testConnectivity };
