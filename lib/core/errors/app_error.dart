/// Typed error domain representations for the Elaraby Connect platform.
sealed class AppError {
  final String message;
  final String? code;

  const AppError(this.message, {this.code});
}

class NetworkError extends AppError {
  const NetworkError([super.message = 'Network connection failed'])
      : super(code: 'network_error');
}

class AuthError extends AppError {
  const AuthError([super.message = 'Authentication failed or session expired'])
      : super(code: 'auth_error');
}

class ValidationError extends AppError {
  const ValidationError(super.message)
      : super(code: 'validation_error');
}

class ServerError extends AppError {
  final int? statusCode;

  const ServerError([super.message = 'Internal server error occurred', this.statusCode])
      : super(code: 'server_error');
}

/// Generic Result type for operations that can fail without throwing.
class Result<S, F extends AppError> {
  final S? data;
  final F? error;
  final bool isSuccess;

  const Result.success(this.data)
      : error = null,
        isSuccess = true;

  const Result.failure(this.error)
      : data = null,
        isSuccess = false;

  R when<R>({
    required R Function(S data) success,
    required R Function(F error) failure,
  }) {
    if (isSuccess) {
      return success(data as S);
    } else {
      return failure(error as F);
    }
  }
}
