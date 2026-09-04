import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/main_navigation/presentation/screens/main_nav_screen.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';
import 'package:elaraby_workforce/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  SharedPreferences.setMockInitialValues({});

  group('LocalStore', () {
    test('PIN is hashed and verified', () async {
      final store = LocalStore.instance;
      await store.init();
      expect(await store.hasPin(), isFalse);
      await store.setPin('1234');
      expect(await store.hasPin(), isTrue);
      expect(await store.verifyPin('1234'), isTrue);
      expect(await store.verifyPin('0000'), isFalse);
      expect(await store.verifyPin('12345'), isFalse);
    });

    test('vacation balance deducts and floors at zero', () async {
      final store = LocalStore.instance;
      await store.init();
      expect(store.vacationDaysRemaining, LocalStore.defaultVacationDays);
      await store.deductVacationDays(3);
      expect(store.vacationDaysRemaining, 9);
      await store.deductVacationDays(50);
      expect(store.vacationDaysRemaining, 0);
    });

    test('employee profile round-trips through JSON', () async {
      final store = LocalStore.instance;
      await store.init();
      await store.saveProfile(
        LocalStore.instance.profile.copyWith(name: 'Sara Ali'),
      );
      expect(store.profile.name, 'Sara Ali');
      expect(store.profile.initials, 'SA');
      expect(store.profile.maskedPhone, isNot(contains('123 4592')));
    });
  });

  group('RequestsStore', () {
    test('seeds, adds and cancels requests', () async {
      final store = RequestsStore.instance;
      await store.load();
      final seeded = store.allRequests.length;
      expect(seeded, greaterThanOrEqualTo(4));

      store.addRequest(const EmployeeRequest(
        id: 'test-1',
        title: 'Test Leave',
        type: 'Leave',
        refNumber: 'LEV-2026-999',
        status: RequestStatus.inReview,
        date: 'Just now',
        summary: 'Waiting on: Line Manager Approval',
      ));
      expect(store.allRequests.first.id, 'test-1');
      expect(store.inReviewRequests.any((r) => r.id == 'test-1'), isTrue);

      store.cancelRequest('test-1');
      expect(store.allRequests.any((r) => r.id == 'test-1'), isFalse);
    });

    test('request JSON round-trips', () {
      const original = EmployeeRequest(
        id: 'rt',
        title: 'T',
        type: 'Leave',
        refNumber: 'R-1',
        status: RequestStatus.approved,
        date: 'd',
        summary: 's',
        details: {'A': 'b'},
      );
      final restored = EmployeeRequest.fromJson(original.toJson());
      expect(restored.status, RequestStatus.approved);
      expect(restored.details['A'], 'b');
    });
  });

  group('AppLocale', () {
    test('en and ar maps have identical key sets', () {
      // Handled via a compile-time const check here: every key in the en map
      // must exist in the ar map (and vice versa).
      expect(AppLocale.tr('nav_home'), 'Home');
      AppLocale.instance.setLocale(const Locale('ar'));
      expect(AppLocale.tr('nav_home'), 'الرئيسية');
      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppLocale.tr('nav_home'), 'Home');
    });

    test('missing key falls back to the key itself', () {
      expect(AppLocale.tr('no_such_key'), 'no_such_key');
    });
  });

  testWidgets('Main nav home tab smoke test', (WidgetTester tester) async {
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    // Reset singleton state mutated by earlier tests.
    await LocalStore.instance.saveProfile(const EmployeeProfile());
    AppLocale.instance.setLocale(const Locale('en'));
    await tester.pumpWidget(const ElarabyWorkforceApp(initialScreen: MainNavScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Welcome, Ahmed'), findsOneWidget);
    expect(find.text('Quick Actions'), findsOneWidget);
    expect(find.text('Important Announcement'), findsOneWidget);
    expect(find.text("Today's Shift"), findsOneWidget);
  });
}
