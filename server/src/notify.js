// Shared notification helper: persists to the in-app inbox AND fires an FCM
// push to every registered device of the employee (best-effort, never blocks
// the request; silently skipped when push isn't configured).
const { data, save, nextId } = require('./db');
const fcm = require('./fcm');

function notify({ employeeId, title, body, imageUrl = null }, autoSave = true) {
  const db = data();
  const notification = {
    id: `ntf_${nextId('notification')}`,
    employeeId,
    title,
    body,
    imageUrl,
    read: false,
    createdAt: Date.now(),
  };
  db.notifications.push(notification);
  if (autoSave) {
    save();
  }

  const tokens = (db.fcmTokens || [])
    .filter((t) => t.employeeId === employeeId)
    .map((t) => t.token);
  for (const token of tokens) {
    fcm.sendToToken(token, title, body).catch((err) => {
      const errMsg = String(err?.message || err || '');
      if (
        errMsg.includes('INVALID_ARGUMENT') ||
        errMsg.includes('UNREGISTERED') ||
        errMsg.includes('NOT_FOUND') ||
        errMsg.includes('registration token')
      ) {
        const currentDb = data();
        if (currentDb.fcmTokens) {
          const prev = currentDb.fcmTokens.length;
          currentDb.fcmTokens = currentDb.fcmTokens.filter((t) => t.token !== token);
          if (currentDb.fcmTokens.length !== prev) {
            save();
          }
        }
      }
    });
  }
  return notification;
}

module.exports = { notify };
