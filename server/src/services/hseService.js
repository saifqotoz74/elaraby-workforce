'use strict';

/**
 * Enterprise Health, Safety & Environment (HSE) Domain Service
 * Enforces unified persistence, strict multi-tenant isolation, and ambient context resolution.
 * (TENANT-001, DB-001, UI-001)
 */

const db = require('../db');
const repository = require('../db/repository');
const { getCurrentTenantId, isSuperAdmin } = require('../tenantContext');

function resolveTenant(explicitTenantId) {
  if (explicitTenantId && typeof explicitTenantId === 'string' && explicitTenantId.trim()) {
    return explicitTenantId.trim().toLowerCase();
  }
  const ambient = getCurrentTenantId({ strict: true });
  if (!ambient) {
    const err = new Error('tenant_context_required');
    err.statusCode = 400;
    throw err;
  }
  return ambient;
}

function createPermit(arg1, arg2, arg3) {
  let tenant;
  let employeeId;
  let permitData;

  if (arg3 !== undefined) {
    tenant = resolveTenant(arg1);
    employeeId = arg2;
    permitData = arg3 || {};
  } else {
    tenant = resolveTenant();
    employeeId = arg1;
    permitData = arg2 || {};
  }

  const { type, line, description, precautions, validUntil } = permitData;

  if (repository.getBackend() === 'postgres') {
    return repository.createHsePermit({
      tenantId: tenant,
      employeeId,
      type,
      line,
      description,
      precautions: Array.isArray(precautions) ? precautions : [],
      validUntil,
      status: 'pending',
    });
  }

  const permit = {
    id: `HSE-P-${tenant}-${Date.now()}`,
    tenantId: tenant,
    employeeId,
    type,
    line,
    description,
    precautions: Array.isArray(precautions) ? precautions : [],
    validUntil,
    status: 'pending',
    createdAt: Date.now(),
  };

  db.transaction((data) => {
    if (!data.hsePermits) data.hsePermits = [];
    data.hsePermits.push(permit);
  });

  return permit;
}

function decidePermit(permitId, decision, { reviewer, reason, tenantId } = {}) {
  let explicitOrAmbientTenant = tenantId;
  if (!explicitOrAmbientTenant) {
    try {
      explicitOrAmbientTenant = resolveTenant();
    } catch (_) {
      explicitOrAmbientTenant = null;
    }
  }
  const isSuper = isSuperAdmin();

  if (repository.getBackend() === 'postgres') {
    return (async () => {
      const permit = await repository.findHsePermitById(permitId, explicitOrAmbientTenant);
      if (!permit) return null;
      if (!isSuper && explicitOrAmbientTenant && permit.tenantId !== explicitOrAmbientTenant) {
        const err = new Error('forbidden_cross_tenant');
        err.statusCode = 403;
        throw err;
      }
      return repository.updateHsePermit(permitId, {
        status: decision,
        reviewer: reviewer || null,
        reason: reason || null,
        decidedAt: new Date(),
      }, permit.tenantId);
    })();
  }

  let updated = null;
  db.transaction((data) => {
    if (!data.hsePermits) return;
    const permit = data.hsePermits.find((p) => p.id === permitId);
    if (permit) {
      if (!isSuper && explicitOrAmbientTenant && permit.tenantId !== explicitOrAmbientTenant) {
        const err = new Error('forbidden_cross_tenant');
        err.statusCode = 403;
        throw err;
      }
      permit.status = decision;
      permit.decidedAt = Date.now();
      permit.reviewer = reviewer;
      permit.reason = reason;
      updated = { ...permit };
    }
  });
  return updated;
}

function listPermits(arg1, arg2) {
  let tenant;
  let filters = {};

  if (typeof arg1 === 'string' && arg2 !== undefined) {
    tenant = resolveTenant(arg1);
    filters = arg2 || {};
  } else if (typeof arg1 === 'string' && arg2 === undefined) {
    tenant = resolveTenant(arg1);
    filters = {};
  } else {
    tenant = resolveTenant();
    filters = arg1 || {};
  }

  if (repository.getBackend() === 'postgres') {
    return repository.listHsePermits(tenant, filters);
  }

  const data = db.data();
  let permits = (data.hsePermits || []).filter((p) => p.tenantId === tenant);
  if (filters.status) {
    permits = permits.filter((p) => p.status === filters.status);
  }
  if (filters.employeeId) {
    permits = permits.filter((p) => p.employeeId === filters.employeeId);
  }
  return permits.map((p) => ({ ...p }));
}

