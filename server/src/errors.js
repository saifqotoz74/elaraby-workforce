// Standardized enterprise error hierarchy and HTTP mapping
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      ok: false,
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'VALIDATION_FAILED', details);
  }
}

class ConstraintViolationError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'CONSTRAINT_VIOLATION', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Requested resource was not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict or duplicate entry', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please slow down.', details = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  console.error('[unhandled error]', err.stack || err.message);
  return res.status(500).json({
    ok: false,
    error: 'An internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    details: process.env.NODE_ENV === 'production' ? null : err.message,
  });
}

module.exports = {
  AppError,
  ValidationError,
  ConstraintViolationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  errorHandler,
};
