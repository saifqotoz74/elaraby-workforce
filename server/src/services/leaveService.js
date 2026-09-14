// Leave & Requests Domain Service
// Handles leave decisioning, transactional vacation balance refunds, notifications, and realtime events.

const { data: db, transaction } = require('../db');
const { checkScope } = require('../rbac');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');
const { notify } = require('../notify');

function listRequests(admin, { page, limit, status, type } = {}) {
  const all = db().requests
    .map((r) => {
      const e = db().employees.find((emp) => emp.id === r.employeeId);
      return {
        ...r,
        employee: e,
        employeeName: e?.name || '?',
        employeeCode: e?.employeeCode || '?',
        factory: e?.factory || null,
        department: e?.department || null,
      };
    })
    .filter((r) => !r.employee || checkScope(admin, r.employee));

  let filtered = all;
  if (status) {
    filtered = filtered.filter((r) => r.status === status);
  }
  if (type) {
    filtered = filtered.filter((r) => String(r.type).toLowerCase() === String(type).toLowerCase());
  }

  filtered.sort((a, b) => b.createdAt - a.createdAt);

  const cleanItems = filtered.map(({ employee, ...rest }) => rest);

  if (page || limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const start = (pageNum - 1) * limitNum;
    const items = cleanItems.slice(start, start + limitNum);
    return {
      requests: items,
      total: cleanItems.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(cleanItems.length / limitNum),
    };
  }

  return { requests: cleanItems, total: cleanItems.length };
}

function decideRequest(admin, id, { status, reason }, { ip, userAgent } = {}) {
  if (!['approved', 'rejected'].includes(status)) {
    const err = new Error('status_must_be_approved_or_rejected');
    err.statusCode = 400;
    throw err;
  }

  let employeeTarget = null;
  const decidedRequest = transaction((state) => {
    const reqItem = state.requests.find((r) => r.id === id);
    if (!reqItem) {
      const err = new Error('not_found');
      err.statusCode = 404;
      throw err;
    }

    const employee = state.employees.find((e) => e.id === reqItem.employeeId);
    if (employee && !checkScope(admin, employee)) {
      const err = new Error('forbidden_outside_factory_scope');
      err.statusCode = 403;
      throw err;
    }

    if (reqItem.status !== 'inReview') {
      const err = new Error('already_decided');
      err.statusCode = 422;
      throw err;
    }

    employeeTarget = employee;
    const beforeState = { ...reqItem };

    reqItem.status = status;
    reqItem.decisionReason = reason || null;
    reqItem.decidedBy = admin?.sub || 'HR Admin';
    reqItem.decidedAt = Date.now();
    reqItem.summary =
      status === 'approved' ? 'Approved by HR' : `Rejected by HR${reason ? ` — ${reason}` : ''}`;

    if (Array.isArray(reqItem.approvalStages) && reqItem.approvalStages.length > 0) {
      if (status === 'approved') {
        reqItem.approvalStages = reqItem.approvalStages.map((st) => ({
          ...st,
          status: 'approved',
          reviewer: st.reviewer || admin?.sub || 'HR Admin',
          decidedAt: st.decidedAt || Date.now(),
        }));
      } else if (status === 'rejected') {
        let marked = false;
        reqItem.approvalStages = reqItem.approvalStages.map((st) => {
          if (!marked && st.status === 'pending') {
            marked = true;
            return {
              ...st,
              status: 'rejected',
              reviewer: admin?.sub || 'HR Admin',
              decidedAt: Date.now(),
              reason: reason || null,
            };
          }
          return st;
        });
      }
    }

    // Transactional Vacation Days Refund on Annual Leave Rejection
    if (status === 'rejected') {
      const isAnnualLeave =
        reqItem.type === 'Leave' &&
        (reqItem.details?.leaveType === 'Annual Leave' ||
          reqItem.details?.leaveType === 'annual' ||
          String(reqItem.title).toLowerCase().includes('annual leave') ||
          String(reqItem.title).toLowerCase().includes('إجازة سنوية') ||
          String(reqItem.title).toLowerCase().includes('سنوية'));

      if (isAnnualLeave) {
        const days = Number(reqItem.details?.days ?? reqItem.days) || 0;
        if (employee && days > 0) {
          const balBefore = employee.vacationBalance || 0;
          employee.vacationBalance = balBefore + days;
          recordAuditLog(state, {
            actor: admin?.sub || 'admin',
            role: admin?.role || 'superadmin',
            action: 'refund_vacation_balance',
            entity: 'employee',
            entityId: employee.id,
            before: { vacationBalance: balBefore },
            after: { vacationBalance: employee.vacationBalance },
            details: `Refunded ${days} vacation days due to rejected leave request ${reqItem.id}`,
            ip,
            userAgent,
          });
        }
      }
    }

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: `request_${status}`,
      entity: 'request',
      entityId: reqItem.id,
      before: beforeState,
      after: { ...reqItem },
      details: `${status === 'approved' ? 'Approved' : 'Rejected'} request "${reqItem.title}" (Employee ID: ${reqItem.employeeId})`,
      ip,
      userAgent,
    });

    return reqItem;
  });

  // Mobile Push Notification via FCM
  const notifTitle =
    status === 'approved'
      ? `Request Approved — ${decidedRequest.title}`
      : `Request Rejected — ${decidedRequest.title}`;
  notify({
    employeeId: decidedRequest.employeeId,
    title: notifTitle,
    body:
      status === 'approved'
        ? 'Your request has been approved by HR.'
        : reason || 'Your request was rejected by HR.',
  });

  // Realtime Broadcast
  const eventName = status === 'approved' ? 'leave.request.approved' : 'leave.request.rejected';
  broadcast(
    eventName,
    { request: decidedRequest, employee: employeeTarget ? { id: employeeTarget.id, name: employeeTarget.name } : null },
    { factory: employeeTarget?.factory, employeeId: decidedRequest.employeeId }
  );

  return decidedRequest;
}