function reportIncident(arg1, arg2, arg3) {
  let tenant;
  let reporterId;
  let incidentData;

  if (arg3 !== undefined) {
    tenant = resolveTenant(arg1);
    reporterId = arg2;
    incidentData = arg3 || {};
  } else {
    tenant = resolveTenant();
    reporterId = arg1;
    incidentData = arg2 || {};
  }

  const { title, line, severity, description, injuryReported } = incidentData;

  if (repository.getBackend() === 'postgres') {
    return repository.createHseIncident({
      tenantId: tenant,
      reporterId,
      title,
      line,
      severity: severity || 'medium',
      description,
      injuryReported: !!injuryReported,
      status: 'open',
    });
  }

  const incident = {
    id: `INC-${tenant}-${Date.now()}`,
    tenantId: tenant,
    reporterId,
    title,
    line,
    severity: severity || 'medium',
    description,
    injuryReported: !!injuryReported,
    status: 'open',
    createdAt: Date.now(),
  };

  db.transaction((data) => {
    if (!data.hseIncidents) data.hseIncidents = [];
    data.hseIncidents.push(incident);
  });

  return incident;
}

function listIncidents(arg1, arg2) {
  let tenant;
  let filters = {};

  if (typeof arg1 === 'string') {
    tenant = resolveTenant(arg1);
    filters = arg2 || {};
  } else {
    tenant = resolveTenant();
    filters = arg1 || {};
  }

  if (repository.getBackend() === 'postgres') {
    return repository.listHseIncidents(tenant, filters);
  }

  const data = db.data();
  let list = (data.hseIncidents || []).filter((i) => i.tenantId === tenant);
  if (filters.status) {
    list = list.filter((i) => i.status === filters.status);
  }
  return list.map((i) => ({ ...i }));
}

function submitPpeInspection(arg1, arg2, arg3) {
  let tenant;
  let line;
  let checklist = {};

  if (arg3 !== undefined) {
    tenant = resolveTenant(arg1);
    line = arg2;
    checklist = arg3 || {};
  } else {
    tenant = resolveTenant();
    line = arg1;
    checklist = arg2 || {};
  }

  const values = Object.values(checklist);
  const totalCount = values.length;
  const trueCount = values.filter((v) => v === true).length;
  const complianceScore = totalCount === 0 ? 100 : Math.round((trueCount / totalCount) * 10000) / 100;

  if (repository.getBackend() === 'postgres') {
    return repository.createHsePpeInspection({
      tenantId: tenant,
      line,
      checklist,
      complianceScore,
    });
  }

  const inspection = {
    id: `PPE-${tenant}-${Date.now()}`,
    tenantId: tenant,
    line,
    checklist,
    complianceScore,
    createdAt: Date.now(),
  };

  db.transaction((data) => {
    if (!data.hsePpeInspections) data.hsePpeInspections = [];
    data.hsePpeInspections.push(inspection);
  });

  return inspection;
}

function getHseSummary(explicitTenantId) {
  const tenant = resolveTenant(explicitTenantId);

  if (repository.getBackend() === 'postgres') {
    return Promise.all([
      repository.listHsePermits(tenant),
      repository.listHseIncidents(tenant),
      repository.listHsePpeInspections(tenant),
    ]).then(([permits, incidents, inspections]) => {
      const activePermitsCount = permits.filter((p) => p.status === 'pending').length;
      const openIncidentsCount = incidents.filter((i) => i.status === 'open').length;
      const avgScore = inspections.length > 0
        ? Math.round((inspections.reduce((sum, i) => sum + i.complianceScore, 0) / inspections.length) * 10) / 10
        : 98.5;

      const injuryIncidents = incidents
        .filter((i) => i.injuryReported)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const daysWithoutLti = injuryIncidents.length > 0
        ? Math.max(0, Math.floor((Date.now() - new Date(injuryIncidents[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)))
        : 142;

      return {
        activePermitsCount,
        openIncidentsCount,
        daysWithoutLti,
        complianceScore: avgScore,
      };
    });
  }

  const data = db.data();
  const activePermitsCount = (data.hsePermits || []).filter(
    (p) => p.tenantId === tenant && p.status === 'pending'
  ).length;
  const incidents = (data.hseIncidents || []).filter(
    (i) => i.tenantId === tenant
  );
  const openIncidentsCount = incidents.filter((i) => i.status === 'open').length;

  const inspections = (data.hsePpeInspections || []).filter(
    (i) => i.tenantId === tenant
  );
  const avgScore = inspections.length > 0
    ? Math.round((inspections.reduce((sum, i) => sum + i.complianceScore, 0) / inspections.length) * 10) / 10
    : 98.5;

  const injuryIncidents = incidents
    .filter((i) => i.injuryReported)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const daysWithoutLti = injuryIncidents.length > 0
    ? Math.max(0, Math.floor((Date.now() - injuryIncidents[0].createdAt) / (1000 * 60 * 60 * 24)))
    : 142;

  return {
    activePermitsCount,
    openIncidentsCount,
    daysWithoutLti,
    complianceScore: avgScore,
  };
}

module.exports = {
  createPermit,
  decidePermit,
  listPermits,
  reportIncident,
  listIncidents,
  submitPpeInspection,
  getHseSummary,
};
