// Enterprise Dual-Read / Cutover Repository Layer
// Implements the Clean Architecture pattern:
// Controller -> Application Service -> Repository Interface -> PostgreSQL / JSON Store
//
// Dual-Mode Architecture:
// 1. PostgreSQL Authoritative Mode (Active when DATABASE_URL is set)
// 2. Memory / JSON Compatibility Mode (Active when DATABASE_URL is unset, or in standalone tests)
// 3. Dual-Write Mode (Active during migration cutover)

const postgres = require('./postgres');
const jsonDb = require('../db');

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
    return d.employees.find((e) => e.id === id) || null;
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
    return d.employees.find((e) => e.active && String(e.nationalId).trim() === String(nationalId).trim()) || null;
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
    return d.employees.find((e) => e.active && e.phone && e.phone.replace(/[^\d+]/g, '') === cleanPhone) || null;
  },

  async listEmployees({ factory, department, active, search, limit = 50, offset = 0 } = {}) {
    if (getActiveBackend() === 'postgres') {
      const conditions = [];
      const values = [];
      let idx = 1;

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
    if (getActiveBackend() === 'postgres') {
      const id = empData.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await postgres.query(
        `INSERT INTO employees (
          id, national_id, phone, name, name_en, email, department, department_en,
          job_title, job_title_en, factory, avatar, pin_hash, vacation_balance,
          active, role, scope_factory, scope_department, token_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          id,
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
      const emp = d.employees.find((e) => e.id === id);
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
    return d.requests.find((r) => r.id === id) || null;
  },

  async listRequests({ employeeId, status, type, factory, limit = 50, offset = 0 } = {}) {
    if (getActiveBackend() === 'postgres') {
      const conditions = [];
      const values = [];
      let idx = 1;

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
    if (employeeId) list = list.filter((r) => r.employeeId === employeeId);
    if (status) list = list.filter((r) => r.status === status);
    if (type) list = list.filter((r) => r.type === type);
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { requests: paginated, total };
  },

  async createRequest(reqData) {
    if (getActiveBackend() === 'postgres') {
      const id = reqData.id || `req_REQ-${new Date().getFullYear()}-${Date.now() % 10000}`;
      await postgres.query(
        `INSERT INTO requests (
          id, ref_number, employee_id, type, status, days, start_date, end_date,
          date, reason, rejection_reason, decision_by, decided_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          id,
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
      const req = d.requests.find((r) => r.id === id);
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
    if (getActiveBackend() === 'postgres') {
      const id = entry.id || `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await postgres.query(
        `INSERT INTO audit_logs (id, timestamp, actor, actor_role, action, target, details, ip, factory)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
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
      const newEntry = { id, timestamp: Date.now(), ...entry };
      d.auditLogs = d.auditLogs || [];
      d.auditLogs.unshift(newEntry);
      if (d.auditLogs.length > 5000) d.auditLogs = d.auditLogs.slice(0, 5000);
      return newEntry;
    });
  },
};

function mapEmployeeFromPg(row) {
  return {
    id: row.id,
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

module.exports = repository;
