// Migration 001: Initial Schema and Core Collections
module.exports = {
  version: 1,
  name: '001_initial_schema',
  up: (data) => {
    // Ensure all baseline collections exist
    const collections = [
      'employees',
      'requests',
      'concerns',
      'announcements',
      'news',
      'benefits',
      'trips',
      'notifications',
      'payroll',
      'roster',
      'fcmTokens',
      'auditLogs',
      'otpCodes',
    ];

    for (const col of collections) {
      if (!Array.isArray(data[col])) {
        data[col] = [];
      }
    }

    if (!data.counters) {
      data.counters = { request: 100, notification: 100, audit: 100, concern: 100 };
    }

    return true;
  },
};
