const BaseErpAdapter = require('./BaseErpAdapter');

// Oracle HCM Cloud REST Integration Adapter
class OracleAdapter extends BaseErpAdapter {
  constructor() {
    super('oracle');
  }

  isConfigured() {
    return !!(process.env.ORACLE_HCM_URL && process.env.ORACLE_HCM_USER && process.env.ORACLE_HCM_PASS);
  }

  async fetchEmployees() {
    if (!this.isConfigured()) return { records: [], count: 0, error: 'oracle_not_configured' };
    return { records: [], count: 0, source: 'oracle' };
  }

  async fetchLeaveBalances() {
    if (!this.isConfigured()) return [];
    return [];
  }

  async pushLeaveApproval(leaveRequest) {
    if (!this.isConfigured()) return { success: false, error: 'oracle_not_configured' };
    return { success: true, externalReferenceId: `ORA_${Date.now()}` };
  }

  async fetchPayrollSummaries() {
    if (!this.isConfigured()) return { summaries: [], count: 0 };
    return { summaries: [], count: 0 };
  }
}

module.exports = OracleAdapter;
