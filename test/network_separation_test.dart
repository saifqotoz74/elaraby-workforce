import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:elaraby_workforce/core/errors/app_error.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/network/connectivity_service.dart';
import 'package:elaraby_workforce/core/state/ui_state.dart';
import 'package:elaraby_workforce/features/main_navigation/presentation/screens/main_nav_screen.dart';
import 'package:elaraby_workforce/l10n/generated/app_localizations.dart';

void main() {
  setUp(() {
    ConnectivityService.instance.setMockOnline(true);
    ApiClient.offlineMockMode = false;
  });

  tearDown(() {
    ConnectivityService.instance.setMockOnline(null);
    ApiClient.offlineMockMode = false;
  });

  group('Phase 11: Explicit Error Classification & Separation', () {
    test('Offline error is distinctly classified as AppErrorKind.offline', () {
      const err = NetworkError('No cellular or wifi network available');
      expect(err.kind, AppErrorKind.offline);
      expect(err.isOffline, isTrue);
      expect(err.isTimeout, isFalse);
      expect(err.isServerError, isFalse);
      expect(err.isNotFound, isFalse);
      expect(err.isUnauthorized, isFalse);
      expect(err.isForbidden, isFalse);
      expect(err.isRateLimit, isFalse);
      expect(err.statusCode, isNull);
    });

    test('Timeout error is distinctly classified as AppErrorKind.timeout', () {
      const err = TimeoutError('Request timed out after 6 seconds');
      expect(err.kind, AppErrorKind.timeout);
      expect(err.isTimeout, isTrue);
      expect(err.isOffline, isFalse);
      expect(err.isServerError, isFalse);
      expect(err.statusCode, 408);
    });

    test(
        '401 Unauthorized is distinctly classified as AppErrorKind.unauthorized',
        () {
      const err = UnauthorizedError('Session expired');
      expect(err.kind, AppErrorKind.unauthorized);
      expect(err.isUnauthorized, isTrue);
      expect(err.isOffline, isFalse);
      expect(err.statusCode, 401);
    });

    test('403 Forbidden is distinctly classified as AppErrorKind.forbidden',
        () {
      const err = ForbiddenError('Access forbidden');
      expect(err.kind, AppErrorKind.forbidden);
      expect(err.isForbidden, isTrue);
      expect(err.isOffline, isFalse);
      expect(err.statusCode, 403);
    });

    test('404 Not Found is distinctly classified as AppErrorKind.notFound', () {
      const err = NotFoundError('Resource not found');
      expect(err.kind, AppErrorKind.notFound);
      expect(err.isNotFound, isTrue);
      expect(err.isOffline, isFalse);
      expect(err.statusCode, 404);
    });

    test('429 Rate Limit is distinctly classified as AppErrorKind.rateLimit',
        () {
      const err = RateLimitError('Too many attempts', 'rate_limit', 429, 60);
      expect(err.kind, AppErrorKind.rateLimit);
      expect(err.isRateLimit, isTrue);
      expect(err.isOffline, isFalse);
      expect(err.statusCode, 429);
      expect(err.retryAfterSeconds, 60);
    });

    test(
        '500 Server Error is distinctly classified as AppErrorKind.serverError',
        () {
      const err = ServerError('Database error', 'db_error', 500);
      expect(err.kind, AppErrorKind.serverError);
      expect(err.isServerError, isTrue);
      expect(err.isOffline, isFalse);
      expect(err.statusCode, 500);
    });
  });

  group('Phase 11: HTTP Failures Must NEVER Be Treated as Offline', () {
    test(
        'HTTP 500 Internal Server Error returns ServerError and preserves online status',
        () async {
      final mock = MockClient((req) async {
        return http.Response(
            '{"error":"Database failure","code":"db_err"}', 500);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/test-endpoint');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<ServerError>());
      expect(res.error!.isOffline, isFalse);
      expect(res.error!.isServerError, isTrue);
      expect(res.error!.statusCode, 500);
      // Ensure ConnectivityService is still reporting online
      expect(ConnectivityService.instance.isOnline, isTrue);
      expect(Backend.instance.online.value, isTrue);
    });

    test('HTTP 404 Not Found returns NotFoundError and preserves online status',
        () async {
      final mock = MockClient((req) async {
        return http.Response(
            '{"error":"Record missing","code":"not_found"}', 404);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/missing-record');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<NotFoundError>());
      expect(res.error!.isOffline, isFalse);
      expect(res.error!.isNotFound, isTrue);
      expect(res.error!.statusCode, 404);
      expect(ConnectivityService.instance.isOnline, isTrue);
      expect(Backend.instance.online.value, isTrue);
    });

    test(
        'HTTP 401 Unauthorized returns UnauthorizedError and preserves online status',
        () async {
      final mock = MockClient((req) async {
        return http.Response(
            '{"error":"Token revoked","code":"token_revoked"}', 401);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/profile');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<UnauthorizedError>());
      expect(res.error!.isOffline, isFalse);
      expect(res.error!.isUnauthorized, isTrue);
      expect(ConnectivityService.instance.isOnline, isTrue);
      expect(Backend.instance.online.value, isTrue);
    });

    test(
        'HTTP 403 Forbidden returns ForbiddenError and preserves online status',
        () async {
      final mock = MockClient((req) async {
        return http.Response(
            '{"error":"Forbidden","code":"access_denied"}', 403);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/admin');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<ForbiddenError>());
      expect(res.error!.isOffline, isFalse);
      expect(res.error!.isForbidden, isTrue);
      expect(ConnectivityService.instance.isOnline, isTrue);
    });

    test(
        'HTTP 429 Rate Limit returns RateLimitError and preserves online status',
        () async {
      final mock = MockClient((req) async {
        return http.Response(
          '{"error":"Too many requests","code":"rate_limit_exceeded","retryAfter":30}',
          429,
        );
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('POST', '/auth/otp');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<RateLimitError>());
      expect(res.error!.isOffline, isFalse);
      expect(res.error!.isRateLimit, isTrue);
      expect((res.error as RateLimitError).retryAfterSeconds, 30);
      expect(ConnectivityService.instance.isOnline, isTrue);
    });

    test(
        'TimeoutException returns TimeoutError and does NOT set device offline',
        () async {
      final mock = MockClient((req) async {
        throw TimeoutException('Request timed out waiting for server');
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/slow-endpoint');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<TimeoutError>());
      expect(res.error!.isOffline, isFalse);
      expect(res.error!.isTimeout, isTrue);
      // Timeout must NOT mark device as offline
      expect(ConnectivityService.instance.isOnline, isTrue);
    });
  });

  group('Phase 11: ConnectivityService & Actual Network State', () {
    test('ConnectivityService accurately tracks online and offline transitions',
        () {
      final service = ConnectivityService.instance;

      service.setMockOnline(false);
      expect(service.isOnline, isFalse);
      expect(Backend.instance.online.value, isFalse);

      service.setMockOnline(true);
      expect(service.isOnline, isTrue);
      expect(Backend.instance.online.value, isTrue);
    });

    test('ApiClient immediately returns NetworkError when device is offline',
        () async {
      ConnectivityService.instance.setMockOnline(false);

      final mock = MockClient((req) async {
        return http.Response('{"ok":true}', 200);
      });

      final api = ApiClient.createForTesting(mockClient: mock);
      final res = await api.request('GET', '/profile');

      expect(res.isFailure, isTrue);
      expect(res.error, isA<NetworkError>());
      expect(res.error!.isOffline, isTrue);
    });
  });

  group('Phase 11: UiState Error Categorization & Offline Preservation', () {
    test(
        'UiState.fromError preserves cached data in offline state when NetworkError occurs',
        () {
      const error = NetworkError();
      final state = UiState<Map<String, dynamic>>.fromError(
        error,
        previousData: {'cached': true, 'name': 'Ahmed'},
      );

      expect(state.isOffline, isTrue);
      expect(state.hasData, isTrue);
      expect(state.data?['name'], 'Ahmed');
      expect(state.isError, isFalse);
    });

    test(
        'UiState.fromError returns error state with typed AppError for 500 ServerError',
        () {
      const error = ServerError('Internal crash', 'server_error', 500);
      final state = UiState<String>.fromError(
        error,
        previousData: 'old_data',
      );

      expect(state.isError, isTrue);
      expect(state.isOffline, isFalse);
      expect(state.error, isA<ServerError>());
      expect(state.errorKind, AppErrorKind.serverError);
    });
  });

  group('Phase 11: Real-time Offline Banner in MainNavScreen', () {
    testWidgets('Offline awareness banner only renders when genuinely offline',
        (tester) async {
      Backend.instance.online.value = true;

      await tester.pumpWidget(
        const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MainNavScreen(),
        ),
      );
      await tester.pump();

      // Banner should not be visible when online
      expect(find.byIcon(Icons.cloud_off_rounded), findsNothing);

      // Now simulate genuine network disconnection
      Backend.instance.online.value = false;
      await tester.pump();

      // Banner should now appear
      expect(find.byIcon(Icons.cloud_off_rounded), findsOneWidget);

      // Reconnect online
      Backend.instance.online.value = true;
      await tester.pump();

      // Banner should disappear
      expect(find.byIcon(Icons.cloud_off_rounded), findsNothing);
    });
  });
}
