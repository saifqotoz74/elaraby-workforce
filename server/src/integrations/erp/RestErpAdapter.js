const BaseErpAdapter = require('./BaseErpAdapter');

// Generic Enterprise REST ERP Adapter
class RestErpAdapter extends BaseErpAdapter {
  constructor() {
    super('rest');
  }

  isConfigured() {
    return !!(process.env.ERP_BASE_URL && (process.env.ERP_API_KEY || process.env.ERP_BEARER_TOKEN));
  }

  async fetchEmployees(options = {}) {
    if (!this.isConfigured()) return { records: [], count: 0, error: 'erp_not_configured' };

    const baseUrl = process.env.ERP_BASE_URL;
    const token = process.env.ERP_BEARER_TOKEN || process.env.ERP_API_KEY;

    try {
      const res = await fetch(`${baseUrl}/api/v1/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`erp_http_${res.status}`);
      const json = await res.json();
      return {
        records: json.data || json.employees || [],
        count: (json.data || json.employees || []).length,
        source: 'rest_erp',
      };
    } catch (err) {
      return { records: [], count: 0, error: err.message };
    }
  }

  async fetchLeaveBalances() {
    if (!this.isConfigured()) return [];
    return [];
  }

  async pushLeaveApproval(leaveRequest) {
    if (!this.isConfigured()) return { success: false, error: 'erp_not_configured' };
    return { success: true, externalReferenceId: `REST_ERP_${Date.now()}` };
  }

  async fetchPayrollSummaries() {
    if (!this.isConfigured()) return { summaries: [], count: 0 };
    return { summaries: [], count: 0 };
  }
}

module.exports = RestErpAdapter;