function decideApprovalStage(admin, id, { stage, status, reason }, { ip, userAgent } = {}) {
  if (!['approved', 'rejected'].includes(status)) {
    const err = new Error('status_must_be_approved_or_rejected');
    err.statusCode = 400;
    throw err;
  }

  let employeeTarget = null;
  const decidedRequest = transaction((state) => {
    const reqItem = state.requests.find((r) => r.id === id);
    if (!reqItem) {
      const err = new Error('not_found');
      err.statusCode = 404;
      throw err;
    }

    const employee = state.employees.find((e) => e.id === reqItem.employeeId);
    if (employee && !checkScope(admin, employee)) {
      const err = new Error('forbidden_outside_factory_scope');
      err.statusCode = 403;
      throw err;
    }

    if (reqItem.status !== 'inReview') {
      const err = new Error('already_decided');
      err.statusCode = 422;
      throw err;
    }

    employeeTarget = employee;
    const stages = Array.isArray(reqItem.approvalStages) ? reqItem.approvalStages : [];
    const targetStageIndex = stages.findIndex((s) => s.stage === Number(stage) || s.role === stage);
    if (targetStageIndex === -1) {
      const err = new Error('stage_not_found');
      err.statusCode = 404;
      throw err;
    }

    const targetStage = stages[targetStageIndex];
    targetStage.status = status;
    targetStage.reviewer = admin?.sub || 'Approver';
    targetStage.decidedAt = Date.now();
    targetStage.reason = reason || null;

    if (status === 'rejected') {
      reqItem.status = 'rejected';
      reqItem.decisionReason = reason || `Rejected at ${targetStage.title}`;
      reqItem.decidedBy = admin?.sub || 'Approver';
      reqItem.decidedAt = Date.now();
      reqItem.summary = `Rejected at ${targetStage.title}${reason ? ` — ${reason}` : ''}`;

      // Refund annual leave if applicable
      const isAnnualLeave =
        reqItem.type === 'Leave' &&
        (reqItem.details?.leaveType === 'Annual Leave' ||
          reqItem.details?.leaveType === 'annual' ||
          String(reqItem.title).toLowerCase().includes('annual leave') ||
          String(reqItem.title).toLowerCase().includes('إجازة سنوية') ||
          String(reqItem.title).toLowerCase().includes('سنوية'));

      if (isAnnualLeave) {
        const days = Number(reqItem.details?.days ?? reqItem.days) || 0;
        if (employee && days > 0) {
          const balBefore = employee.vacationBalance || 0;
          employee.vacationBalance = balBefore + days;
          recordAuditLog(state, {
            actor: admin?.sub || 'admin',
            role: admin?.role || 'superadmin',
            action: 'refund_vacation_balance',
            entity: 'employee',
            entityId: employee.id,
            before: { vacationBalance: balBefore },
            after: { vacationBalance: employee.vacationBalance },
            details: `Refunded ${days} vacation days due to rejected leave request ${reqItem.id}`,
            ip,
            userAgent,
          });
        }
      }
    } else {
      const allApproved = stages.every((s) => s.status === 'approved');
      if (allApproved) {
        reqItem.status = 'approved';
        reqItem.decidedBy = admin?.sub || 'Approver';
        reqItem.decidedAt = Date.now();
        reqItem.summary = 'Approved through all stages';
      } else {
        const nextPending = stages.find((s) => s.status === 'pending');
        reqItem.summary = nextPending ? `Waiting on: ${nextPending.title}` : 'In Review';
      }
    }

    recordAuditLog(state, {
      actor: admin?.sub || 'admin',
      role: admin?.role || 'superadmin',
      action: `request_stage_${status}`,
      entity: 'request',
      entityId: reqItem.id,
      details: `${status === 'approved' ? 'Approved' : 'Rejected'} stage ${targetStage.stage} (${targetStage.title}) for "${reqItem.title}"`,
      ip,
      userAgent,
    });

    return reqItem;
  });

  const notifTitle =
    decidedRequest.status === 'approved'
      ? `Request Approved — ${decidedRequest.title}`
      : decidedRequest.status === 'rejected'
      ? `Request Rejected — ${decidedRequest.title}`
      : `Request Stage Update — ${decidedRequest.title}`;
  notify({
    employeeId: decidedRequest.employeeId,
    title: notifTitle,
    body: decidedRequest.summary,
  });

  const eventName =
    decidedRequest.status === 'approved'
      ? 'leave.request.approved'
      : decidedRequest.status === 'rejected'
      ? 'leave.request.rejected'
      : 'leave.request.stage_updated';
  broadcast(
    eventName,
    { request: decidedRequest, employee: employeeTarget ? { id: employeeTarget.id, name: employeeTarget.name } : null },
    { factory: employeeTarget?.factory, employeeId: decidedRequest.employeeId }
  );

  return decidedRequest;
}

module.exports = {
  listRequests,
  decideRequest,
  decideApprovalStage,
};
