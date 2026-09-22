#!/usr/bin/env node
'use strict';

/**
 * Enterprise PostgreSQL Database Migration CLI & Automation Runner
 * Sequentially applies versioned SQL migrations from server/src/db/migrations/
 * Tracks applied migrations in the schema_migrations table.
 * Supports: --status, --dry-run, and programmatic invocation.
 */

const fs = require('fs');
const path = require('path');
const postgres = require('../src/db/postgres');

const MIGRATIONS_DIR = path.resolve(__dirname, '../src/db/migrations');

async function ensureMigrationTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(pool) {
  await ensureMigrationTable(pool);
  const res = await pool.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC');
  return res.rows;
}

function getAvailableMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((file) => {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    const version = match ? parseInt(match[1], 10) : 0;
    const name = match ? match[2] : file.replace(/\.sql$/, '');
    const filePath = path.join(MIGRATIONS_DIR, file);
    return {
      filename: file,
      version,
      name,
      filePath,
    };
  }).sort((a, b) => a.version - b.version);
}

/**
 * Runs pending migrations sequentially inside atomic transactions.
 * @param {object} [options={}]
 * @param {boolean} [options.dryRun=false]
 * @param {boolean} [options.silent=false]
 * @returns {Promise<Array<string>>} List of applied migration names
 */
async function runPendingMigrations(options = {}) {
  const { dryRun = false, silent = false } = options;

  if (!postgres.isConfigured()) {
    if (!silent) console.log('[postgres:migrate] No DATABASE_URL configured. Skipping PostgreSQL migrations.');
    return [];
  }

  const pool = postgres.getPool();
  const applied = await getAppliedMigrations(pool);
  const appliedMap = new Map(applied.map((r) => [r.version, r]));
  const available = getAvailableMigrations();

  const pending = available.filter((m) => !appliedMap.has(m.version));

  if (pending.length === 0) {
    if (!silent) console.log('✔ [postgres:migrate] Database schema is up to date. Zero pending migrations.');
    return [];
  }

  if (!silent) {
    console.log(`[postgres:migrate] Found ${pending.length} pending migration(s):`);
    pending.forEach((m) => console.log(`  - [${m.version}] ${m.filename}`));
  }

  if (dryRun) {
    if (!silent) console.log('[postgres:migrate] --dry-run active. No changes executed.');
    return pending.map((m) => m.filename);
  }

  const appliedFiles = [];

  for (const m of pending) {
    if (!silent) console.log(`[postgres:migrate] Applying ${m.filename}...`);
    const sqlContent = fs.readFileSync(m.filePath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name, applied_at = CURRENT_TIMESTAMP`,
        [m.version, m.name]
      );
      await client.query('COMMIT');
      appliedFiles.push(m.filename);
      if (!silent) console.log(`✔ [postgres:migrate] Applied: ${m.filename}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ [postgres:migrate] Failed applying ${m.filename}:`, err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  return appliedFiles;
}

async function showStatus() {
  if (!postgres.isConfigured()) {
    console.log('[postgres:migrate] PostgreSQL is not configured (DATABASE_URL unset).');
    return;
  }

  const pool = postgres.getPool();
  const applied = await getAppliedMigrations(pool);
  const appliedMap = new Map(applied.map((r) => [r.version, r]));
  const available = getAvailableMigrations();

  console.log('\n=============================================================');
  console.log(' WORKFORCE OS — POSTGRESQL MIGRATION STATUS');
  console.log('=============================================================');
  console.log(`Available Migrations: ${available.length} | Applied: ${applied.length}\n`);

  available.forEach((m) => {
    const isApplied = appliedMap.has(m.version);
    const status = isApplied ? 'APPLIED' : 'PENDING';
    const mark = isApplied ? '✔' : '⏳';
    const appliedRecord = appliedMap.get(m.version);
    const dateStr = appliedRecord ? new Date(appliedRecord.applied_at).toISOString() : '';
    console.log(` ${mark} [${m.version.toString().padStart(3, '0')}] ${m.filename.padEnd(45)} | ${status.padEnd(8)} | ${dateStr}`);
  });
  console.log('=============================================================\n');
}

// CLI Execution Entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const isStatus = args.includes('--status');
  const isDryRun = args.includes('--dry-run');

  (async () => {
    try {
      if (isStatus) {
        await showStatus();
      } else {
        await runPendingMigrations({ dryRun: isDryRun });
      }
      await postgres.closePool();
      process.exit(0);
    } catch (err) {
      console.error('Fatal Migration Error:', err.message);
      await postgres.closePool();
      process.exit(1);
    }
  })();
}

module.exports = {
  runPendingMigrations,
  getAppliedMigrations,
  getAvailableMigrations,
  showStatus,
};
