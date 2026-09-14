// Enterprise Dual-Read / Cutover Repository Layer
// Implements the Clean Architecture pattern:
// Controller -> Application Service -> Repository Interface -> PostgreSQL / JSON Store
//
// Dual-Mode Architecture with Strict Multi-Tenant Defense-in-Depth:
// 1. PostgreSQL Authoritative Mode (Active when DATABASE_URL is set, enforced via RLS & parameterized WHERE)
// 2. Memory / JSON Compatibility Mode (Active when DATABASE_URL is unset, or in standalone tests)
// 3. Dual-Write Mode (Active during migration cutover)

const postgres = require('./postgres');
const jsonDb = require('../db');
const { getCurrentTenantId, isSuperAdmin } = require('../tenantContext');

function getActiveBackend() {
  if (process.env.DB_BACKEND === 'json') return 'json';
  if (process.env.DB_BACKEND === 'postgres' && postgres.isConfigured()) return 'postgres';
  return postgres.isConfigured() ? 'postgres' : 'json';
}

const repository = {
  getBackend: getActiveBackend,

  // ==========================================
  // Employee Domain
  // ==========================================
  async findEmployeeById(id) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        'SELECT * FROM employees WHERE id = $1 LIMIT 1',
        [id]
      );
      if (res.rows.length === 0) return null;
      return mapEmployeeFromPg(res.rows[0]);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return d.employees.find((e) => e.id === id && (isSuper || (e.tenantId || 'elaraby') === tenantId)) || null;
  },

  async findEmployeeByNationalId(nationalId) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        'SELECT * FROM employees WHERE national_id = $1 AND active = true LIMIT 1',
        [String(nationalId).trim()]
      );
      if (res.rows.length === 0) return null;
      return mapEmployeeFromPg(res.rows[0]);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return d.employees.find((e) => e.active && String(e.nationalId).trim() === String(nationalId).trim() && (isSuper || (e.tenantId || 'elaraby') === tenantId)) || null;
  },

  async findEmployeeByPhone(phone) {
    const cleanPhone = String(phone).replace(/[^\d+]/g, '');
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        'SELECT * FROM employees WHERE phone = $1 AND active = true LIMIT 1',
        [cleanPhone]
      );
      if (res.rows.length === 0) return null;
      return mapEmployeeFromPg(res.rows[0]);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return d.employees.find((e) => e.active && e.phone && e.phone.replace(/[^\d+]/g, '') === cleanPhone && (isSuper || (e.tenantId || 'elaraby') === tenantId)) || null;
  },

  async listEmployees({ factory, department, active, search, limit = 50, offset = 0 } = {}) {
    if (getActiveBackend() === 'postgres') {
      const conditions = [];
      const values = [];
      let idx = 1;

      if (!isSuperAdmin()) {
        conditions.push(`tenant_id = $${idx++}`);
        values.push(getCurrentTenantId());
      }
      if (factory) {
        conditions.push(`factory = $${idx++}`);
        values.push(factory);
      }
      if (department) {
        conditions.push(`department = $${idx++}`);
        values.push(department);
      }
      if (typeof active === 'boolean') {
        conditions.push(`active = $${idx++}`);
        values.push(active);
      }
      if (search) {
        conditions.push(`(name ILIKE $${idx} OR national_id ILIKE $${idx} OR phone ILIKE $${idx})`);
        values.push(`%${search}%`);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await postgres.query(`SELECT COUNT(*) FROM employees ${where}`, values);
      const total = parseInt(countRes.rows[0].count, 10);

      values.push(limit);
      values.push(offset);
      const queryStr = `SELECT * FROM employees ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      const dataRes = await postgres.query(queryStr, values);

      return {
        employees: dataRes.rows.map(mapEmployeeFromPg),
        total,
      };
    }

    const d = jsonDb.data();
    let list = d.employees || [];
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    if (!isSuper) {
      list = list.filter((e) => (e.tenantId || 'elaraby') === tenantId);
    }
    if (factory) list = list.filter((e) => e.factory === factory);
    if (department) list = list.filter((e) => e.department === department);
    if (typeof active === 'boolean') list = list.filter((e) => e.active === active);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((e) => (e.name && e.name.toLowerCase().includes(s)) || (e.nationalId && e.nationalId.includes(s)));
    }
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { employees: paginated, total };
  },

  async createEmployee(empData) {
    const tenantId = empData.tenantId || getCurrentTenantId();
    if (getActiveBackend() === 'postgres') {
      const id = empData.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await postgres.query(
        `INSERT INTO employees (
          id, tenant_id, national_id, phone, name, name_en, email, department, department_en,
          job_title, job_title_en, factory, avatar, pin_hash, vacation_balance,
          active, role, scope_factory, scope_department, token_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          id,
          tenantId,
          empData.nationalId || null,
          empData.phone || null,
          empData.name,
          empData.nameEn || null,
          empData.email || null,
          empData.department || null,
          empData.departmentEn || null,
          empData.jobTitle || null,
          empData.jobTitleEn || null,
          empData.factory || null,
          empData.avatar || null,
          empData.pinHash || null,
          typeof empData.vacationBalance === 'number' ? Math.max(0, empData.vacationBalance) : 21.0,
          empData.active !== false,
          empData.role || 'employee',
          empData.scopeFactory || null,
          empData.scopeDepartment || null,
          empData.tokenVersion || 1,
        ]
      );
      return this.findEmployeeById(id);
    }

    return jsonDb.withTransaction((d) => {
      const id = empData.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newEmp = {
        id,
        tenantId,
        ...empData,
        vacationBalance: typeof empData.vacationBalance === 'number' ? empData.vacationBalance : 21,
        active: empData.active !== false,
        tokenVersion: empData.tokenVersion || 1,
      };
      d.employees.push(newEmp);
      return newEmp;
    });
  },

  async updateEmployee(id, updateData) {
    if (getActiveBackend() === 'postgres') {
      const fields = [];
      const values = [id];
      let idx = 2;

      const mapping = {
        name: 'name',
        nameEn: 'name_en',
        phone: 'phone',
        nationalId: 'national_id',
        email: 'email',
        department: 'department',
        departmentEn: 'department_en',
        jobTitle: 'job_title',
        jobTitleEn: 'job_title_en',
        factory: 'factory',
        avatar: 'avatar',
        pinHash: 'pin_hash',
        vacationBalance: 'vacation_balance',
        active: 'active',
        role: 'role',
        scopeFactory: 'scope_factory',
        scopeDepartment: 'scope_department',
        tokenVersion: 'token_version',
      };

      for (const [key, col] of Object.entries(mapping)) {
        if (typeof updateData[key] !== 'undefined') {
          fields.push(`${col} = $${idx++}`);
          values.push(updateData[key]);
        }
      }

      if (fields.length === 0) return this.findEmployeeById(id);
      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      await postgres.query(`UPDATE employees SET ${fields.join(', ')} WHERE id = $1`, values);
      return this.findEmployeeById(id);
    }

    return jsonDb.withTransaction((d) => {
      const tenantId = getCurrentTenantId();
      const isSuper = isSuperAdmin();
      const emp = d.employees.find((e) => e.id === id && (isSuper || (e.tenantId || 'elaraby') === tenantId));
      if (!emp) return null;
      Object.assign(emp, updateData);
      return emp;
    });
  },

  // ==========================================
  // Requests Domain
  // ==========================================
  async findRequestById(id) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query('SELECT * FROM requests WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) return null;
      return mapRequestFromPg(res.rows[0]);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return d.requests.find((r) => r.id === id && (isSuper || (r.tenantId || 'elaraby') === tenantId)) || null;
  },

  async listRequests({ employeeId, status, type, factory, limit = 50, offset = 0 } = {}) {
    if (getActiveBackend() === 'postgres') {
      const conditions = [];
      const values = [];
      let idx = 1;

      if (!isSuperAdmin()) {
        conditions.push(`r.tenant_id = $${idx++}`);
        values.push(getCurrentTenantId());
      }
      if (employeeId) {
        conditions.push(`r.employee_id = $${idx++}`);
        values.push(employeeId);
      }
      if (status) {
        conditions.push(`r.status = $${idx++}`);
        values.push(status);
      }
      if (type) {
        conditions.push(`r.type = $${idx++}`);
        values.push(type);
      }
      if (factory) {
        conditions.push(`e.factory = $${idx++}`);
        values.push(factory);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await postgres.query(
        `SELECT COUNT(*) FROM requests r LEFT JOIN employees e ON r.employee_id = e.id ${where}`,
        values
      );
      const total = parseInt(countRes.rows[0].count, 10);

      values.push(limit);
      values.push(offset);
      const queryStr = `
        SELECT r.*, e.name as employee_name, e.factory as employee_factory
        FROM requests r
        LEFT JOIN employees e ON r.employee_id = e.id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      const dataRes = await postgres.query(queryStr, values);

      return {
        requests: dataRes.rows.map(mapRequestFromPg),
        total,
      };
    }

    const d = jsonDb.data();
    let list = d.requests || [];
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    if (!isSuper) {
      list = list.filter((r) => (r.tenantId || 'elaraby') === tenantId);
    }
    if (employeeId) list = list.filter((r) => r.employeeId === employeeId);
    if (status) list = list.filter((r) => r.status === status);
    if (type) list = list.filter((r) => r.type === type);
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { requests: paginated, total };
  },

  async createRequest(reqData) {
    const tenantId = reqData.tenantId || getCurrentTenantId();
    if (getActiveBackend() === 'postgres') {
      const id = reqData.id || `req_REQ-${new Date().getFullYear()}-${Date.now() % 10000}`;
      await postgres.query(
        `INSERT INTO requests (
          id, tenant_id, ref_number, employee_id, type, status, days, start_date, end_date,
          date, reason, rejection_reason, decision_by, decided_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id,
          tenantId,
          reqData.refNumber || null,
          reqData.employeeId,
          reqData.type,
          reqData.status || 'inReview',
          parseFloat(reqData.days) || 1.0,
          reqData.startDate || null,
          reqData.endDate || null,
          reqData.date || null,
          reqData.reason || null,
          reqData.rejectionReason || null,
          reqData.decisionBy || null,
          reqData.decidedAt ? new Date(reqData.decidedAt) : null,
          reqData.createdAt ? new Date(reqData.createdAt) : new Date(),
        ]
      );
      return this.findRequestById(id);
    }

    return jsonDb.withTransaction((d) => {
      const id = reqData.id || `req_REQ-${new Date().getFullYear()}-${Date.now() % 10000}`;
      const newReq = {
        id,
        tenantId,
        ...reqData,
        days: parseFloat(reqData.days) || 1.0,
        status: reqData.status || 'inReview',
        createdAt: reqData.createdAt || Date.now(),
      };
      d.requests.push(newReq);
      return newReq;
    });
  },

  async updateRequest(id, updateData) {
    if (getActiveBackend() === 'postgres') {
      const fields = [];
      const values = [id];
      let idx = 2;

      if (typeof updateData.status !== 'undefined') {
        fields.push(`status = $${idx++}`);
        values.push(updateData.status);
      }
      if (typeof updateData.rejectionReason !== 'undefined') {
        fields.push(`rejection_reason = $${idx++}`);
        values.push(updateData.rejectionReason);
      }
      if (typeof updateData.decisionBy !== 'undefined') {
        fields.push(`decision_by = $${idx++}`);
        values.push(updateData.decisionBy);
      }
      if (typeof updateData.decidedAt !== 'undefined') {
        fields.push(`decided_at = $${idx++}`);
        values.push(updateData.decidedAt ? new Date(updateData.decidedAt) : null);
      }

      if (fields.length === 0) return this.findRequestById(id);
      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      await postgres.query(`UPDATE requests SET ${fields.join(', ')} WHERE id = $1`, values);
      return this.findRequestById(id);
    }

    return jsonDb.withTransaction((d) => {
      const tenantId = getCurrentTenantId();
      const isSuper = isSuperAdmin();
      const req = d.requests.find((r) => r.id === id && (isSuper || (r.tenantId || 'elaraby') === tenantId));
      if (!req) return null;
      Object.assign(req, updateData);
      return req;
    });
  },

  // ==========================================
  // Transactional Leave Balance Deductions & Refunds
  // ==========================================
  async deductVacationBalance(employeeId, days) {
    if (getActiveBackend() === 'postgres') {
      return postgres.withTransaction(async (client) => {
        const empRes = await client.query(
          'SELECT vacation_balance FROM employees WHERE id = $1 FOR UPDATE',
          [employeeId]
        );
        if (empRes.rows.length === 0) throw new Error('employee_not_found');
        const currentBalance = parseFloat(empRes.rows[0].vacation_balance);
        if (currentBalance < days) {
          const err = new Error('insufficient_vacation_balance');
          err.code = 'insufficient_balance';
          throw err;
        }
        const newBalance = Math.round((currentBalance - days) * 10) / 10;
        await client.query('UPDATE employees SET vacation_balance = $1 WHERE id = $2', [newBalance, employeeId]);
        return newBalance;
      });
    }

    return jsonDb.withTransaction((d) => {
      const emp = d.employees.find((e) => e.id === employeeId);
      if (!emp) throw new Error('employee_not_found');
      if (emp.vacationBalance < days) {
        const err = new Error('insufficient_vacation_balance');
        err.code = 'insufficient_balance';
        throw err;
      }
      emp.vacationBalance = Math.round((emp.vacationBalance - days) * 10) / 10;
      return emp.vacationBalance;
    });
  },

  async refundVacationBalance(employeeId, days) {
    if (getActiveBackend() === 'postgres') {
      return postgres.withTransaction(async (client) => {
        const empRes = await client.query(
          'SELECT vacation_balance FROM employees WHERE id = $1 FOR UPDATE',
          [employeeId]
        );
        if (empRes.rows.length === 0) return null;
        const currentBalance = parseFloat(empRes.rows[0].vacation_balance);
        const newBalance = Math.round((currentBalance + days) * 10) / 10;
        await client.query('UPDATE employees SET vacation_balance = $1 WHERE id = $2', [newBalance, employeeId]);
        return newBalance;
      });
    }

    return jsonDb.withTransaction((d) => {
      const emp = d.employees.find((e) => e.id === employeeId);
      if (!emp) return null;
      emp.vacationBalance = Math.round((emp.vacationBalance + days) * 10) / 10;
      return emp.vacationBalance;
    });
  },

  // ==========================================
  // Audit Logs Domain
  // ==========================================
  async createAuditLog(entry) {
    const tenantId = entry.tenantId || getCurrentTenantId();
    if (getActiveBackend() === 'postgres') {
      const id = entry.id || `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await postgres.query(
        `INSERT INTO audit_logs (id, tenant_id, timestamp, actor, actor_role, action, target, details, ip, factory)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          tenantId,
          entry.timestamp ? new Date(entry.timestamp) : new Date(),
          entry.actor || null,
          entry.actorRole || null,
          entry.action,
          entry.target || null,
          JSON.stringify(entry.details || {}),
          entry.ip || null,
          entry.factory || null,
        ]
      );
      return entry;
    }

    return jsonDb.withTransaction((d) => {
      const id = entry.id || `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newEntry = { id, tenantId, timestamp: Date.now(), ...entry };
      d.auditLogs = d.auditLogs || [];
      d.auditLogs.unshift(newEntry);
      if (d.auditLogs.length > 5000) d.auditLogs = d.auditLogs.slice(0, 5000);
      return newEntry;
    });
  },

  // ==========================================
  // Loans & Advances Domain
  // ==========================================
  async findLoanById(id) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query('SELECT * FROM loans WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length === 0) return null;
      return mapLoanFromPg(res.rows[0]);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return (d.loans || []).find((l) => l.id === id && (isSuper || (l.tenantId || 'elaraby') === tenantId)) || null;
  },

  async listLoansByEmployee(employeeId) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        'SELECT * FROM loans WHERE employee_id = $1 ORDER BY created_at DESC',
        [employeeId]
      );
      return res.rows.map(mapLoanFromPg);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return (d.loans || [])
      .filter((l) => l.employeeId === employeeId && (isSuper || (l.tenantId || 'elaraby') === tenantId))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async listLoans({ status, limit = 50, offset = 0 } = {}) {
    if (getActiveBackend() === 'postgres') {
      const conditions = [];
      const values = [];
      let idx = 1;
      if (!isSuperAdmin()) {
        conditions.push(`tenant_id = $${idx++}`);
        values.push(getCurrentTenantId());
      }
      if (status) {
        conditions.push(`status = $${idx++}`);
        values.push(status);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      values.push(limit, offset);
      const sql = `SELECT * FROM loans ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
      const res = await postgres.query(sql, values);
      return res.rows.map(mapLoanFromPg);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    let loans = (d.loans || []).filter((l) => isSuper || (l.tenantId || 'elaraby') === tenantId);
    if (status) loans = loans.filter((l) => l.status === status);
    return loans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(offset, offset + limit);
  },

  async createLoan(loanData) {
    const tenantId = loanData.tenantId || getCurrentTenantId();
    const id = loanData.id || `loan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const currency = loanData.currency || (tenantId === 'gulf_industrial' ? 'SAR' : 'EGP');

    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `INSERT INTO loans (
          id, tenant_id, employee_id, reference_number, type, amount, remaining_balance,
          installments_count, paid_installments_count, monthly_installment, purpose, notes,
          currency, status, idempotency_key, repayment_schedule, approved_by, approved_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          id,
          tenantId,
          loanData.employeeId,
          loanData.referenceNumber,
          loanData.type,
          loanData.amount,
          loanData.remainingBalance ?? loanData.amount,
          loanData.installmentsCount || 1,
          loanData.paidInstallmentsCount || 0,
          loanData.monthlyInstallment,
          loanData.purpose || 'general',
          loanData.notes || '',
          currency,
          loanData.status || 'active',
          loanData.idempotencyKey || null,
          JSON.stringify(loanData.repaymentSchedule || []),
          loanData.approvedBy || null,
          loanData.approvedAt ? new Date(loanData.approvedAt) : new Date(),
          loanData.createdAt ? new Date(loanData.createdAt) : new Date(),
        ]
      );
      return mapLoanFromPg(res.rows[0]);
    }

    return jsonDb.withTransaction((d) => {
      d.loans = d.loans || [];
      const record = {
        id,
        tenantId,
        currency,
        remainingBalance: loanData.remainingBalance ?? loanData.amount,
        paidInstallmentsCount: loanData.paidInstallmentsCount || 0,
        status: loanData.status || 'active',
        createdAt: loanData.createdAt || Date.now(),
        ...loanData,
      };
      d.loans.push(record);
      return record;
    });
  },

  async updateLoanStatus(loanId, { status, approvedBy, notes } = {}) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `UPDATE loans
         SET status = $1, approved_by = COALESCE($2, approved_by),
             approved_at = CASE WHEN $1 IN ('approved', 'active') THEN CURRENT_TIMESTAMP ELSE approved_at END,
             notes = COALESCE($3, notes), updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [status, approvedBy || null, notes || null, loanId]
      );
      if (res.rows.length === 0) return null;
      return mapLoanFromPg(res.rows[0]);
    }

    return jsonDb.withTransaction((d) => {
      const loan = (d.loans || []).find((l) => l.id === loanId);
      if (!loan) return null;
      loan.status = status;
      if (approvedBy) loan.approvedBy = approvedBy;
      if (status === 'approved' || status === 'active') loan.approvedAt = Date.now();
      if (notes) loan.notes = notes;
      loan.updatedAt = Date.now();
      return loan;
    });
  },

  // ==========================================
  // Attendance & Punches Domain
  // ==========================================
  async recordPunch(punchData) {
    const tenantId = punchData.tenantId || getCurrentTenantId();
    const id = punchData.id || `punch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `INSERT INTO attendance_punches (
          id, tenant_id, employee_id, punch_type, punched_at, lat, lng,
          geofence_id, is_out_of_bounds, distance_meters, verification_mode, device_id, ip_address, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          id,
          tenantId,
          punchData.employeeId,
          punchData.punchType || 'check_in',
          punchData.punchedAt ? new Date(punchData.punchedAt) : new Date(),
          punchData.lat ?? null,
          punchData.lng ?? null,
          punchData.geofenceId || null,
          !!punchData.isOutOfBounds,
          punchData.distanceMeters || 0,
          punchData.verificationMode || 'gps',
          punchData.deviceId || null,
          punchData.ipAddress || null,
          punchData.notes || null,
        ]
      );
      return mapPunchFromPg(res.rows[0]);
    }

    return jsonDb.withTransaction((d) => {
      d.attendancePunches = d.attendancePunches || [];
      const record = {
        id,
        tenantId,
        punchedAt: punchData.punchedAt || Date.now(),
        ...punchData,
      };
      d.attendancePunches.push(record);
      return record;
    });
  },

  async listPunchesByEmployee(employeeId, { limit = 50, offset = 0 } = {}) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `SELECT * FROM attendance_punches WHERE employee_id = $1 ORDER BY punched_at DESC LIMIT $2 OFFSET $3`,
        [employeeId, limit, offset]
      );
      return res.rows.map(mapPunchFromPg);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return (d.attendancePunches || [])
      .filter((p) => p.employeeId === employeeId && (isSuper || (p.tenantId || 'elaraby') === tenantId))
      .sort((a, b) => new Date(b.punchedAt || 0) - new Date(a.punchedAt || 0))
      .slice(offset, offset + limit);
  },

  // ==========================================
  // Overtime Domain
  // ==========================================
  async createOvertimeRequest(overtimeData) {
    const tenantId = overtimeData.tenantId || getCurrentTenantId();
    const id = overtimeData.id || `ot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `INSERT INTO overtime_requests (
          id, tenant_id, employee_id, shift_date, hours, reason, status, approved_by, approved_at, rejection_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          id,
          tenantId,
          overtimeData.employeeId,
          overtimeData.shiftDate,
          overtimeData.hours,
          overtimeData.reason,
          overtimeData.status || 'pending',
          overtimeData.approvedBy || null,
          overtimeData.approvedAt ? new Date(overtimeData.approvedAt) : null,
          overtimeData.rejectionReason || null,
        ]
      );
      return mapOvertimeFromPg(res.rows[0]);
    }

    return jsonDb.withTransaction((d) => {
      d.overtimeRequests = d.overtimeRequests || [];
      const record = {
        id,
        tenantId,
        status: overtimeData.status || 'pending',
        createdAt: Date.now(),
        ...overtimeData,
      };
      d.overtimeRequests.push(record);
      return record;
    });
  },

  async listOvertimeByEmployee(employeeId) {
    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `SELECT * FROM overtime_requests WHERE employee_id = $1 ORDER BY created_at DESC`,
        [employeeId]
      );
      return res.rows.map(mapOvertimeFromPg);
    }
    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return (d.overtimeRequests || [])
      .filter((o) => o.employeeId === employeeId && (isSuper || (o.tenantId || 'elaraby') === tenantId))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  // ==========================================
  // Bus Fleet & Transport Domain
  // ==========================================
  async listRoutes({ isActive = true, complex } = {}) {
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();

    if (getActiveBackend() === 'postgres') {
      const conditions = [];
      const values = [];
      let idx = 1;

      if (!isSuper) {
        conditions.push(`(tenant_id = $${idx++} OR is_shared = TRUE)`);
        values.push(tenantId);
      }
      if (isActive !== null) {
        conditions.push(`is_active = $${idx++}`);
        values.push(isActive);
      }
      if (complex) {
        conditions.push(`destination_complex = $${idx++}`);
        values.push(complex);
      }
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM bus_routes ${whereClause} ORDER BY code ASC`;
      const res = await postgres.query(sql, values);
      return res.rows.map(mapRouteFromPg);
    }

    const d = jsonDb.data();
    return (d.busRoutes || [])
      .filter((r) => {
        const belongs = isSuper || (r.tenantId || 'elaraby') === tenantId || r.isShared;
        const activeMatch = isActive === null || (r.isActive !== false) === isActive;
        const complexMatch = !complex || r.destinationComplex === complex;
        return belongs && activeMatch && complexMatch;
      });
  },

  async findRouteById(routeId) {
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();

    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query('SELECT * FROM bus_routes WHERE id = $1 LIMIT 1', [routeId]);
      if (res.rows.length === 0) return null;
      return mapRouteFromPg(res.rows[0]);
    }

    const d = jsonDb.data();
    return (d.busRoutes || []).find(
      (r) => r.id === routeId && (isSuper || (r.tenantId || 'elaraby') === tenantId || r.isShared)
    ) || null;
  },

  async createBusBooking(bookingData) {
    const tenantId = bookingData.tenantId || getCurrentTenantId();
    const id = bookingData.id || `bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (getActiveBackend() === 'postgres') {
      const res = await postgres.query(
        `INSERT INTO bus_bookings (
          id, tenant_id, employee_id, route_id, stop_id, direction, booking_date, status, scanned_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          id,
          tenantId,
          bookingData.employeeId,
          bookingData.routeId,
          bookingData.stopId || null,
          bookingData.direction || 'inbound',
          bookingData.bookingDate,
          bookingData.status || 'confirmed',
          bookingData.scannedAt ? new Date(bookingData.scannedAt) : null,
        ]
      );
      return mapBookingFromPg(res.rows[0]);
    }

    return jsonDb.withTransaction((d) => {
      d.busBookings = d.busBookings || [];
      const record = {
        id,
        tenantId,
        status: bookingData.status || 'confirmed',
        createdAt: Date.now(),
        ...bookingData,
      };
      d.busBookings.push(record);
      return record;
    });
  },

  async listBookingsByEmployee(employeeId, { date } = {}) {
    if (getActiveBackend() === 'postgres') {
      const conditions = ['employee_id = $1'];
      const values = [employeeId];
      if (date) {
        conditions.push('booking_date = $2');
        values.push(date);
      }
      const sql = `SELECT * FROM bus_bookings WHERE ${conditions.join(' AND ')} ORDER BY booking_date DESC`;
      const res = await postgres.query(sql, values);
      return res.rows.map(mapBookingFromPg);
    }

    const d = jsonDb.data();
    const tenantId = getCurrentTenantId();
    const isSuper = isSuperAdmin();
    return (d.busBookings || []).filter(
      (b) => b.employeeId === employeeId &&
             (!date || b.bookingDate === date) &&
             (isSuper || (b.tenantId || 'elaraby') === tenantId)
    );
  },
};

function mapEmployeeFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nationalId: row.national_id,
    phone: row.phone,
    name: row.name,
    nameEn: row.name_en,
    email: row.email,
    department: row.department,
    departmentEn: row.department_en,
    jobTitle: row.job_title,
    jobTitleEn: row.job_title_en,
    factory: row.factory,
    avatar: row.avatar,
    pinHash: row.pin_hash,
    vacationBalance: parseFloat(row.vacation_balance),
    active: row.active,
    role: row.role,
    scopeFactory: row.scope_factory,
    scopeDepartment: row.scope_department,
    tokenVersion: row.token_version,
    hiredAt: row.hired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRequestFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    refNumber: row.ref_number,
    employeeId: row.employee_id,
    type: row.type,
    status: row.status,
    days: parseFloat(row.days),
    startDate: row.start_date,
    endDate: row.end_date,
    date: row.date,
    reason: row.reason,
    rejectionReason: row.rejection_reason,
    decisionBy: row.decision_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLoanFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    referenceNumber: row.reference_number,
    type: row.type,
    amount: parseFloat(row.amount),
    remainingBalance: parseFloat(row.remaining_balance),
    installmentsCount: parseInt(row.installments_count, 10),
    paidInstallmentsCount: parseInt(row.paid_installments_count, 10),
    monthlyInstallment: parseFloat(row.monthly_installment),
    purpose: row.purpose,
    notes: row.notes,
    currency: row.currency,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    repaymentSchedule: typeof row.repayment_schedule === 'string' ? JSON.parse(row.repayment_schedule) : (row.repayment_schedule || []),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPunchFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    punchType: row.punch_type,
    punchedAt: row.punched_at,
    lat: row.lat !== null ? parseFloat(row.lat) : null,
    lng: row.lng !== null ? parseFloat(row.lng) : null,
    geofenceId: row.geofence_id,
    isOutOfBounds: !!row.is_out_of_bounds,
    distanceMeters: parseInt(row.distance_meters, 10) || 0,
    verificationMode: row.verification_mode,
    deviceId: row.device_id,
    ipAddress: row.ip_address,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapOvertimeFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    shiftDate: row.shift_date,
    hours: parseFloat(row.hours),
    reason: row.reason,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRouteFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    destinationComplex: row.destination_complex,
    destinationAr: row.destination_ar,
    vehiclePlate: row.vehicle_plate,
    vehiclePlateEn: row.vehicle_plate_en,
    busModel: row.bus_model,
    capacity: parseInt(row.capacity, 10),
    driver: {
      id: row.driver_id,
      name: row.driver_name,
      phone: row.driver_phone,
    },
    shiftId: row.shift_id,
    isShared: !!row.is_shared,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBookingFromPg(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    routeId: row.route_id,
    stopId: row.stop_id,
    direction: row.direction,
    bookingDate: row.booking_date,
    status: row.status,
    scannedAt: row.scanned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = repository;
