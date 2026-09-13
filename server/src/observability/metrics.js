// Enterprise Metrics & APM Telemetry Engine

const _counters = {
  httpRequestsTotal: 0,
  httpErrorsTotal: 0,
  smsDispatchesTotal: 0,
  smsFailuresTotal: 0,
  pushDispatchesTotal: 0,
  pushFailuresTotal: 0,
  erpSyncsTotal: 0,
  erpFailuresTotal: 0,
};

const _durations = [];
const MAX_DURATIONS = 2000;

function recordHttpRequest(method, route, statusCode, durationMs) {
  _counters.httpRequestsTotal++;
  if (statusCode >= 400) {
    _counters.httpErrorsTotal++;
  }
  _durations.push(durationMs);
  if (_durations.length > MAX_DURATIONS) {
    _durations.shift();
  }
}

function recordSmsDispatch(success) {
  _counters.smsDispatchesTotal++;
  if (!success) _counters.smsFailuresTotal++;
}

function recordPushDispatch(success) {
  _counters.pushDispatchesTotal++;
  if (!success) _counters.pushFailuresTotal++;
}

function recordErpSync(success) {
  _counters.erpSyncsTotal++;
  if (!success) _counters.erpFailuresTotal++;
}

function calculatePercentiles() {
  if (_durations.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [..._durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  return { p50, p95, p99 };
}

function getMetricsSnapshot() {
  const memory = process.memoryUsage();
  const percentiles = calculatePercentiles();
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
    },
    http: {
      totalRequests: _counters.httpRequestsTotal,
      totalErrors: _counters.httpErrorsTotal,
      errorRate: _counters.httpRequestsTotal > 0 
        ? Math.round((_counters.httpErrorsTotal / _counters.httpRequestsTotal) * 10000) / 100 
        : 0,
      latency: percentiles,
    },
    integrations: {
      sms: {
        total: _counters.smsDispatchesTotal,
        failures: _counters.smsFailuresTotal,
      },
      push: {
        total: _counters.pushDispatchesTotal,
        failures: _counters.pushFailuresTotal,
      },
      erp: {
        total: _counters.erpSyncsTotal,
        failures: _counters.erpFailuresTotal,
      },
    },
  };
}

/**
 * Returns metrics in standard Prometheus line protocol.
 */
function toPrometheusText() {
  const m = getMetricsSnapshot();
  return [
    '# HELP http_requests_total Total number of HTTP requests processed',
    '# TYPE http_requests_total counter',
    `http_requests_total ${m.http.totalRequests}`,
    '# HELP http_errors_total Total number of HTTP error responses (>=400)',
    '# TYPE http_errors_total counter',
    `http_errors_total ${m.http.totalErrors}`,
    '# HELP http_request_duration_ms_p95 95th percentile of request duration in ms',
    '# TYPE http_request_duration_ms_p95 gauge',
    `http_request_duration_ms_p95 ${m.http.latency.p95}`,
    '# HELP node_memory_heap_used_bytes Node.js Heap Used Memory',
    '# TYPE node_memory_heap_used_bytes gauge',
    `node_memory_heap_used_bytes ${process.memoryUsage().heapUsed}`,
    '# HELP sms_dispatches_total Total outbound SMS attempts',
    '# TYPE sms_dispatches_total counter',
    `sms_dispatches_total ${m.integrations.sms.total}`,
    '# HELP push_dispatches_total Total outbound Push notification attempts',
    '# TYPE push_dispatches_total counter',
    `push_dispatches_total ${m.integrations.push.total}`,
  ].join('\n') + '\n';
}

module.exports = {
  recordHttpRequest,
  recordSmsDispatch,
  recordPushDispatch,
  recordErpSync,
  getMetricsSnapshot,
  toPrometheusText,
};
