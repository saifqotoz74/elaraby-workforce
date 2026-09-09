import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;

/// Base typed error domain representation for the Elaraby Connect platform.
sealed class AppError implements Exception {
  final String message;
  final String? code;
  final int? statusCode;
  final dynamic cause;

  const AppError(
    this.message, {
    this.code,
    this.statusCode,
    this.cause,
  });

  /// User-facing localized message in Arabic.
  String get userFacingMessageAr;

  /// User-facing localized message in English.
  String get userFacingMessageEn;

  /// Returns user-facing message according to the active language.
  String userFacingMessage([bool isArabic = false]) =>
      isArabic ? userFacingMessageAr : userFacingMessageEn;

  @override
  String toString() =>
      '$runtimeType: $message (code: $code, status: $statusCode)';

  /// Maps an HTTP status code, response body, and optional exception to a typed [AppError].
  static AppError fromResponse(
    int statusCode, {
    Map<String, dynamic>? body,
    String? fallbackMessage,
    dynamic cause,
  }) {
    final serverMsg = body?['error'] as String? ??
        body?['message'] as String? ??
        fallbackMessage;
    final serverCode = body?['code'] as String?;

    switch (statusCode) {
      case 400:
        final fields = (body?['errors'] is Map<String, dynamic>
                ? body!['errors'] as Map<String, dynamic>
                : null) ??
            (body?['fields'] is Map<String, dynamic>
                ? body!['fields'] as Map<String, dynamic>
                : null);
        return ValidationError(
          serverMsg ?? 'Invalid request parameters',
          code: serverCode ?? 'validation_error',
          statusCode: statusCode,
          fieldErrors: fields,
          cause: cause,
        );
      case 401:
        return UnauthorizedError(
          serverMsg ?? 'Authentication required or session expired',
          serverCode ?? 'unauthorized',
          statusCode,
          cause,
        );
      case 403:
        return ForbiddenError(
          serverMsg ?? 'Access forbidden for this account',
          serverCode ?? 'forbidden',
          statusCode,
          cause,
        );
      case 404:
        return NotFoundError(
          serverMsg ?? 'Requested resource was not found',
          serverCode ?? 'not_found',
          statusCode,
          cause,
        );
      case 408:
        return TimeoutError(
          serverMsg ?? 'Request timed out',
          serverCode ?? 'timeout',
          statusCode,
          cause,
        );
      case 429:
        final retryAfter = body?['retryAfter'] as int?;
        return RateLimitError(
          serverMsg ?? 'Rate limit exceeded. Please wait before retrying.',
          serverCode ?? 'rate_limit_exceeded',
          statusCode,
          retryAfter,
          cause,
        );
      default:
        if (statusCode >= 500 && statusCode < 600) {
          return ServerError(
            serverMsg ?? 'Internal server error occurred',
            serverCode ?? 'server_error',
            statusCode,
            cause,
          );
        }
        return UnknownError(
          serverMsg ?? 'An unexpected error occurred (status: $statusCode)',
          serverCode ?? 'unknown_error',
          statusCode,
          cause,
        );
    }
  }

  /// Maps any caught Dart exception/error to a typed [AppError].
  static AppError fromException(dynamic exception, [StackTrace? stackTrace]) {
    if (exception is AppError) return exception;
    if (exception is TimeoutException) {
      return TimeoutError(
        exception.message ?? 'Operation timed out',
        'timeout_error',
        408,
        exception,
      );
    }
    if (exception is SocketException ||
        exception is http.ClientException ||
        (exception is HttpException)) {
      return NetworkError(
        exception.toString(),
        'network_error',
        null,
        exception,
      );
    }
    if (exception is FormatException) {
      return ValidationError(
        'Malformed data format: ${exception.message}',
        code: 'format_error',
        cause: exception,
      );
    }
    return UnknownError(
      exception?.toString() ?? 'Unknown error occurred',
      'unknown_error',
      null,
      exception,
    );
  }
}

