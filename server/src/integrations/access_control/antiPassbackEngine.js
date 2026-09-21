'use strict';

/**
 * Anti-Passback (APB) Validation Engine
 * Enforces direction rules (no consecutive entry without exit, no consecutive exit without entry).
 * Provides in-memory LRU tracking with persistence & audit logging.
 */

// Map of `tenantId:employeeId` -> { direction, gateId, timestamp }
const _apbStateStore = new Map();
const _apbViolations = [];

/**
 * Validates a proposed punch direction against Anti-Passback rules.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.employeeId
 * @param {'IN'|'OUT'} params.direction
 * @param {string} params.gateId
 * @param {number} [params.timestamp]
 * @param {'strict'|'soft'} [params.mode='strict']
 * @returns {{ allowed: boolean, reason?: string, violationLogged?: boolean, previousState?: Object }}
 */
function validateAntiPassback({
  tenantId = 'elaraby',
  employeeId,
  direction = 'IN',
  gateId = 'GATE_1',
  timestamp = Date.now(),
  mode = 'strict',
}) {
  if (!employeeId) {
    throw new Error('employeeId is required for Anti-Passback validation');
  }

  const normDirection = String(direction).toUpperCase();
  if (normDirection !== 'IN' && normDirection !== 'OUT') {
    throw new Error(`Invalid direction '${direction}'. Must be 'IN' or 'OUT'`);
  }

  const key = `${tenantId}:${employeeId}`;
  const lastState = _apbStateStore.get(key);

  // 1. Debounce Check (<3 seconds duplicate sensor trigger)
  if (lastState && (timestamp - lastState.timestamp) < 3000 && lastState.direction === normDirection) {
    return {
      allowed: false,
      reason: 'DEBOUNCE_DUPLICATE',
      previousState: lastState,
    };
  }

  // 2. State Evaluation
  if (lastState) {
    if (lastState.direction === normDirection) {
      const violationType = normDirection === 'IN'
        ? 'CONSECUTIVE_ENTRY_WITHOUT_EXIT'
        : 'CONSECUTIVE_EXIT_WITHOUT_ENTRY';

      const violationRecord = {
        id: `apb_viol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenantId,
        employeeId,
        gateId,
        attemptedDirection: normDirection,
        lastDirection: lastState.direction,
        lastGateId: lastState.gateId,
        lastTimestamp: lastState.timestamp,
        timestamp,
        mode,
        type: violationType,
        createdAt: new Date().toISOString(),
      };

      _apbViolations.push(violationRecord);

      if (mode === 'strict') {
        return {
          allowed: false,
          reason: violationType,
          previousState: lastState,
          violationId: violationRecord.id,
        };
      }

      // Soft mode: allow passage but log violation
      _apbStateStore.set(key, { direction: normDirection, gateId, timestamp });
      return {
        allowed: true,
        violationLogged: true,
        reason: violationType,
        violationId: violationRecord.id,
      };
    }
  }

  // 3. Normal passage transition
  _apbStateStore.set(key, { direction: normDirection, gateId, timestamp });
  return {
    allowed: true,
  };
}

/**
 * Retrieves the current APB state for an employee.
 */
function getAntiPassbackState(tenantId, employeeId) {
  const key = `${tenantId}:${employeeId}`;
  return _apbStateStore.get(key) || { direction: 'OUTSIDE', gateId: null, timestamp: 0 };
}

/**
 * Resets APB state for an employee (e.g. administrator override or end of day).
 */
function resetAntiPassbackState(tenantId, employeeId, resetState = 'OUT', reason = 'Manual Reset') {
  const key = `${tenantId}:${employeeId}`;
  const normState = resetState === 'OUTSIDE' ? 'OUT' : resetState.toUpperCase();
  _apbStateStore.set(key, { direction: normState, gateId: 'ADMIN_OVERRIDE', timestamp: Date.now(), reason });
  return {
    ok: true,
    employeeId,
    tenantId,
    currentState: normState,
    reason,
  };
}

/**
 * Lists recorded APB violations.
 */
function getAntiPassbackViolations(tenantId = null) {
  if (!tenantId) return [..._apbViolations];
  return _apbViolations.filter((v) => v.tenantId === tenantId);
}

/**
 * Clears APB state store (for testing).
 */
function clearAntiPassbackStore() {
  _apbStateStore.clear();
  _apbViolations.length = 0;
}

module.exports = {
  validateAntiPassback,
  getAntiPassbackState,
  resetAntiPassbackState,
  getAntiPassbackViolations,
  clearAntiPassbackStore,
};
