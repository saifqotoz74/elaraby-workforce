// Enterprise PostgreSQL Connection Pool & Transaction Manager
// Features:
// - Connection pooling via pg.Pool with configurable pool sizing & statement timeout
// - Atomic multi-statement transaction runner with automatic ROLLBACK on failure
// - Production-safe SSL configuration
// - Startup connectivity and health check probes

const { Pool } = require('pg');

let _pool = null;
let _isConfigured = null;

function isConfigured() {
  if (_isConfigured !== null) return _isConfigured;
  _isConfigured = !!(process.env.DATABASE_URL || process.env.PGHOST || process.env.POSTGRES_URL);
  return _isConfigured;
}

function getPool() {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const config = {
    connectionString,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'elaraby_workforce',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '5000', 10),
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '10000', 10),
  };

  const isCloudPostgres = connectionString && (
    connectionString.includes('neon.tech') ||
    connectionString.includes('supabase') ||
    connectionString.includes('render.com') ||
    connectionString.includes('koyeb') ||
    connectionString.includes('amazonaws.com') ||
    connectionString.includes('sslmode=require')
  );

  if ((process.env.NODE_ENV === 'production' || isCloudPostgres) && !connectionString?.includes('localhost')) {
    config.ssl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };
  }

  _pool = new Pool(connectionString ? { connectionString, ...config } : config);

  _pool.on('error', (err) => {
    console.error('[postgres:pool] unexpected idle client error:', err.message);
  });

  return _pool;
}

const { getTenantContext } = require('../tenantContext');

/**
 * Executes a parameterized SQL query on the pool, binding ambient tenant RLS session variables if active.
 * @param {string} text - SQL query text
 * @param {Array} [params] - Query parameters
 */
async function query(text, params) {
  const pool = getPool();
  const tenantCtx = getTenantContext();
  const start = Date.now();

  // If no tenant context is bound (e.g. system probes, migrations), run directly on pool
  if (!tenantCtx) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`[postgres:slow_query] ${duration}ms: ${text.slice(0, 100)}`);
      }
      return res;
    } catch (err) {
      console.error('[postgres:query_error]', err.message, { query: text.slice(0, 100), params });
      throw err;
    }
  }

  // Scoped execution with transaction-isolated RLS session variables
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (tenantCtx.tenantId) {
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantCtx.tenantId]);
    }
    if (tenantCtx.isSuperAdmin && !tenantCtx.masqueraded) {
      await client.query("SET LOCAL app.is_super_admin = 'true'");
    }
    const res = await client.query(text, params);
    await client.query('COMMIT');
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[postgres:slow_query] ${duration}ms: ${text.slice(0, 100)}`);
    }
    return res;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('[postgres:query_error]', err.message, { query: text.slice(0, 100), params });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Runs a set of operations inside an atomic PostgreSQL transaction with ambient tenant RLS context.
 * @param {Function} callback - async (client) => result
 */
async function withTransaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  const tenantCtx = getTenantContext();
  try {
    await client.query('BEGIN');
    if (tenantCtx) {
      if (tenantCtx.tenantId) {
        await client.query('SET LOCAL app.current_tenant_id = $1', [tenantCtx.tenantId]);
      }
      if (tenantCtx.isSuperAdmin && !tenantCtx.masqueraded) {
        await client.query("SET LOCAL app.is_super_admin = 'true'");
      }
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[postgres:rollback_error]', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks PostgreSQL connectivity and returns connection statistics.
 */
async function checkHealth() {
  if (!isConfigured()) {
    return { status: 'not_configured', ok: false };
  }
  try {
    const start = Date.now();
    const res = await query('SELECT 1 AS check, current_database() AS db, version() AS version');
    const latency = Date.now() - start;
    return {
      status: 'connected',
      ok: true,
      latencyMs: latency,
      database: res.rows[0]?.db,
      totalCount: _pool?.totalCount || 0,
      idleCount: _pool?.idleCount || 0,
      waitingCount: _pool?.waitingCount || 0,
    };
  } catch (err) {
    return {
      status: 'error',
      ok: false,
      error: err.message,
    };
  }
}

/**
 * Gracefully shuts down connection pool on server termination.
 */
async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _isConfigured = null;
  }
}

/**
 * Automatically initializes PostgreSQL schema and runs pending migrations on startup.
 */
async function initializeSchema() {
  if (!isConfigured()) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const check = await query("SELECT to_regclass('public.tenants') AS tbl_exists");
    if (!check.rows[0]?.tbl_exists) {
      console.log('[postgres] First-time setup detected: initializing schema.sql on cloud database...');
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await query(schemaSql);
      console.log('✔ [postgres] Enterprise schema.sql applied successfully.');
    }

    // Automatically apply any pending incremental SQL migrations
    try {
      const { runPendingMigrations } = require('../../scripts/migrate-postgres');
      await runPendingMigrations({ silent: false });
    } catch (migErr) {
      console.error('[postgres:migrations_runner_error]', migErr.message);
    }
  } catch (err) {
    console.error('[postgres:initialize_schema_error]', err.message);
  }
}

// --- Kiosk / Shop Floor Domain Operations ---
async function createMachine(machineData) {
  const tenantId = machineData.tenantId;
  const id = machineData.id;
  const res = await query(
    `INSERT INTO machines (id, tenant_id, name, line, status, stop_reason, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id, id) DO UPDATE SET
       name = EXCLUDED.name,
       line = EXCLUDED.line,
       status = EXCLUDED.status,
       stop_reason = EXCLUDED.stop_reason,
       last_updated = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      id,
      tenantId,
      machineData.name,
      machineData.line,
      machineData.status || 'running',
      machineData.stopReason || null,
      machineData.lastUpdated ? new Date(machineData.lastUpdated) : new Date(),
    ]
  );
  return res.rows[0];
}

