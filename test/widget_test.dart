import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/home/data/home_content.dart';
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

  group('AppVersionInfo', () {
    test('version comparison evaluates correctly', () {
      expect(AppVersionInfo.isVersionLower('1.0.0', '1.0.1'), isTrue);
      expect(AppVersionInfo.isVersionLower('1.0.0', '1.1.0'), isTrue);
      expect(AppVersionInfo.isVersionLower('1.0.0', '2.0.0'), isTrue);
      expect(AppVersionInfo.isVersionLower('1.0.0', '1.0.0'), isFalse);
      expect(AppVersionInfo.isVersionLower('1.2.0', '1.0.0'), isFalse);
    });

    test('isUpdateRequired honors forceUpdate and minVersion', () {
      const infoForced = AppVersionInfo(
        currentVersion: '1.0.0',
        minVersion: '1.0.0',
        latestVersion: '1.0.0',
        forceUpdate: true,
        title: 'Title',
        titleEn: 'Title',
        message: 'Msg',
        messageEn: 'Msg',
        updateUrl: 'https://example.com',
      );
      expect(infoForced.isUpdateRequired, isTrue);

      const infoMinVersion = AppVersionInfo(
        currentVersion: '1.0.0',
        minVersion: '1.2.0',
        latestVersion: '1.2.0',
        forceUpdate: false,
        title: 'Title',
        titleEn: 'Title',
        message: 'Msg',
        messageEn: 'Msg',
        updateUrl: 'https://example.com',
      );
      expect(infoMinVersion.isUpdateRequired, isTrue);

      const infoOptional = AppVersionInfo(
        currentVersion: '1.0.0',
        minVersion: '1.0.0',
        latestVersion: '1.1.0',
        forceUpdate: false,
        title: 'Title',
        titleEn: 'Title',
        message: 'Msg',
        messageEn: 'Msg',
        updateUrl: 'https://example.com',
      );
      expect(infoOptional.isUpdateRequired, isFalse);
      expect(infoOptional.isUpdateRecommended, isTrue);
    });
  });

  group('ServerTodayShift', () {
    test('parses from JSON correctly', () {
      final shift = ServerTodayShift.fromJson({
        'shiftKey': 'morning',
        'shiftName': 'Morning Shift',
        'shiftNameAr': 'الوردية الأولى (صباحية)',
        'time': '07:00 AM – 03:00 PM',
        'timeAr': '07:00 ص – 03:00 م',
        'line': 'Benha Complex • Assembly Line 1',
        'lineAr': 'مجمع بنها • خط التجميع 1',
        'offDuty': false,
      });

      expect(shift.shiftKey, 'morning');
      expect(shift.shiftName, 'Morning Shift');
      expect(shift.time, '07:00 AM – 03:00 PM');
      expect(shift.timeAr, '07:00 ص – 03:00 م');
      expect(shift.offDuty, isFalse);
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