class NetworkError extends AppError {
  const NetworkError([
    super.message = 'Network connection failed',
    String? code = 'network_error',
    int? statusCode,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'فشل الاتصال بالشبكة. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';

  @override
  String get userFacingMessageEn =>
      'Network connection failed. Please check your internet connection and try again.';
}

class TimeoutError extends AppError {
  const TimeoutError([
    super.message = 'Request timed out',
    String? code = 'timeout_error',
    int? statusCode = 408,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'انتهت مهلة الطلب قبل تلقي استجابة. يرجى المحاولة مرة أخرى.';

  @override
  String get userFacingMessageEn =>
      'Request timed out before receiving a response. Please try again.';
}

class UnauthorizedError extends AppError {
  const UnauthorizedError([
    super.message = 'Authentication required or session expired',
    String? code = 'unauthorized',
    int? statusCode = 401,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'انتهت صلاحية الجلسة أو غير مصرح. يرجى تسجيل الدخول مجدداً.';

  @override
  String get userFacingMessageEn =>
      'Session expired or unauthorized. Please sign in again.';
}

typedef AuthError = UnauthorizedError;

class ForbiddenError extends AppError {
  const ForbiddenError([
    super.message = 'Access forbidden for this account',
    String? code = 'forbidden',
    int? statusCode = 403,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'ليس لديك الصلاحية الكافية للوصول إلى هذا المورد أو العملية.';

  @override
  String get userFacingMessageEn =>
      'You do not have permission to access this resource or perform this action.';
}

class ValidationError extends AppError {
  final Map<String, dynamic>? fieldErrors;

  const ValidationError(
    super.message, {
    super.code = 'validation_error',
    super.statusCode = 400,
    this.fieldErrors,
    super.cause,
  });

  @override
  String get userFacingMessageAr => message.isNotEmpty
      ? message
      : 'البيانات المدخلة غير صحيحة. يرجى مراجعة المدخلات.';

  @override
  String get userFacingMessageEn => message.isNotEmpty
      ? message
      : 'Invalid input data. Please verify your entries.';
}

class ServerError extends AppError {
  const ServerError([
    super.message = 'Internal server error occurred',
    String? code = 'server_error',
    int? statusCode = 500,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'حدث خطأ في خادم النظام. تم تسجيل المشكلة وجاري العمل على حلها.';

  @override
  String get userFacingMessageEn =>
      'Internal server error. The issue has been logged and is being resolved.';
}

class NotFoundError extends AppError {
  const NotFoundError([
    super.message = 'Requested resource was not found',
    String? code = 'not_found',
    int? statusCode = 404,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'المورد أو السجل المطلوب غير موجود في النظام.';

  @override
  String get userFacingMessageEn =>
      'The requested resource or record was not found.';
}

class RateLimitError extends AppError {
  final int? retryAfterSeconds;

  const RateLimitError([
    super.message = 'Rate limit exceeded. Please wait before retrying.',
    String? code = 'rate_limit_exceeded',
    int? statusCode = 429,
    this.retryAfterSeconds,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr => retryAfterSeconds != null
      ? 'تم تجاوز حد المحاولات المسموح به. يرجى الانتظار $retryAfterSeconds ثانية.'
      : 'تم تجاوز حد المحاولات المسموح به. يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.';

  @override
  String get userFacingMessageEn => retryAfterSeconds != null
      ? 'Too many attempts. Please wait $retryAfterSeconds seconds before trying again.'
      : 'Too many attempts. Please wait a moment before trying again.';
}

class UnknownError extends AppError {
  const UnknownError([
    super.message = 'An unexpected error occurred',
    String? code = 'unknown_error',
    int? statusCode,
    dynamic cause,
  ]) : super(code: code, statusCode: statusCode, cause: cause);

  @override
  String get userFacingMessageAr =>
      'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.';

  @override
  String get userFacingMessageEn =>
      'An unexpected error occurred. Please try again or contact support.';
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

  bool get isFailure => !isSuccess;

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
