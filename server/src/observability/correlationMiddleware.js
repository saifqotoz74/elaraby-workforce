// Enterprise Request Correlation & Tracing Middleware
const crypto = require('crypto');
const logger = require('./logger');
const metrics = require('./metrics');

function correlationMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = incomingId || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Correlation-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode, duration);

    if (req.path.startsWith('/api')) {
      logger.info(`${req.method} ${req.path}`, {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userId: req.employeeId || req.user?.sub || null,
        userRole: req.user?.role || null,
      });
    }
  });

  next();
}

module.exports = correlationMiddleware;
