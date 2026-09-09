import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:elaraby_workforce/core/errors/app_error.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/utils/ui_feedback.dart';

void main() {
  group('Phase 5: Domain Error Classes & Localization', () {
    test('NetworkError provides valid Arabic and English messages', () {
      const err = NetworkError();
      expect(err.code, 'network_error');
      expect(err.userFacingMessageEn, contains('Network connection failed'));
      expect(err.userFacingMessageAr, contains('فشل الاتصال بالشبكة'));
      expect(err.userFacingMessage(true), err.userFacingMessageAr);
      expect(err.userFacingMessage(false), err.userFacingMessageEn);
    });

    test('TimeoutError provides valid Arabic and English messages', () {
      const err = TimeoutError();
      expect(err.code, 'timeout_error');
      expect(err.statusCode, 408);
      expect(err.userFacingMessageEn, contains('timed out'));
      expect(err.userFacingMessageAr, contains('انتهت مهلة الطلب'));
    });

    test('UnauthorizedError provides valid Arabic and English messages', () {
      const err = UnauthorizedError();
      expect(err.code, 'unauthorized');
      expect(err.statusCode, 401);
      expect(err.userFacingMessageEn, contains('unauthorized'));
      expect(err.userFacingMessageAr, contains('انتهت صلاحية الجلسة'));
    });

    test('ForbiddenError provides valid Arabic and English messages', () {
      const err = ForbiddenError();
      expect(err.code, 'forbidden');
      expect(err.statusCode, 403);
      expect(err.userFacingMessageEn, contains('do not have permission'));
      expect(err.userFacingMessageAr, contains('ليس لديك الصلاحية'));
    });

    test('ValidationError supports custom and default messages', () {
      const defaultErr = ValidationError('');
      expect(defaultErr.code, 'validation_error');
      expect(defaultErr.statusCode, 400);
      expect(defaultErr.userFacingMessageEn, contains('Invalid input data'));
      expect(defaultErr.userFacingMessageAr,
          contains('البيانات المدخلة غير صحيحة'));

      const customErr = ValidationError('Custom format error',
          fieldErrors: {'nationalId': 'Too short'});
      expect(customErr.message, 'Custom format error');
      expect(customErr.fieldErrors?['nationalId'], 'Too short');
      expect(customErr.userFacingMessage(false), 'Custom format error');
    });

    test('ServerError provides valid Arabic and English messages', () {
      const err = ServerError('Database crashed', 'db_crash', 500);
      expect(err.code, 'db_crash');
      expect(err.statusCode, 500);
      expect(err.userFacingMessageEn, contains('Internal server error'));
      expect(err.userFacingMessageAr, contains('حدث خطأ في خادم النظام'));
    });

    test('NotFoundError provides valid Arabic and English messages', () {
      const err = NotFoundError();
      expect(err.code, 'not_found');
      expect(err.statusCode, 404);
      expect(err.userFacingMessageEn, contains('not found'));
      expect(err.userFacingMessageAr, contains('غير موجود في النظام'));
    });

    test('RateLimitError handles retry interval correctly', () {
      const errWithSec =
          RateLimitError('Too many attempts', 'rate_limit', 429, 30);
      expect(errWithSec.retryAfterSeconds, 30);
      expect(errWithSec.userFacingMessageEn, contains('wait 30 seconds'));
      expect(errWithSec.userFacingMessageAr, contains('الانتظار 30 ثانية'));

      const errNoSec = RateLimitError();
      expect(errNoSec.retryAfterSeconds, isNull);
      expect(errNoSec.userFacingMessageEn, contains('Please wait a moment'));
      expect(errNoSec.userFacingMessageAr, contains('يرجى الانتظار قليلاً'));
    });

    test('UnknownError provides fallback messages', () {
      const err = UnknownError();
      expect(err.code, 'unknown_error');
      expect(err.userFacingMessageEn, contains('unexpected error occurred'));
      expect(err.userFacingMessageAr, contains('حدث خطأ غير متوقع'));
    });
  });

  group('Phase 5: AppError.fromResponse Mapping', () {
    test('Maps HTTP 400 to ValidationError', () {
      final err = AppError.fromResponse(400, body: {
        'error': 'Bad request',
        'code': 'invalid_payload',
        'errors': {'email': 'Invalid email format'},
      });
      expect(err, isA<ValidationError>());
      final valErr = err as ValidationError;
      expect(valErr.message, 'Bad request');
      expect(valErr.code, 'invalid_payload');
      expect(valErr.fieldErrors?['email'], 'Invalid email format');
    });

    test('Maps HTTP 401 to UnauthorizedError', () {
      final err = AppError.fromResponse(401,
          body: {'error': 'Token expired', 'code': 'token_expired'});
      expect(err, isA<UnauthorizedError>());
      expect(err.statusCode, 401);
      expect(err.code, 'token_expired');
    });

    test('Maps HTTP 403 to ForbiddenError', () {
      final err = AppError.fromResponse(403,
          body: {'error': 'Access denied', 'code': 'access_denied'});
      expect(err, isA<ForbiddenError>());
      expect(err.statusCode, 403);
    });

    test('Maps HTTP 404 to NotFoundError', () {
      final err = AppError.fromResponse(404,
          body: {'error': 'Employee record not found'});
      expect(err, isA<NotFoundError>());
      expect(err.statusCode, 404);
    });

    test('Maps HTTP 408 to TimeoutError', () {
      final err = AppError.fromResponse(408);
      expect(err, isA<TimeoutError>());
      expect(err.statusCode, 408);
    });

    test('Maps HTTP 429 to RateLimitError with retryAfter', () {
      final err = AppError.fromResponse(429, body: {'retryAfter': 45});
      expect(err, isA<RateLimitError>());
      expect((err as RateLimitError).retryAfterSeconds, 45);
    });

    test('Maps HTTP 500 and 503 to ServerError', () {
      final err500 =
          AppError.fromResponse(500, body: {'error': 'Database down'});
      expect(err500, isA<ServerError>());
      expect(err500.statusCode, 500);

      final err503 = AppError.fromResponse(503);
      expect(err503, isA<ServerError>());
      expect(err503.statusCode, 503);
    });

    test('Maps unexpected status code to UnknownError', () {
      final err = AppError.fromResponse(418, body: {'error': 'Im a teapot'});
      expect(err, isA<UnknownError>());
      expect(err.statusCode, 418);
    });
  });

  group('Phase 5: AppError.fromException Mapping', () {
    test('Maps TimeoutException to TimeoutError', () {
      final ex = TimeoutException('Connection timed out after 6 seconds');
      final err = AppError.fromException(ex);
      expect(err, isA<TimeoutError>());
      expect(err.statusCode, 408);
    });

    test('Maps SocketException to NetworkError', () {
      const ex = SocketException('Failed host lookup');
      final err = AppError.fromException(ex);
      expect(err, isA<NetworkError>());
    });

    test('Maps ClientException to NetworkError', () {
      final ex = http.ClientException('Client socket aborted');
      final err = AppError.fromException(ex);
      expect(err, isA<NetworkError>());
    });

    test('Maps FormatException to ValidationError', () {
      const ex = FormatException('Invalid JSON at character 5');
      final err = AppError.fromException(ex);
      expect(err, isA<ValidationError>());
      expect(err.code, 'format_error');
    });

    test('Returns existing AppError without re-wrapping', () {
      const original = ForbiddenError('Blocked by firewall');
      final err = AppError.fromException(original);
      expect(identical(err, original), isTrue);
    });

    test('Maps arbitrary object to UnknownError', () {
      final err = AppError.fromException('Unexpected string throw');
      expect(err, isA<UnknownError>());
      expect(err.message, contains('Unexpected string throw'));
    });
  });

  group('Phase 5: Result Monad', () {
    test('Result.success holds data and reports status correctly', () {
      const result = Result<int, AppError>.success(42);
      expect(result.isSuccess, isTrue);
      expect(result.isFailure, isFalse);
      expect(result.data, 42);
      expect(result.error, isNull);

      final mapped = result.when(
        success: (data) => 'Value: $data',
        failure: (err) => 'Failed: ${err.message}',
      );
      expect(mapped, 'Value: 42');
    });

    test('Result.failure holds error and reports status correctly', () {
      const err = NotFoundError('User #1 not found');
      const result = Result<int, AppError>.failure(err);
      expect(result.isSuccess, isFalse);
      expect(result.isFailure, isTrue);
      expect(result.data, isNull);
      expect(result.error, isA<NotFoundError>());

      final mapped = result.when(
        success: (data) => 'Value: $data',
        failure: (err) => 'Failed: ${err.message}',
      );
      expect(mapped, 'Failed: User #1 not found');
    });
  });

  group('Phase 5: ApiClient Typed Error Integration', () {
    test('ApiClient.request returns typed ServerError on 500', () async {
      final mock = MockClient((req) async {
        return http.Response(
            '{"error":"Internal crash","code":"server_down"}', 500);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/broken');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<ServerError>());
      expect(api.lastError, isA<ServerError>());
      expect(api.lastError?.code, 'server_down');
    });

    test(
        'ApiClient.request returns NetworkError when offline mock mode is active',
        () async {
      final mock = MockClient((req) async => http.Response('{}', 200));
      final api = ApiClient.createForTesting(mockClient: mock);
      ApiClient.offlineMockMode = true;
      try {
        final res = await api.request('GET', '/profile');
        expect(res.isFailure, isTrue);
        expect(res.error, isA<NetworkError>());
        expect(api.lastError, isA<NetworkError>());
      } finally {
        ApiClient.offlineMockMode = false;
      }
    });

    test('ApiClient.request returns UnauthorizedError on 401', () async {
      final mock = MockClient((req) async {
        return http.Response('{"error":"Session expired"}', 401);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/secure-data');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<UnauthorizedError>());
      expect(api.lastError, isA<UnauthorizedError>());
    });
  });

  group('Phase 5: UI Feedback Widget Test', () {
    testWidgets('UiFeedback.showAppError shows bilingual SnackBar correctly',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  UiFeedback.showAppError(
                    context,
                    const NetworkError(),
                    onRetry: () {},
                  );
                },
                child: const Text('Trigger Error'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Trigger Error'));
      await tester.pump(); // Start animation
      await tester.pump(const Duration(milliseconds: 750)); // Advance animation

      // Should show the network error message
      final isAr = AppLocale.instance.isArabic;
      final expectedText = const NetworkError().userFacingMessage(isAr);
      expect(find.text(expectedText), findsOneWidget);
    });
  });
}
