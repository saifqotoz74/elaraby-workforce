// Realtime SSE (Server-Sent Events) Service
// Provides real-time event streaming between Mobile clients and HR Admin Dashboard.
// autorun heartbeat, reconnect support, and scope-based event routing.

const clients = new Set();
let heartbeatTimer = null;

function initHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const client of clients) {
      try {
        client.res.write(': ping\n\n');
      } catch (_) {
        clients.delete(client);
      }
    }
  }, 25000);
  if (heartbeatTimer.unref) heartbeatTimer.unref();
}

/**
 * Subscribes an HTTP response to the SSE stream.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Object} user - Authenticated user payload (admin or employee)
 */
function subscribe(req, res, user) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const client = {
    id: `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    res,
    user: user || {},
    connectedAt: Date.now(),
  };

  clients.add(client);
  initHeartbeat();

  // Send initial handshake event
  res.write(`event: connected\ndata: ${JSON.stringify({
    ok: true,
    clientId: client.id,
    timestamp: Date.now(),
  })}\n\n`);

  req.on('close', () => {
    clients.delete(client);
  });

  return client;
}

/**
 * Broadcasts an event to all connected SSE clients.
 * Optionally filtered by target scope (e.g. factory).
 * @param {string} eventName
 * @param {Object} payload
 * @param {Object} [filter] - Optional { factory, employeeId }
 */
function broadcast(eventName, payload = {}, filter = null) {
  const dataString = JSON.stringify({
    event: eventName,
    timestamp: Date.now(),
    ...payload,
  });

  const message = `event: ${eventName}\ndata: ${dataString}\n\n`;

  for (const client of clients) {
    try {
      // Scope filtering: if event belongs to a factory, only send to superadmin or matching factory admin
      if (filter && filter.factory && client.user?.role !== 'superadmin' && client.user?.scopeFactory) {
        if (client.user.scopeFactory !== filter.factory) {
          continue;
        }
      }

      // Employee targeting: if event is private to an employee
      if (filter && filter.employeeId && client.user?.scope === 'employee') {
        if (client.user.sub !== filter.employeeId) {
          continue;
        }
      }

      client.res.write(message);
    } catch (_) {
      clients.delete(client);
    }
  }
}

function getActiveClientCount() {
  return clients.size;
}

module.exports = {
  subscribe,
  broadcast,
  getActiveClientCount,
};
