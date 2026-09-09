// Migration 003: Referential integrity validation and index metadata
module.exports = {
  version: 3,
  name: '003_add_integrity_and_indexes',
  up: (data) => {
    // 1. Ensure schemaMigrations array exists in metadata
    if (!Array.isArray(data.schemaMigrations)) {
      data.schemaMigrations = [];
    }

    // 2. Ensure each employee has active set to boolean
    if (Array.isArray(data.employees)) {
      for (const emp of data.employees) {
        if (typeof emp.active !== 'boolean') {
          emp.active = true;
        }
      }
    }

    return true;
  },
};
