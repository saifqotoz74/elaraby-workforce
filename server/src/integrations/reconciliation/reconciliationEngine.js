// Enterprise External System Reconciliation Engine
// Audits and compares internal workforce records against external authoritative ERP/Biometric sources.

function reconcileEmployees(externalRecords = [], internalEmployees = []) {
  const internalByNationalId = new Map();
  const internalById = new Map();

  for (const emp of internalEmployees) {
    if (emp.nationalId) internalByNationalId.set(String(emp.nationalId).trim(), emp);
    if (emp.id) internalById.set(emp.id, emp);
  }

  const externalByNatId = new Map();
  const missingInInternal = [];
  const discrepancies = [];

  for (const ext of externalRecords) {
    const cleanNat = String(ext.nationalId || '').trim();
    if (cleanNat) externalByNatId.set(cleanNat, ext);

    const match = internalByNationalId.get(cleanNat);
    if (!match) {
      missingInInternal.push({
        externalId: ext.externalId,
        nationalId: ext.nationalId,
        name: ext.name,
        department: ext.department,
        factory: ext.factory,
      });
    } else {
      // Check for discrepancies
      const diffs = [];
      if (typeof ext.vacationBalance === 'number' && match.vacationBalance !== ext.vacationBalance) {
        diffs.push({
          field: 'vacationBalance',
          internal: match.vacationBalance,
          external: ext.vacationBalance,
        });
      }
      if (ext.department && match.department !== ext.department) {
        diffs.push({
          field: 'department',
          internal: match.department,
          external: ext.department,
        });
      }
      if (diffs.length > 0) {
        discrepancies.push({
          employeeId: match.id,
          nationalId: cleanNat,
          name: match.name,
          diffs,
        });
      }
    }
  }

  const missingInExternal = [];
  for (const [natId, emp] of internalByNationalId.entries()) {
    if (emp.active && !externalByNatId.has(natId)) {
      missingInExternal.push({
        id: emp.id,
        nationalId: natId,
        name: emp.name,
        factory: emp.factory,
      });
    }
  }

  const isSynchronized = missingInInternal.length === 0 && discrepancies.length === 0;

  return {
    isSynchronized,
    totalExternal: externalRecords.length,
    totalInternal: internalEmployees.length,
    missingInInternalCount: missingInInternal.length,
    missingInInternal,
    missingInExternalCount: missingInExternal.length,
    missingInExternal,
    discrepanciesCount: discrepancies.length,
    discrepancies,
    reconciledAt: new Date().toISOString(),
  };
}

module.exports = {
  reconcileEmployees,
};
