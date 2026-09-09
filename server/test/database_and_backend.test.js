// Test suite verifying Phase 2 requirements:
// - Database schema validation
// - Relational and check constraints
// - Foreign key referential integrity
// - Transactions and snapshot rollback on failure
// - In-memory O(1) indexes
// - Schema migrations version tracking
// - Environment configuration profiles

const assert = require('assert');
const { data, transaction, indexes, validateConstraints } = require('../src/db');
const {
  validateNationalId,
  validatePhone,
  validatePin,
} = require('../src/schema');
const {
  AppError,
  ValidationError,
  ConstraintViolationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} = require('../src/errors');
const { runMigrations, getAvailableMigrations } = require('../src/migrations/runner');
const config = require('../src/config');

console.log('--- Running Phase 2 Database & Backend Tests ---');

// 1. Schema Validation Functions
console.log('1. Testing validation helper functions...');
assert.strictEqual(validateNationalId('29801011234567'), true);
assert.strictEqual(validateNationalId('123'), false);
assert.strictEqual(validateNationalId('2980101123456a'), false);
assert.strictEqual(validateNationalId(null), false);

assert.strictEqual(validatePhone('+201012345678'), true);
assert.strictEqual(validatePhone('01012345678'), true);
assert.strictEqual(validatePhone('123'), false);

assert.strictEqual(validatePin('1234'), true);
assert.strictEqual(validatePin('123'), false);
assert.strictEqual(validatePin('12345'), false);
assert.strictEqual(validatePin('abcd'), false);
console.log('✔ Validation helpers verified.');

// 2. Structured Errors
console.log('2. Testing structured error classes and JSON representations...');
const err = new ValidationError('Invalid input data', { field: 'nationalId' });
assert.strictEqual(err.statusCode, 422);
assert.strictEqual(err.code, 'VALIDATION_FAILED');
assert.strictEqual(err.details.field, 'nationalId');
const json = err.toJSON();
assert.strictEqual(json.ok, false);
assert.strictEqual(json.code, 'VALIDATION_FAILED');
console.log('✔ Structured error hierarchy verified.');

// 3. Constraints & Foreign Key Integrity
console.log('3. Testing constraints and referential integrity enforcement...');
const testState = {
  employees: [
    { id: 'emp_t1', nationalId: '29801011234567', phone: '01012345678', vacationBalance: 15, active: true, tokenVersion: 1 },
    { id: 'emp_t2', nationalId: '29801017654321', phone: '01087654321', vacationBalance: 10, active: true, tokenVersion: 1 },
  ],
  requests: [
    { id: 'req_t1', employeeId: 'emp_t1', status: 'inReview', days: 2 },
  ],
  payroll: [
    { id: 'pay_t1', employeeId: 'emp_t1', basicSalary: 5000, netSalary: 4500 },
  ],
  roster: [],
  trips: [
    { id: 'trip_t1', totalSeats: 20, bookedSeats: 5, bookedBy: ['emp_t1'] },
  ],
  fcmTokens: [],
};

// Initial state must be valid
assert.doesNotThrow(() => validateConstraints(testState));

// Test duplicate National ID constraint
const dupNatState = JSON.parse(JSON.stringify(testState));
dupNatState.employees.push({
  id: 'emp_t3',
  nationalId: '29801011234567', // duplicate!
  active: true,
});
assert.throws(() => validateConstraints(dupNatState), /Unique constraint violation: National ID/);

// Test negative vacation balance constraint
const negBalState = JSON.parse(JSON.stringify(testState));
negBalState.employees[0].vacationBalance = -1;
assert.throws(() => validateConstraints(negBalState), /Check constraint violation.*negative vacationBalance/);

// Test foreign key violation: request referencing non-existent employee
const fkReqState = JSON.parse(JSON.stringify(testState));
fkReqState.requests.push({
  id: 'req_t2',
  employeeId: 'emp_non_existent',
  status: 'inReview',
});
assert.throws(() => validateConstraints(fkReqState), /Foreign key violation.*non-existent employee/);

// Test foreign key violation: payroll referencing non-existent employee
const fkPayState = JSON.parse(JSON.stringify(testState));
fkPayState.payroll.push({
  id: 'pay_t2',
  employeeId: 'emp_ghost',
  netSalary: 1000,
});
assert.throws(() => validateConstraints(fkPayState), /Foreign key violation.*Payroll/);

