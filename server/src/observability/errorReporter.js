// Enterprise Error Reporting Abstraction
// Supports: Sentry (production) and NoOp/Local reporter (development/testing)

class BaseErrorReporter {
  captureException(err, context = {}) {
    throw new Error('captureException must be implemented by concrete ErrorReporter');
  }
}

class NoOpReporter extends BaseErrorReporter {
  constructor() {
    super();
    this.capturedErrors = [];
  }

  captureException(err, context = {}) {
    const errorEntry = {
      message: err?.message || String(err),
      name: err?.name || 'Error',
      stack: err?.stack,
      context,
      timestamp: new Date().toISOString(),
    };
    this.capturedErrors.push(errorEntry);
    return `err_local_${Date.now()}`;
  }

  clear() {
    this.capturedErrors = [];
  }
}

class SentryReporter extends BaseErrorReporter {
  constructor() {
    super();
    this._initialized = false;
  }

  init() {
    if (process.env.SENTRY_DSN && !this._initialized) {
      try {
        // Safe require if @sentry/node is available
        const Sentry = require('@sentry/node');
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV || 'production',
        });
        this._sentry = Sentry;
        this._initialized = true;
      } catch (_) {
        // Fallback without failing startup
      }
    }
  }

  captureException(err, context = {}) {
    if (this._sentry && this._initialized) {
      return this._sentry.captureException(err, { extra: context });
    }
    return null;
  }
}

const noOp = new NoOpReporter();
const sentry = new SentryReporter();

function captureException(err, context = {}) {
  if (process.env.SENTRY_DSN) {
    sentry.init();
    const sentryId = sentry.captureException(err, context);
    if (sentryId) return sentryId;
  }
  return noOp.captureException(err, context);
}

module.exports = {
  captureException,
  NoOpReporter,
  SentryReporter,
  localReporter: noOp,
};
