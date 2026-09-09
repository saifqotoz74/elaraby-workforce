// Database Schema, Constraints, and Referential Integrity Engine
const { ConstraintViolationError, ValidationError } = require('./errors');

const VALID_REQUEST_STATUSES = ['inReview', 'pending', 'approved', 'rejected', 'cancelled'];
const VALID_REQUEST_TYPES = [
  'Annual Leave',
  'Sick Leave',
  'Emergency Leave',
  'Unpaid Leave',
  'Mission',
  'Casual Leave',
  'Hajj Leave',
  'Maternity Leave',
];

/// Validates National ID format (exactly 14 numeric digits)
function validateNationalId(id) {
  if (typeof id !== 'string' && typeof id !== 'number') return false;
  const str = String(id).trim();
  return /^\d{14}$/.test(str);
}

/// Validates Phone number format
function validatePhone(phone) {
  if (typeof phone !== 'string' && typeof phone !== 'number') return false;
  const str = String(phone).trim().replace(/[\s-]/g, '');
  return /^(\+20|0)?1[0125]\d{8}$/.test(str) || /^\d{10,15}$/.test(str);
}

/// Validates PIN format (exactly 4 numeric digits)
function validatePin(pin) {
  if (typeof pin !== 'string' && typeof pin !== 'number') return false;
  return /^\d{4}$/.test(String(pin).trim());
}

/// Comprehensive relational and integrity constraint validator across the entire database state
function validateConstraints(state) {
  if (!state || typeof state !== 'object') {
    throw new ConstraintViolationError('Database state is invalid or null');
  }

  const employees = state.employees || [];
  const requests = state.requests || [];
  const payroll = state.payroll || [];
  const roster = state.roster || [];
  const trips = state.trips || [];
  const fcmTokens = state.fcmTokens || [];

  // 1. Employee Unique Constraints & Check Constraints
  const employeeIds = new Set();
  const nationalIds = new Set();
  const phoneNumbers = new Set();

  for (const emp of employees) {
    if (!emp.id) {
      throw new ConstraintViolationError('Employee record is missing mandatory "id" primary key');
    }
    if (employeeIds.has(emp.id)) {
      throw new ConstraintViolationError(`Duplicate employee primary key: ${emp.id}`);
    }
    employeeIds.add(emp.id);

    // Active employees must have unique National IDs
    if (emp.active && emp.nationalId) {
      const cleanNat = String(emp.nationalId).trim();
      if (nationalIds.has(cleanNat)) {
        throw new ConstraintViolationError(`Unique constraint violation: National ID ${cleanNat} is already registered to an active employee`);
      }
      nationalIds.add(cleanNat);
    }

    // Active employees must have unique Phone numbers
    if (emp.active && emp.phone) {
      const cleanPhone = String(emp.phone).trim();
      if (phoneNumbers.has(cleanPhone)) {
        throw new ConstraintViolationError(`Unique constraint violation: Phone number ${cleanPhone} is already registered`);
      }
      phoneNumbers.add(cleanPhone);
    }

    // Vacation balance check constraint: balance cannot be negative
    if (typeof emp.vacationBalance === 'number' && emp.vacationBalance < 0) {
      throw new ConstraintViolationError(`Check constraint violation: Employee ${emp.id} has negative vacationBalance (${emp.vacationBalance})`);
    }

    // tokenVersion check constraint
    if (typeof emp.tokenVersion !== 'undefined' && (typeof emp.tokenVersion !== 'number' || emp.tokenVersion < 1)) {
      throw new ConstraintViolationError(`Check constraint violation: Employee ${emp.id} tokenVersion must be >= 1`);
    }
  }

  // 2. Requests Foreign Keys and Check Constraints
  const requestIds = new Set();
  for (const req of requests) {
    if (!req.id) {
      throw new ConstraintViolationError('Request is missing mandatory "id" primary key');
    }
    if (requestIds.has(req.id)) {
      throw new ConstraintViolationError(`Duplicate request primary key: ${req.id}`);
    }
    requestIds.add(req.id);

    // Foreign Key: request.employeeId -> employees.id
    if (req.employeeId && !employeeIds.has(req.employeeId)) {
      throw new ConstraintViolationError(`Foreign key violation: Request ${req.id} references non-existent employee ${req.employeeId}`);
    }

    // Status check constraint
    if (req.status && !VALID_REQUEST_STATUSES.includes(req.status)) {
      throw new ConstraintViolationError(`Check constraint violation: Invalid request status "${req.status}" on ${req.id}`);
    }

    // Days check constraint
    if (typeof req.days === 'number' && req.days < 0) {
      throw new ConstraintViolationError(`Check constraint violation: Request ${req.id} cannot have negative days (${req.days})`);
    }
  }

  // 3. Payroll Foreign Keys and Value Checks
  for (const pay of payroll) {
    if (pay.employeeId && !employeeIds.has(pay.employeeId)) {
      throw new ConstraintViolationError(`Foreign key violation: Payroll record references non-existent employee ${pay.employeeId}`);
    }
    if (typeof pay.netSalary === 'number' && pay.netSalary < 0) {
      throw new ConstraintViolationError(`Check constraint violation: Payroll netSalary cannot be negative (${pay.netSalary})`);
    }
  }

  // 4. Roster Foreign Keys
  for (const ros of roster) {
    if (ros.employeeId && !employeeIds.has(ros.employeeId)) {
      throw new ConstraintViolationError(`Foreign key violation: Roster record references non-existent employee ${ros.employeeId}`);
    }
  }

  // 5. Trips Constraints & Foreign Keys
  for (const trip of trips) {
    const total = typeof trip.totalSeats === 'number' ? trip.totalSeats : trip.seatsTotal;
    const booked = typeof trip.bookedSeats === 'number' ? trip.bookedSeats : (typeof trip.seatsAvailable === 'number' && typeof total === 'number' ? total - trip.seatsAvailable : 0);

    if (typeof total === 'number' && total < 0) {
      throw new ConstraintViolationError(`Check constraint violation: Trip ${trip.id} total seats cannot be negative`);
    }
    if (typeof booked === 'number' && booked < 0) {
      throw new ConstraintViolationError(`Check constraint violation: Trip ${trip.id} booked seats cannot be negative`);
    }
    if (typeof total === 'number' && typeof booked === 'number' && booked > total) {
      throw new ConstraintViolationError(`Check constraint violation: Trip ${trip.id} booked seats (${booked}) exceeds total seats (${total})`);
    }

    const bookedIds = trip.bookedBy || trip.bookedEmployeeIds;
    if (Array.isArray(bookedIds)) {
      for (const bookedEmpId of bookedIds) {
        if (!employeeIds.has(bookedEmpId)) {
          throw new ConstraintViolationError(`Foreign key violation: Trip ${trip.id} has booking for non-existent employee ${bookedEmpId}`);
        }
      }
    }
  }

  // 6. FCM Tokens Unique Constraint
  const tokenSet = new Set();
  for (const t of fcmTokens) {
    if (t.token) {
      if (tokenSet.has(t.token)) {
        // Warning or duplicate cleanable, not hard crash
      }
      tokenSet.add(t.token);
    }
  }

  return true;
}

module.exports = {
  VALID_REQUEST_STATUSES,
  VALID_REQUEST_TYPES,
  validateNationalId,
  validatePhone,
  validatePin,
  validateConstraints,
};
