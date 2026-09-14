// Realtime SSE (Server-Sent Events) Service
// Provides real-time event streaming between Mobile clients and HR Admin Dashboard.
// Features heartbeat, reconnect support, and strict tenant-scoped event routing.

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

function _scrubPayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const scrubbed = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase();
    if (lowerKey === 'pin' || lowerKey === 'pinhash' || lowerKey === 'password' || lowerKey === 'token' || lowerKey === 'otpcode' || lowerKey === 'otp') {
      scrubbed[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      scrubbed[k] = _scrubPayload(v);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
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

  const tenantId = user?.tenantId || req?.tenantId || 'elaraby';

  const client = {
    id: `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    res,
    user: user || {},
    tenantId,
    connectedAt: Date.now(),
  };

  clients.add(client);
  initHeartbeat();

  // Send initial handshake event
  res.write(`event: connected\ndata: ${JSON.stringify({
    ok: true,
    clientId: client.id,
    tenantId,
    timestamp: Date.now(),
  })}\n\n`);

  const cleanup = () => {
    clients.delete(client);
  };
  if (req && typeof req.on === 'function') {
    req.on('close', cleanup);
    req.on('error', cleanup);
  }
  if (res && typeof res.on === 'function') {
    res.on('close', cleanup);
    res.on('error', cleanup);
  }

  return client;
}

let clusterPublisher = null;

function setClusterPublisher(fn) {
  clusterPublisher = fn;
}

/**
 * Broadcasts an event to all connected SSE clients with strict tenant isolation.
 * @param {string} eventName
 * @param {Object} payload
 * @param {Object} [filter] - Optional { tenantId, factory, employeeId, isGlobal, _fromCluster }
 */
function broadcast(eventName, payload = {}, filter = null) {
  const safePayload = _scrubPayload(payload);

  if (clusterPublisher && !filter?._fromCluster) {
    try {
      clusterPublisher(eventName, safePayload, filter);
    } catch (_) {
      // Graceful fallback to local broadcast
    }
  }

  const dataString = JSON.stringify({
    event: eventName,
    timestamp: Date.now(),
    ...safePayload,
  });

  const message = `event: ${eventName}\ndata: ${dataString}\n\n`;
  const eventTenantId = filter?.tenantId || payload?.tenantId;
  const isGlobal = !!payload?.isGlobal || !!filter?.isGlobal;

  for (const client of clients) {
    try {
      // 1. Strict Tenant Isolation
      if (!isGlobal && eventTenantId) {
        const isSuper = (client.user?.role === 'superadmin' || client.user?.isSuperAdmin) && !client.user?.scopeFactory;
        if (!isSuper) {
          const clientTenant = client.tenantId || client.user?.tenantId || 'elaraby';
          if (clientTenant !== eventTenantId) {
            continue;
          }
        }
      }

      // 2. Scope filtering: if event belongs to a specific factory
      if (filter && filter.factory && client.user?.role !== 'superadmin' && client.user?.scopeFactory) {
        if (client.user.scopeFactory !== filter.factory) {
          continue;
        }
      }

      // 3. Employee targeting: if event is private to an employee
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
  setClusterPublisher,
};