async function findMachineById(id, tenantId) {
  const res = await query(
    'SELECT * FROM machines WHERE tenant_id = $1 AND id = $2 LIMIT 1',
    [tenantId, id]
  );
  return res.rows[0] || null;
}

async function updateMachine(id, updateData, tenantId) {
  const fields = [];
  const values = [];
  let idx = 1;
  if (updateData.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(updateData.status);
  }
  if (updateData.stopReason !== undefined) {
    fields.push(`stop_reason = $${idx++}`);
    values.push(updateData.stopReason);
  }
  if (updateData.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(updateData.name);
  }
  if (updateData.line !== undefined) {
    fields.push(`line = $${idx++}`);
    values.push(updateData.line);
  }
  fields.push('last_updated = CURRENT_TIMESTAMP');
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(tenantId, id);
  const sql = `UPDATE machines SET ${fields.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx++} RETURNING *`;
  const res = await query(sql, values);
  return res.rows[0] || null;
}

async function listMachines(tenantId) {
  const res = await query(
    'SELECT * FROM machines WHERE tenant_id = $1 ORDER BY id ASC',
    [tenantId]
  );
  return res.rows;
}

async function createWorkOrder(orderData) {
  const res = await query(
    `INSERT INTO work_orders (id, tenant_id, title, target_qty, completed_qty, line, due_date, priority, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (tenant_id, id) DO UPDATE SET
       title = EXCLUDED.title,
       target_qty = EXCLUDED.target_qty,
       completed_qty = EXCLUDED.completed_qty,
       line = EXCLUDED.line,
       due_date = EXCLUDED.due_date,
       priority = EXCLUDED.priority,
       status = EXCLUDED.status,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      orderData.id,
      orderData.tenantId,
      orderData.title,
      orderData.targetQty || 0,
      orderData.completedQty || 0,
      orderData.line || '',
      orderData.dueDate || null,
      orderData.priority || 'normal',
      orderData.status || 'in_progress',
    ]
  );
  return res.rows[0];
}

async function findWorkOrderById(id, tenantId) {
  const res = await query(
    'SELECT * FROM work_orders WHERE tenant_id = $1 AND id = $2 LIMIT 1',
    [tenantId, id]
  );
  return res.rows[0] || null;
}

async function updateWorkOrder(id, updateData, tenantId) {
  const fields = [];
  const values = [];
  let idx = 1;
  if (updateData.completedQty !== undefined) {
    fields.push(`completed_qty = $${idx++}`);
    values.push(updateData.completedQty);
  }
  if (updateData.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(updateData.status);
  }
  if (updateData.priority !== undefined) {
    fields.push(`priority = $${idx++}`);
    values.push(updateData.priority);
  }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(tenantId, id);
  const sql = `UPDATE work_orders SET ${fields.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx++} RETURNING *`;
  const res = await query(sql, values);
  return res.rows[0] || null;
}

async function listWorkOrders(tenantId) {
  const res = await query(
    'SELECT * FROM work_orders WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId]
  );
  return res.rows;
}

async function createMachineStoppage(stoppageData) {
  const id = stoppageData.id || `stp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const res = await query(
    `INSERT INTO machine_stoppages (id, tenant_id, machine_id, reason, employee_code, status, reported_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      stoppageData.tenantId,
      stoppageData.machineId,
      stoppageData.reason,
      stoppageData.employeeCode || null,
      stoppageData.status || 'active',
      stoppageData.reportedAt ? new Date(stoppageData.reportedAt) : new Date(),
    ]
  );
  return res.rows[0];
}

async function listMachineStoppages(tenantId, filters = {}) {
  const conditions = ['tenant_id = $1'];
  const values = [tenantId];
  let idx = 2;
  if (filters.machineId) {
    conditions.push(`machine_id = $${idx++}`);
    values.push(filters.machineId);
  }
  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  const res = await query(
    `SELECT * FROM machine_stoppages WHERE ${conditions.join(' AND ')} ORDER BY reported_at DESC`,
    values
  );
  return res.rows;
}

async function resolveMachineStoppage(machineId, tenantId) {
  const res = await query(
    `UPDATE machine_stoppages
     SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND machine_id = $2 AND status = 'active'
     RETURNING *`,
    [tenantId, machineId]
  );
  return res.rows;
}

// --- HSE Domain Operations ---
async function createHsePermit(permitData) {
  const res = await query(
    `INSERT INTO hse_permits (id, tenant_id, employee_id, type, line, description, precautions, valid_until, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      permitData.id,
      permitData.tenantId,
      permitData.employeeId || null,
      permitData.type,
      permitData.line || null,
      permitData.description || null,
      JSON.stringify(permitData.precautions || []),
      permitData.validUntil ? new Date(permitData.validUntil) : null,
      permitData.status || 'pending',
    ]
  );
  return res.rows[0];
}

async function findHsePermitById(id, tenantId) {
  const res = await query(
    'SELECT * FROM hse_permits WHERE tenant_id = $1 AND id = $2 LIMIT 1',
    [tenantId, id]
  );
  return res.rows[0] || null;
}

async function updateHsePermit(id, updateData, tenantId) {
  const res = await query(
    `UPDATE hse_permits
     SET status = $1, reviewer = $2, reason = $3, decided_at = $4, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $5 AND id = $6
     RETURNING *`,
    [
      updateData.status,
      updateData.reviewer || null,
      updateData.reason || null,
      updateData.decidedAt ? new Date(updateData.decidedAt) : new Date(),
      tenantId,
      id,
    ]
  );
  return res.rows[0] || null;
}

async function listHsePermits(tenantId, filters = {}) {
  const conditions = ['tenant_id = $1'];
  const values = [tenantId];
  let idx = 2;
  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.employeeId) {
    conditions.push(`employee_id = $${idx++}`);
    values.push(filters.employeeId);
  }
  const res = await query(
    `SELECT * FROM hse_permits WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );
  return res.rows;
}

async function createHseIncident(incidentData) {
  const res = await query(
    `INSERT INTO hse_incidents (id, tenant_id, reporter_id, title, line, severity, description, injury_reported, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      incidentData.id,
      incidentData.tenantId,
      incidentData.reporterId || null,
      incidentData.title,
      incidentData.line || null,
      incidentData.severity || 'medium',
      incidentData.description || null,
      !!incidentData.injuryReported,
      incidentData.status || 'open',
    ]
  );
  return res.rows[0];
}

