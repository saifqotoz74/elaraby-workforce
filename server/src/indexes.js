// High-performance index manager for in-memory & file-backed collections.
// Maintains primary, unique, and foreign-key indices for O(1) lookups.

class IndexManager {
  constructor() {
    this.reset();
  }

  reset() {
    // Primary Key Indices (Map: id -> entity)
    this.employeesById = new Map();
    this.requestsById = new Map();
    this.benefitsById = new Map();
    this.tripsById = new Map();
    this.announcementsById = new Map();

    // Unique Secondary Key Indices
    this.employeesByNationalId = new Map();
    this.employeesByPhone = new Map();

    // Foreign Key Indices (Map: employeeId -> Array<entity>)
    this.requestsByEmployeeId = new Map();
    this.payrollByEmployeeId = new Map();
    this.rosterByEmployeeId = new Map();
    this.notificationsByEmployeeId = new Map();
  }

  /// Rebuilds all indexes from current database state
  rebuild(state) {
    this.reset();
    if (!state) return;

    // 1. Index Employees
    if (Array.isArray(state.employees)) {
      for (const emp of state.employees) {
        if (emp.id) this.employeesById.set(emp.id, emp);
        if (emp.nationalId) {
          const cleanNat = String(emp.nationalId).replace(/\D/g, '');
          this.employeesByNationalId.set(cleanNat, emp);
        }
        if (emp.phone) {
          const cleanPhone = String(emp.phone).replace(/\D/g, '');
          this.employeesByPhone.set(cleanPhone, emp);
          // Normalized local mobile format (01xxxxxxxxx vs 201xxxxxxxxx)
          if (cleanPhone.startsWith('20')) {
            this.employeesByPhone.set(cleanPhone.slice(2), emp);
          } else if (cleanPhone.startsWith('0')) {
            this.employeesByPhone.set(cleanPhone.slice(1), emp);
          }
        }
      }
    }

    // 2. Index Requests
    if (Array.isArray(state.requests)) {
      for (const req of state.requests) {
        if (req.id) this.requestsById.set(req.id, req);
        if (req.employeeId) {
          if (!this.requestsByEmployeeId.has(req.employeeId)) {
            this.requestsByEmployeeId.set(req.employeeId, []);
          }
          this.requestsByEmployeeId.get(req.employeeId).push(req);
        }
      }
    }

    // 3. Index Payroll
    if (Array.isArray(state.payroll)) {
      for (const pay of state.payroll) {
        if (pay.employeeId) {
          if (!this.payrollByEmployeeId.has(pay.employeeId)) {
            this.payrollByEmployeeId.set(pay.employeeId, []);
          }
          this.payrollByEmployeeId.get(pay.employeeId).push(pay);
        }
      }
    }

    // 4. Index Roster
    if (Array.isArray(state.roster)) {
      for (const ros of state.roster) {
        if (ros.employeeId) {
          if (!this.rosterByEmployeeId.has(ros.employeeId)) {
            this.rosterByEmployeeId.set(ros.employeeId, []);
          }
          this.rosterByEmployeeId.get(ros.employeeId).push(ros);
        }
      }
    }

    // 5. Index Benefits & Trips
    if (Array.isArray(state.benefits)) {
      for (const b of state.benefits) {
        if (b.id) this.benefitsById.set(b.id, b);
      }
    }
    if (Array.isArray(state.trips)) {
      for (const t of state.trips) {
        if (t.id) this.tripsById.set(t.id, t);
      }
    }
    if (Array.isArray(state.announcements)) {
      for (const a of state.announcements) {
        if (a.id) this.announcementsById.set(a.id, a);
      }
    }
  }

  // Lookup helpers
  getEmployeeById(id) {
    return this.employeesById.get(id) || null;
  }

  getEmployeeByNationalIdOrPhone(query) {
    if (!query) return null;
    const clean = String(query).replace(/\D/g, '');
    return this.employeesByNationalId.get(clean) || this.employeesByPhone.get(clean) || null;
  }

  getRequestsByEmployeeId(employeeId) {
    return this.requestsByEmployeeId.get(employeeId) || [];
  }

  getPayrollByEmployeeId(employeeId) {
    return this.payrollByEmployeeId.get(employeeId) || [];
  }

  getRosterByEmployeeId(employeeId) {
    return this.rosterByEmployeeId.get(employeeId) || [];
  }
}

const indexes = new IndexManager();

module.exports = {
  IndexManager,
  indexes,
};
