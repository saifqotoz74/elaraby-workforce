// Enterprise ERP Base Adapter Contract
// Defines standard contracts for ERP synchronization (SAP, Oracle, REST, SFTP, Mock)

class BaseErpAdapter {
  constructor(name) {
    this.name = name;
  }

  isConfigured() {
    return false;
  }

  /**
   * Fetches employee master records from ERP.
   * @param {Object} [options] - { since, department, factory }
   * @returns {Promise<{ records: Array, count: number, source: string }>}
   */
  async fetchEmployees(options = {}) {
    throw new Error('fetchEmployees must be implemented by concrete ERP adapter');
  }

  /**
   * Fetches leave balances from ERP authoritative master.
   * @param {string[]} employeeIds
   * @returns {Promise<Array<{ employeeId: string, vacationBalance: number, asOf: Date }>>}
   */
  async fetchLeaveBalances(employeeIds = []) {
    throw new Error('fetchLeaveBalances must be implemented by concrete ERP adapter');
  }

  /**
   * Pushes approved leave request to ERP.
   * @param {Object} leaveRequest
   * @returns {Promise<{ success: boolean, externalReferenceId?: string, error?: string }>}
   */
  async pushLeaveApproval(leaveRequest) {
    throw new Error('pushLeaveApproval must be implemented by concrete ERP adapter');
  }

  /**
   * Fetches payroll summary data from ERP.
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{ summaries: Array, count: number }>}
   */
  async fetchPayrollSummaries(month, year) {
    throw new Error('fetchPayrollSummaries must be implemented by concrete ERP adapter');
  }
}

module.exports = BaseErpAdapter;
