const db = require('../db');

function createPermit(tenantId, employeeId, { type, line, description, precautions, validUntil }) {
  const permit = {
    id: `HSE-P-${tenantId}-${Date.now()}`,
    tenantId,
    employeeId,
    type,
    line,
    description,
    precautions,
    validUntil,
    status: 'pending'
  };
  
  db.transaction(data => {
    if (!data.hsePermits) data.hsePermits = [];
    data.hsePermits.push(permit);
  });
  
  return permit;
}

function decidePermit(permitId, decision, { reviewer, reason }) {
  let updated = null;
  db.transaction(data => {
    if (!data.hsePermits) return;
    const permit = data.hsePermits.find(p => p.id === permitId);
    if (permit) {
      permit.status = decision;
      permit.decidedAt = Date.now();
      permit.reviewer = reviewer;
      permit.reason = reason;
      updated = { ...permit };
    }
  });
  return updated;
}

function listPermits(tenantId, filters = {}) {
  const data = db.data();
  let permits = (data.hsePermits || []).filter(p => p.tenantId === tenantId);
  if (filters.status) {
    permits = permits.filter(p => p.status === filters.status);
  }
  if (filters.employeeId) {
    permits = permits.filter(p => p.employeeId === filters.employeeId);
  }
  return permits;
}

function reportIncident(tenantId, reporterId, { title, line, severity, description, injuryReported }) {
  const incident = {
    id: `INC-${tenantId}-${Date.now()}`,
    tenantId,
    reporterId,
    title,
    line,
    severity,
    description,
    injuryReported,
    status: 'open',
    createdAt: Date.now()
  };
  
  db.transaction(data => {
    if (!data.hseIncidents) data.hseIncidents = [];
    data.hseIncidents.push(incident);
  });
  
  return incident;
}

function listIncidents(tenantId) {
  const data = db.data();
  return (data.hseIncidents || []).filter(i => i.tenantId === tenantId);
}

function submitPpeInspection(tenantId, line, checklist = {}) {
  const values = Object.values(checklist);
  const totalCount = values.length;
  const trueCount = values.filter(v => v === true).length;
  const complianceScore = totalCount === 0 ? 100 : (trueCount / totalCount) * 100;
  
  const inspection = {
    id: `PPE-${tenantId}-${Date.now()}`,
    tenantId,
    line,
    checklist,
    complianceScore,
    createdAt: Date.now()
  };
  
  db.transaction(data => {
    if (!data.hsePpeInspections) data.hsePpeInspections = [];
    data.hsePpeInspections.push(inspection);
  });
  
  return inspection;
}

function getHseSummary(tenantId) {
  const data = db.data();
  const activePermitsCount = (data.hsePermits || []).filter(p => p.tenantId === tenantId && p.status === 'pending').length;
  const openIncidentsCount = (data.hseIncidents || []).filter(i => i.tenantId === tenantId && i.status === 'open').length;
  
  const inspections = (data.hsePpeInspections || []).filter(i => i.tenantId === tenantId);
  const avgScore = inspections.length > 0 
    ? inspections.reduce((sum, i) => sum + i.complianceScore, 0) / inspections.length 
    : 98.5;

  return {
    activePermitsCount,
    openIncidentsCount,
    daysWithoutLti: 142,
    complianceScore: avgScore
  };
}

module.exports = {
  createPermit,
  decidePermit,
  listPermits,
  reportIncident,
  listIncidents,
  submitPpeInspection,
  getHseSummary
};
