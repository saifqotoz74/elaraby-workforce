const BaseErpAdapter = require('./BaseErpAdapter');

class MockErpAdapter extends BaseErpAdapter {
  constructor() {
    super('mock');
    this.employees = [
      {
        externalId: 'ERP_EMP_001',
        nationalId: '29801011234567',
        name: 'أحمد محمود العربي',
        nameEn: 'Ahmed Mahmoud Elaraby',
        department: 'Engineering',
        factory: 'Qwesna Complex',
        jobTitle: 'Senior Industrial Automation Engineer',
        vacationBalance: 24.5,
        status: 'active',
      },
      {
        externalId: 'ERP_EMP_002',
        nationalId: '29505051234568',
        name: 'محمد إبراهيم خليل',
        nameEn: 'Mohamed Ibrahim Khalil',
        department: 'Quality Assurance',
        factory: 'Benha Factory',
        jobTitle: 'Lead QA Specialist',
        vacationBalance: 18.0,
        status: 'active',
      },
    ];
    this.pushedLeaves = [];
  }

  isConfigured() {
    return true; // Mock is always available
  }

  async fetchEmployees(options = {}) {
    let list = [...this.employees];
    if (options.factory) {
      list = list.filter((e) => e.factory === options.factory);
    }
    return {
      records: list,
      count: list.length,
      source: 'mock_erp',
      timestamp: Date.now(),
    };
  }

  async fetchLeaveBalances(employeeIds = []) {
    return this.employees
      .filter((e) => employeeIds.length === 0 || employeeIds.includes(e.externalId))
      .map((e) => ({
        employeeId: e.externalId,
        nationalId: e.nationalId,
        vacationBalance: e.vacationBalance,
        asOf: new Date(),
      }));
  }

  async pushLeaveApproval(leaveRequest) {
    const externalReferenceId = `ERP_LEAVE_REF_${Date.now()}`;
    this.pushedLeaves.push({
      externalReferenceId,
      leaveRequest,
      syncedAt: Date.now(),
    });
    return {
      success: true,
      externalReferenceId,
      provider: 'mock_erp',
    };
  }

  async fetchPayrollSummaries(month, year) {
    return {
      summaries: [
        {
          employeeId: 'ERP_EMP_001',
          month,
          year,
          baseSalary: 14500,
          allowances: 2500,
          deductions: 800,
          netSalary: 16200,
        },
      ],
      count: 1,
      source: 'mock_erp',
    };
  }
}

module.exports = MockErpAdapter;
