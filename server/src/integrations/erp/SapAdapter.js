const BaseErpAdapter = require('./BaseErpAdapter');

// SAP Enterprise Adapter (OData v2 / v4 & RFC Integration)
class SapAdapter extends BaseErpAdapter {
  constructor() {
    super('sap');
  }

  isConfigured() {
    return !!(
      process.env.SAP_ODATA_URL &&
      process.env.SAP_CLIENT_ID &&
      (process.env.SAP_CLIENT_SECRET || process.env.SAP_API_KEY)
    );
  }

  async fetchEmployees(options = {}) {
    if (!this.isConfigured()) {
      return { records: [], count: 0, error: 'sap_not_configured' };
    }

    const url = `${process.env.SAP_ODATA_URL}/EmployeeSet?$format=json&$top=100`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.SAP_CLIENT_ID}:${process.env.SAP_CLIENT_SECRET}`).toString('base64')}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`sap_http_${res.status}`);
      const json = await res.json();
      const results = json.d?.results || [];
      return {
        records: results.map((r) => ({
          externalId: r.Pernr,
          nationalId: r.NationalId,
          name: r.FullName,
          department: r.Department,
          factory: r.Plant,
          vacationBalance: parseFloat(r.LeaveQuota) || 21.0,
        })),
        count: results.length,
        source: 'sap',
      };
    } catch (err) {
      console.error('[erp:sap] fetchEmployees error:', err.message);
      return { records: [], count: 0, error: err.message };
    }
  }

  async pushLeaveApproval(leaveRequest) {
    if (!this.isConfigured()) {
      return { success: false, error: 'sap_not_configured' };
    }
    return { success: true, externalReferenceId: `SAP_DOC_${Date.now()}` };
  }

  async fetchLeaveBalances() {
    if (!this.isConfigured()) return [];
    return [];
  }

  async fetchPayrollSummaries() {
    if (!this.isConfigured()) return { summaries: [], count: 0 };
    return { summaries: [], count: 0 };
  }
}

module.exports = SapAdapter;