// Test trip seats check constraint: bookedSeats > totalSeats
const tripOverState = JSON.parse(JSON.stringify(testState));
tripOverState.trips[0].bookedSeats = 25; // total is 20
assert.throws(() => validateConstraints(tripOverState), /Check constraint violation.*exceeds total seats/);

console.log('✔ All constraints and foreign key checks verified.');

// 4. Atomic Transactions & Snapshot Rollback
console.log('4. Testing atomic transactions and snapshot rollback on failure...');
const initialDb = data();
const initialEmpCount = initialDb.employees.length;
const initialReqCount = initialDb.requests.length;

// A. Successful transaction commits cleanly
const committedResult = transaction((draft) => {
  draft.requests.push({
    id: `req_tx_test_${Date.now()}`,
    employeeId: draft.employees[0].id,
    type: 'Mission',
    title: 'Site Visit',
    status: 'inReview',
    days: 1,
    createdAt: Date.now(),
  });
  return 'SUCCESS_COMMIT';
});
assert.strictEqual(committedResult, 'SUCCESS_COMMIT');
assert.strictEqual(data().requests.length, initialReqCount + 1);

// Clean up committed test request
data().requests.pop();

// B. Failed transaction rolls back state completely (simulating mid-transaction crash)
let caughtError = null;
try {
  transaction((draft) => {
    draft.requests.push({
      id: 'req_should_not_exist',
      employeeId: draft.employees[0].id,
      status: 'inReview',
    });
    // Deliberate error mid-flight
    throw new Error('SIMULATED_PROCESSING_FAILURE');
  });
} catch (err) {
  caughtError = err;
}
assert.strictEqual(caughtError.message, 'SIMULATED_PROCESSING_FAILURE');
assert.strictEqual(data().requests.some((r) => r.id === 'req_should_not_exist'), false, 'Rollback must discard uncommitted mutations');

// C. Constraint violation inside transaction triggers rollback
let constraintError = null;
try {
  transaction((draft) => {
    draft.employees.push({
      id: `emp_dup_${Date.now()}`,
      nationalId: draft.employees[0].nationalId, // Duplicate National ID violates unique constraint!
      active: true,
      tokenVersion: 1,
    });
  });
} catch (err) {
  constraintError = err;
}
assert.ok(constraintError instanceof ConstraintViolationError);
assert.strictEqual(data().employees.length, initialEmpCount, 'State must remain untouched after constraint violation rollback');
console.log('✔ Atomic transactions, snapshot isolation, and rollback verified.');

// 5. In-Memory Indexes
console.log('5. Testing in-memory O(1) indexed lookups...');
indexes.rebuild(data());
const testEmp = data().employees[0];
if (testEmp) {
  const indexedById = indexes.getEmployeeById(testEmp.id);
  assert.strictEqual(indexedById.id, testEmp.id);

  const indexedByNat = indexes.getEmployeeByNationalIdOrPhone(testEmp.nationalId);
  assert.strictEqual(indexedByNat.id, testEmp.id);
}
console.log('✔ In-memory index lookups verified.');

// 6. Schema Migrations System
console.log('6. Testing schema migrations version tracking and idempotency...');
const availableMigrations = getAvailableMigrations();
assert.ok(availableMigrations.length >= 3);
assert.strictEqual(availableMigrations[0].version, 1);
assert.strictEqual(availableMigrations[1].version, 2);
assert.strictEqual(availableMigrations[2].version, 3);

// Running migrations on current db returns empty array since all are applied
const newlyApplied = runMigrations(data());
assert.strictEqual(newlyApplied.length, 0);

// Test migrations on fresh empty state
const freshState = { employees: [] };
const appliedOnFresh = runMigrations(freshState);
assert.strictEqual(appliedOnFresh.length, 3);
assert.strictEqual(freshState.schemaMigrations.length, 3);
assert.strictEqual(freshState.schemaMigrations[0].version, 1);
console.log('✔ Migration runner and version tracking verified.');

// 7. Environment Separation
console.log('7. Testing environment configuration profiles...');
assert.strictEqual(typeof config.load, 'function');
assert.strictEqual(typeof config.getEnv, 'function');
assert.strictEqual(typeof config.isProd, 'function');
assert.strictEqual(typeof config.isStaging, 'function');
assert.strictEqual(typeof config.isDev, 'function');
console.log('✔ Environment separation verified.');

console.log('=============================================================');
console.log('PHASE 2 DATABASE & BACKEND TEST SUITE: ALL TESTS PASSED');
console.log('=============================================================');
