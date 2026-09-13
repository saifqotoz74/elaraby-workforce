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

/**
 * Executes a parameterized SQL query on the pool.
 * @param {string} text - SQL query text
 * @param {Array} [params] - Query parameters
 */
async function query(text, params) {
  const pool = getPool();
  const start = Date.now();
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

/**
 * Runs a set of operations inside an atomic PostgreSQL transaction (BEGIN -> COMMIT / ROLLBACK).
 * @param {Function} callback - async (client) => result
 */
async function withTransaction(callback) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
 * Automatically initializes PostgreSQL schema if tables do not exist.
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
  } catch (err) {
    console.error('[postgres:initialize_schema_error]', err.message);
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  checkHealth,
  closePool,
  initializeSchema,
  isConfigured,
};
