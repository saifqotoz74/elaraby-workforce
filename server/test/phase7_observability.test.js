// Phase 7: Enterprise Observability, Logging, Metrics & Health Probes Test Suite
const assert = require('assert');
const logger = require('../src/observability/logger');
const metrics = require('../src/observability/metrics');
const { captureException, localReporter } = require('../src/observability/errorReporter');
const correlationMiddleware = require('../src/observability/correlationMiddleware');
const { livenessProbe, readinessProbe } = require('../src/observability/healthCheck');

async function runTests() {
  console.log('=============================================================');
  console.log('--- RUNNING PHASE 7: OBSERVABILITY & APM TEST SUITE ---');
  console.log('=============================================================');

  // Test 1: Structured Logger & Sensitive Data Redaction
  console.log('\n--- 1. Structured Logging & PII / Credential Scrubbing ---');
  const sensitivePayload = {
    employeeId: 'emp_1',
    pin: '1234',
    pinHash: 'secret_hash_scrypt',
    password: 'SuperAdminPass2026',
    token: 'jwt_secret_token_123',
    otpCode: '849201',
    nested: {
      password: 'inner_password',
      safeField: 'normal_data',
    },
  };

  const scrubbed = logger.scrub(sensitivePayload);
  assert.strictEqual(scrubbed.pin, '[REDACTED]', 'PIN must be redacted');
  assert.strictEqual(scrubbed.pinHash, '[REDACTED]', 'PIN hash must be redacted');
  assert.strictEqual(scrubbed.password, '[REDACTED]', 'Password must be redacted');
  assert.strictEqual(scrubbed.token, '[REDACTED]', 'Token must be redacted');
  assert.strictEqual(scrubbed.otpCode, '[REDACTED]', 'OTP code must be redacted');
  assert.strictEqual(scrubbed.nested.password, '[REDACTED]', 'Nested password must be redacted');
  assert.strictEqual(scrubbed.nested.safeField, 'normal_data', 'Safe field must be preserved');
  console.log('✔ Structured logger strictly redacts PINs, passwords, tokens, and OTPs.');

  // Test 2: Request Correlation ID Middleware
  console.log('\n--- 2. Request Correlation & Tracing Propagation ---');
  let nextCalled = false;
  const mockReq = {
    headers: { 'x-correlation-id': 'client_trace_8829' },
    method: 'GET',
    path: '/api/me',
    on() {},
  };
  const headersSet = {};
  const mockRes = {
    setHeader(k, v) { headersSet[k] = v; },
    on() {},
  };

  correlationMiddleware(mockReq, mockRes, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'Middleware must invoke next()');
  assert.strictEqual(mockReq.requestId, 'client_trace_8829', 'Request ID must preserve client trace');
  assert.strictEqual(headersSet['X-Request-ID'], 'client_trace_8829', 'Response header X-Request-ID must be set');
  console.log('✔ Correlation middleware properly binds and echoes correlation trace IDs.');

  // Test 3: APM Metrics & Latency Percentiles
  console.log('\n--- 3. Metrics Tracking & Prometheus Protocol ---');
  metrics.recordHttpRequest('GET', '/api/home', 200, 45);
  metrics.recordHttpRequest('GET', '/api/payroll', 200, 80);
  metrics.recordHttpRequest('POST', '/api/requests', 422, 120);
  metrics.recordSmsDispatch(true);
  metrics.recordPushDispatch(true);
  metrics.recordErpSync(true);

  const snapshot = metrics.getMetricsSnapshot();
  assert.ok(snapshot.http.totalRequests >= 3, 'Total HTTP requests must be tracked');
  assert.ok(snapshot.http.totalErrors >= 1, 'Total errors must be tracked');
  assert.ok(typeof snapshot.http.latency.p95 === 'number', 'p95 latency must be calculated');
  assert.strictEqual(snapshot.integrations.sms.total >= 1, true, 'SMS counter must increment');

  const promText = metrics.toPrometheusText();
  assert.ok(promText.includes('http_requests_total'), 'Prometheus output must define http_requests_total');
  assert.ok(promText.includes('http_errors_total'), 'Prometheus output must define http_errors_total');
  console.log('✔ APM metrics snapshot and Prometheus line protocol generation verified.');

  // Test 4: Error Reporting Abstraction
  console.log('\n--- 4. Pluggable Error Reporting Abstraction ---');
  localReporter.clear();
  const testError = new Error('Database connection failed temporarily');
  const errorId = captureException(testError, { userId: 'emp_123', route: '/api/leave' });
  assert.ok(errorId, 'Must generate and return error tracking ID');
  assert.strictEqual(localReporter.capturedErrors.length, 1, 'Local reporter must capture error');
  assert.strictEqual(localReporter.capturedErrors[0].context.userId, 'emp_123');
  console.log('✔ Error reporter captured exception with context safely.');

  // Test 5: Standardized Liveness & Readiness Probes
  console.log('\n--- 5. Standardized Kubernetes Liveness & Readiness Probes ---');
  let livenessStatus = null;
  let livenessBody = null;
  livenessProbe({}, {
    status(code) {
      livenessStatus = code;
      return { json(data) { livenessBody = data; } };
    },
  });
  assert.strictEqual(livenessStatus, 200, 'Liveness probe must return HTTP 200');
  assert.strictEqual(livenessBody.status, 'UP');

  let readinessStatus = null;
  let readinessBody = null;
  await readinessProbe({}, {
    status(code) {
      readinessStatus = code;
      return { json(data) { readinessBody = data; } };
    },
  });
  assert.strictEqual(readinessStatus, 200, 'Readiness probe must return HTTP 200');
  assert.strictEqual(readinessBody.ready, true);
  console.log('✔ Standardized /health and /readiness probes respond with valid status.');

  console.log('\n=============================================================');
  console.log('ALL PHASE 7 OBSERVABILITY TESTS PASSED (0 FAILURES)');
  console.log('=============================================================');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Phase 7 test failed:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
