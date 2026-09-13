// Phase 2: PostgreSQL Relational Schema, Repository & Migration Engine Verification
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { validateSourceData } = require('../scripts/migrate-json-to-postgres');
const repository = require('../src/db/repository');
const postgres = require('../src/db/postgres');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 2: POSTGRESQL & MIGRATION TEST SUITE ---');
  console.log('=============================================================');

  // Test 1: Relational Schema DDL integrity
  console.log('\n--- 1. Relational Schema DDL & Constraints Verification ---');
  const schemaFile = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
  assert.ok(fs.existsSync(schemaFile), 'schema.sql must exist');
  const ddl = fs.readFileSync(schemaFile, 'utf8');

  assert.ok(ddl.includes('CREATE TABLE IF NOT EXISTS employees'), 'Must define employees table');
  assert.ok(ddl.includes('vacation_balance NUMERIC(5, 1) NOT NULL DEFAULT 21.0 CHECK (vacation_balance >= 0)'), 'Must enforce non-negative vacation balance check constraint');
  assert.ok(ddl.includes('CREATE TABLE IF NOT EXISTS requests'), 'Must define requests table');
  assert.ok(ddl.includes('REFERENCES employees(id) ON DELETE CASCADE'), 'Must enforce employee foreign key cascading');
  assert.ok(ddl.includes('CREATE TABLE IF NOT EXISTS payroll'), 'Must define payroll table');
  assert.ok(ddl.includes('CONSTRAINT uq_payroll_emp_month_year UNIQUE'), 'Must enforce unique payroll constraint per employee/month/year');
  assert.ok(ddl.includes('CREATE INDEX IF NOT EXISTS idx_requests_status'), 'Must define status index');
  assert.ok(ddl.includes('CREATE INDEX IF NOT EXISTS idx_notifications_employee_id'), 'Must define notification index');
  console.log('✔ PostgreSQL Schema DDL, constraints, foreign keys, and indexes verified.');

  // Test 2: Migration Validator with real db.json
  console.log('\n--- 2. Deterministic Migration Validator on Real db.json ---');
  const dbFile = path.join(__dirname, '..', 'data', 'db.json');
  assert.ok(fs.existsSync(dbFile), 'db.json must exist');
  const rawDb = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

  const validation = validateSourceData(rawDb);
  assert.strictEqual(validation.malformedEmployees.length, 0, 'Zero malformed employees in source');
  assert.strictEqual(validation.malformedRequests.length, 0, 'Zero malformed requests in source');
  assert.strictEqual(validation.malformedPayroll.length, 0, 'Zero malformed payroll in source');
  assert.ok(validation.employeesCount >= 10, 'Must validate employee records');
  assert.ok(validation.requestsCount >= 50, 'Must validate request records');
  console.log(`✔ Source validation passed: ${validation.employeesCount} employees, ${validation.requestsCount} requests verified.`);

  // Test 3: Repository Dual-Mode Layer API
  console.log('\n--- 3. Repository Abstraction Dual-Mode Layer ---');
  const backend = repository.getBackend();
  assert.ok(backend === 'json' || backend === 'postgres', 'Backend must report active mode');

  const emp = await repository.findEmployeeById('emp_1');
  assert.ok(emp, 'Must find employee by ID');
  assert.strictEqual(emp.id, 'emp_1', 'Employee ID must match');

  const empByNat = await repository.findEmployeeByNationalId(emp.nationalId);
  assert.ok(empByNat, 'Must find employee by National ID');
  assert.strictEqual(empByNat.id, 'emp_1', 'National ID lookup must return correct employee');

  const listRes = await repository.listEmployees({ limit: 5 });
  assert.ok(Array.isArray(listRes.employees), 'List employees must return an array');
  assert.ok(listRes.total >= 1, 'Total count must be >= 1');
  console.log(`✔ Repository read operations verified across ${listRes.total} employee records.`);

  // Test 4: Transactional Leave Deduction and Rollback Protection
  console.log('\n--- 4. Transactional Balance Deduction & Over-Spend Protection ---');
  const testEmp = await repository.findEmployeeById('emp_1');
  const originalBalance = testEmp.vacationBalance;

  // Attempt deduction of 1 day
  const newBalance = await repository.deductVacationBalance('emp_1', 1);
  assert.strictEqual(newBalance, Math.round((originalBalance - 1) * 10) / 10, 'Balance must deduct 1 day');

  // Refund the 1 day
  const refunded = await repository.refundVacationBalance('emp_1', 1);
  assert.strictEqual(refunded, originalBalance, 'Balance must refund 1 day');

  // Attempt over-spend (> current balance)
  let overspendCaught = false;
  try {
    await repository.deductVacationBalance('emp_1', originalBalance + 100);
  } catch (err) {
    overspendCaught = true;
    assert.strictEqual(err.code, 'insufficient_balance', 'Must return insufficient_balance error code');
  }
  assert.ok(overspendCaught, 'Over-spend transaction must be rejected');

  // Verify balance was NOT mutated after failed overspend
  const checkEmp = await repository.findEmployeeById('emp_1');
  assert.strictEqual(checkEmp.vacationBalance, originalBalance, 'Balance must remain unchanged after rejected overspend');
  console.log('✔ Transactional vacation balance deduction and rollback protection verified.');

  // Test 5: PostgreSQL Pool Manager & Connectivity Safety
  console.log('\n--- 5. PostgreSQL Pool Configuration & Safety ---');
  const poolConfigured = postgres.isConfigured();
  assert.strictEqual(typeof poolConfigured, 'boolean');
  const health = await postgres.checkHealth();
  assert.ok(health.status === 'not_configured' || health.status === 'connected', 'Health check must return clean state');
  console.log(`✔ PostgreSQL connection manager state: ${health.status}.`);

  console.log('\n=============================================================');
  console.log('ALL PHASE 2 POSTGRESQL & MIGRATION TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 2 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
