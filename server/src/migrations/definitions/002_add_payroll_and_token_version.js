// Migration 002: Add tokenVersion and ensure initial payroll statements
module.exports = {
  version: 2,
  name: '002_add_payroll_and_token_version',
  up: (data) => {
    // 1. Ensure all employees have tokenVersion initialized
    if (Array.isArray(data.employees)) {
      for (const emp of data.employees) {
        if (typeof emp.tokenVersion !== 'number' || emp.tokenVersion < 1) {
          emp.tokenVersion = 1;
        }
      }
    }

    // 2. Ensure payroll collection exists
    if (!Array.isArray(data.payroll)) {
      data.payroll = [];
    }

    return true;
  },
};
