// Announcements & Content Domain Service
// Handles company broadcasts, push notifications, audit trails, and realtime sync.

const { data: db, save, nextId } = require('../db');
const { recordAuditLog } = require('./auditService');
const { broadcast } = require('./realtimeService');
const { notify } = require('../notify');

function listContent(collection, { page, limit } = {}) {
  const items = [...(db()[collection] || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (page || limit) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const start = (pageNum - 1) * limitNum;
    const pagedItems = items.slice(start, start + limitNum);
    return {
      items: pagedItems,
      total: items.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(items.length / limitNum),
    };
  }

  return { items, total: items.length };
}

function createContent(admin, collection, rawBody, { ip, userAgent } = {}) {
  const name = collection.slice(0, 3);
  const title = rawBody.title || rawBody.name || 'Untitled';
  const desc = rawBody.description || rawBody.body || '';
  const item = {
    id: `${name}_${Date.now()}`,
    ...rawBody,
    title,
    name: rawBody.name || title,
    description: desc,
    body: rawBody.body || desc,
    createdAt: Date.now(),
  };

  db()[collection].push(item);

  // If announcement, notify all active employees via FCM
  if (collection === 'announcements') {
    const activeEmployees = db().employees.filter((e) => e.active);
    for (const emp of activeEmployees) {
      notify(
        {
          employeeId: emp.id,
          title: item.important ? 'Important Announcement' : 'New Announcement',
          body: item.title,
          imageUrl: item.imageUrl || null,
        },
        false
      );
    }
    broadcast('announcement.created', { announcement: item });
  }

  recordAuditLog(db(), {
    actor: admin?.sub || 'admin',
    role: admin?.role || 'superadmin',
    action: `create_${collection}`,
    entity: collection,
    entityId: item.id,
    after: item,
    details: `Created new ${collection}: ${item.title || item.name || item.id}`,
    ip,
    userAgent,
  });

  save();
  return item;
}

function deleteContent(admin, collection, id, { ip, userAgent } = {}) {
  const item = db()[collection].find((x) => x.id === id);
  if (!item) {
    const err = new Error('not_found');
    err.statusCode = 404;
    throw err;
  }

  db()[collection] = db()[collection].filter((x) => x.id !== id);

  if (collection === 'announcements') {
    broadcast('announcement.deleted', { id });
  }

  recordAuditLog(db(), {
    actor: admin?.sub || 'admin',
    role: admin?.role || 'superadmin',
    action: `delete_${collection}`,
    entity: collection,
    entityId: id,
    before: item,
    details: `Deleted ${collection}: ${item?.title || id}`,
    ip,
    userAgent,
  });

  save();
  return { ok: true };
}

module.exports = {
  listContent,
  createContent,
  deleteContent,
};