async function listHseIncidents(tenantId, filters = {}) {
  const conditions = ['tenant_id = $1'];
  const values = [tenantId];
  let idx = 2;
  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  const res = await query(
    `SELECT * FROM hse_incidents WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );
  return res.rows;
}

async function createHsePpeInspection(inspectionData) {
  const res = await query(
    `INSERT INTO hse_ppe_inspections (id, tenant_id, line, checklist, compliance_score, inspector_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      inspectionData.id,
      inspectionData.tenantId,
      inspectionData.line,
      JSON.stringify(inspectionData.checklist || {}),
      inspectionData.complianceScore ?? 100,
      inspectionData.inspectorId || null,
    ]
  );
  return res.rows[0];
}

async function listHsePpeInspections(tenantId, filters = {}) {
  const conditions = ['tenant_id = $1'];
  const values = [tenantId];
  let idx = 2;
  if (filters.line) {
    conditions.push(`line = $${idx++}`);
    values.push(filters.line);
  }
  const res = await query(
    `SELECT * FROM hse_ppe_inspections WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );
  return res.rows;
}

module.exports = {
  getPool,
  query,
  withTransaction,
  checkHealth,
  closePool,
  initializeSchema,
  isConfigured,
  // Kiosk / Shop floor domain queries
  createMachine,
  findMachineById,
  updateMachine,
  listMachines,
  createWorkOrder,
  findWorkOrderById,
  updateWorkOrder,
  listWorkOrders,
  createMachineStoppage,
  listMachineStoppages,
  resolveMachineStoppage,
  // HSE domain queries
  createHsePermit,
  findHsePermitById,
  updateHsePermit,
  listHsePermits,
  createHseIncident,
  listHseIncidents,
  createHsePpeInspection,
  listHsePpeInspections,
};
