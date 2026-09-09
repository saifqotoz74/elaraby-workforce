import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/navigation/app_router.dart';
import 'package:elaraby_workforce/core/navigation/app_routes.dart';
import 'package:elaraby_workforce/core/navigation/unknown_route_screen.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';

void setupTestScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await initializeDateFormatting('en', null);
    await initializeDateFormatting('ar', null);
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    AppAuthState.instance.markLocked();
  });

  group('AppRoutes & Route Classifications', () {
    test('Defines all expected route constants', () {
      expect(AppRoutes.splash, '/');
      expect(AppRoutes.getStarted, '/get-started');
      expect(AppRoutes.nationalId, '/national-id');
      expect(AppRoutes.otp, '/otp');
      expect(AppRoutes.profileConfirmation, '/profile-confirmation');
      expect(AppRoutes.createPin, '/create-pin');
      expect(AppRoutes.confirmPin, '/confirm-pin');
      expect(AppRoutes.lock, '/lock');
      expect(AppRoutes.main, '/main');
      expect(AppRoutes.inbox, '/inbox');
      expect(AppRoutes.benefits, '/benefits');
      expect(AppRoutes.vacationBalance, '/vacation-balance');
      expect(AppRoutes.salarySlip, '/salary-slip');
      expect(AppRoutes.shiftSchedule, '/shift-schedule');
      expect(AppRoutes.requestLeave, '/request-leave');
      expect(AppRoutes.hrRequest, '/hr-request');
      expect(AppRoutes.raiseConcern, '/raise-concern');
      expect(AppRoutes.employeeData, '/employee-data');
      expect(AppRoutes.yourRequests, '/your-requests');
      expect(AppRoutes.unknown, '/404');
    });

    test('isAuthRoute correctly classifies onboarding and lock routes', () {
      expect(AppRoutes.isAuthRoute(AppRoutes.splash), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.getStarted), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.nationalId), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.otp), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.profileConfirmation), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.createPin), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.confirmPin), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.lock), isTrue);

      expect(AppRoutes.isAuthRoute(AppRoutes.main), isFalse);
      expect(AppRoutes.isAuthRoute(AppRoutes.salarySlip), isFalse);
      expect(AppRoutes.isAuthRoute(AppRoutes.unknown), isFalse);
    });

    test('isProtectedRoute correctly identifies protected resources', () {
      expect(AppRoutes.isProtectedRoute(AppRoutes.main), isTrue);
      expect(AppRoutes.isProtectedRoute(AppRoutes.salarySlip), isTrue);
      expect(AppRoutes.isProtectedRoute(AppRoutes.vacationBalance), isTrue);
      expect(AppRoutes.isProtectedRoute(AppRoutes.requestLeave), isTrue);
      expect(AppRoutes.isProtectedRoute(AppRoutes.inbox), isTrue);
      expect(AppRoutes.isProtectedRoute(AppRoutes.benefits), isTrue);

      expect(AppRoutes.isProtectedRoute(AppRoutes.splash), isFalse);
      expect(AppRoutes.isProtectedRoute(AppRoutes.getStarted), isFalse);
      expect(AppRoutes.isProtectedRoute(AppRoutes.lock), isFalse);
      expect(AppRoutes.isProtectedRoute(AppRoutes.unknown), isFalse);
    });
  });

  group('AppAuthState', () {
    test('Correctly manages unlock/lock transitions and notifies listeners',
        () {
      final auth = AppAuthState.instance;
      auth.markLocked();
      expect(auth.isUnlocked, isFalse);

      var notified = false;
      auth.addListener(() => notified = true);

      auth.markUnlocked();
      expect(auth.isUnlocked, isTrue);
      expect(notified, isTrue);

      notified = false;
      auth.markLocked();
      expect(auth.isUnlocked, isFalse);
      expect(notified, isTrue);
    });
  });

  group('UnknownRouteScreen (404)', () {
    testWidgets(
        'Renders 404 page with missing path and Return Home button (English)',
        (tester) async {
      setupTestScreen(tester);
      AppLocale.instance.setLocale(const Locale('en'));
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: UnknownRouteScreen(path: '/invalid/broken-link'),
          ),
        ),
      );

      expect(find.text('Page Not Found'), findsOneWidget);
      expect(find.text('Return to Home'), findsOneWidget);
      expect(find.textContaining('/invalid/broken-link'), findsOneWidget);
    });

    testWidgets(
        'Renders 404 page with missing path and Return Home button (Arabic)',
        (tester) async {
      setupTestScreen(tester);
      AppLocale.instance.setLocale(const Locale('ar'));
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: UnknownRouteScreen(path: '/invalid/broken-link'),
          ),
        ),
      );

      expect(find.text('الصفحة غير موجودة'), findsOneWidget);
      expect(find.text('العودة للرئيسية'), findsOneWidget);
      expect(find.textContaining('/invalid/broken-link'), findsOneWidget);
    });
  });

  group('AppRouter Auth Guards & Route Redirections', () {
    testWidgets(
        'Redirects un-onboarded user attempting to access protected route to /get-started',
        (tester) async {
      setupTestScreen(tester);
      await LocalStore.instance.setOnboarded(false);
      AppAuthState.instance.markLocked();

      final router = createAppRouter(initialLocation: AppRoutes.salarySlip);
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final location = router.routerDelegate.currentConfiguration.uri.path;
      expect(location, AppRoutes.getStarted);
    });

    testWidgets(
        'Redirects fully onboarded user who is locked to /lock when accessing protected route',
        (tester) async {
      setupTestScreen(tester);
      await LocalStore.instance.setOnboarded(true);
      await LocalStore.instance.setPin('1234');
      AppAuthState.instance.markLocked();

      final router =
          createAppRouter(initialLocation: AppRoutes.vacationBalance);
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final location = router.routerDelegate.currentConfiguration.uri.path;
      expect(location, AppRoutes.lock);
    });

    testWidgets(
        'Redirects fully onboarded user sitting on get-started to /lock when locked',
        (tester) async {
      setupTestScreen(tester);
      await LocalStore.instance.setOnboarded(true);
      await LocalStore.instance.setPin('1234');
      AppAuthState.instance.markLocked();

      final router = createAppRouter(initialLocation: AppRoutes.getStarted);
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final location = router.routerDelegate.currentConfiguration.uri.path;
      expect(location, AppRoutes.lock);
    });

    testWidgets(
        'Redirects fully onboarded user sitting on get-started to /main when unlocked',
        (tester) async {
      setupTestScreen(tester);
      await LocalStore.instance.setOnboarded(true);
      await LocalStore.instance.setPin('1234');
      AppAuthState.instance.markUnlocked();

      final router = createAppRouter(initialLocation: AppRoutes.getStarted);
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final location = router.routerDelegate.currentConfiguration.uri.path;
      expect(location, AppRoutes.main);
    });

    testWidgets('Redirects unlocked user sitting on lock screen to /main',
        (tester) async {
      setupTestScreen(tester);
      await LocalStore.instance.setOnboarded(true);
      await LocalStore.instance.setPin('1234');
      AppAuthState.instance.markUnlocked();

      final router = createAppRouter(initialLocation: AppRoutes.lock);
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      final location = router.routerDelegate.currentConfiguration.uri.path;
      expect(location, AppRoutes.main);
    });

    testWidgets(
        'Session expiration callback marks auth state locked and redirects to /lock',
        (tester) async {
      setupTestScreen(tester);
      await LocalStore.instance.setOnboarded(true);
      await LocalStore.instance.setPin('1234');
      AppAuthState.instance.markUnlocked();

      final router = createAppRouter(initialLocation: AppRoutes.main);
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(AppAuthState.instance.isUnlocked, isTrue);

      // Trigger session expiration (HTTP 401 callback)
      ApiClient.onSessionExpired?.call();
      await tester.pumpAndSettle();

      expect(AppAuthState.instance.isUnlocked, isFalse);
      final location = router.routerDelegate.currentConfiguration.uri.path;
      expect(location, AppRoutes.lock);
    });
  });
}
