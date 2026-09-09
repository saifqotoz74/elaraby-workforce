import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/theme/app_typography.dart';
import 'package:elaraby_workforce/core/utils/national_id_validator.dart';
import 'package:elaraby_workforce/features/benefits/data/benefits_content.dart';
import 'package:elaraby_workforce/features/home/data/home_content.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';

import 'package:google_fonts/google_fonts.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await ApiClient.instance.init();
    ApiClient.offlineMockMode = true;
  });

  group('Session Teardown & Store Cleanup', () {
    test('Backend.instance.clearAllUserData() resets all stores and session tokens', () async {
      await ApiClient.instance.setToken('test-dummy-jwt');
      expect(ApiClient.instance.token, 'test-dummy-jwt');

      RequestsStore.instance.addRequest(
        const EmployeeRequest(
          id: 'temp-1',
          title: 'Leave',
          type: 'Leave',
          refNumber: 'LEV-001',
          status: RequestStatus.inReview,
          date: '2026-03-01',
          summary: 'Pending',
        ),
      );
      expect(RequestsStore.instance.allRequests, isNotEmpty);

      HomeContent.instance.news = [
        ServerNews(
          id: 'news-1',
          title: 'News Title',
          body: 'News Body',
          createdAt: DateTime.now(),
        ),
      ];
      expect(HomeContent.instance.news, isNotEmpty);

      BenefitsContent.instance.benefits = [
        const ServerBenefit(
          id: 'ben-1',
          title: 'Discount',
          discount: '20%',
          category: 'Retail',
          description: 'Desc',
          validThrough: '2026',
        ),
      ];
      BenefitsContent.instance.loaded = true;
      expect(BenefitsContent.instance.benefits, isNotEmpty);

      // Execute unified teardown
      await Backend.instance.clearAllUserData();

      expect(ApiClient.instance.token, isNull);
      expect(RequestsStore.instance.allRequests, isEmpty);
      expect(HomeContent.instance.news, isEmpty);
      expect(HomeContent.instance.announcement, isNull);
      expect(BenefitsContent.instance.benefits, isEmpty);
      expect(BenefitsContent.instance.trips, isEmpty);
      expect(BenefitsContent.instance.loaded, isFalse);
    });

    test('BenefitsContent.clear() resets content and sets loaded to false', () {
      final content = BenefitsContent.instance;
      content.benefits = [
        const ServerBenefit(
          id: 'b1',
          title: 'T',
          discount: '10%',
          category: 'C',
          description: 'D',
          validThrough: 'V',
        ),
      ];
      content.loaded = true;

      content.clear();

      expect(content.benefits, isEmpty);
      expect(content.trips, isEmpty);
      expect(content.loaded, isFalse);
    });

    test('Strict Egyptian National ID validation rejects garbage 14-digit numbers', () {
      // 14 zeros or repeating digits
      expect(EgyptianNationalIdValidator.isValid('00000000000000'), isFalse);
      expect(EgyptianNationalIdValidator.isValid('11111111111111'), isFalse);
      expect(EgyptianNationalIdValidator.isValid('99999999999999'), isFalse);

      // Invalid governorate code (e.g. 99)
      expect(EgyptianNationalIdValidator.isValid('29001019934592'), isFalse);

      // Invalid month (month 13 or 00)
      expect(EgyptianNationalIdValidator.isValid('29013011234592'), isFalse);
      expect(EgyptianNationalIdValidator.isValid('29000011234592'), isFalse);

      // Valid official Egyptian National IDs
      expect(EgyptianNationalIdValidator.isValid('29801011234567'), isTrue);
      expect(EgyptianNationalIdValidator.isValid('30101010100011'), isTrue);
    });

    test('addRequest offline mid-transit failure retains isPendingSync true', () async {
      final store = RequestsStore.instance;
      Backend.instance.online.value = false;

      const req = EmployeeRequest(
        id: 'offline-req-mid',
        title: 'Emergency Leave',
        type: 'Leave',
        refNumber: 'LEV-OFF-001',
        status: RequestStatus.inReview,
        date: 'Today',
        summary: 'Awaiting sync',
      );

      store.addRequest(req);

      final added = store.allRequests.firstWhere((r) => r.id == 'offline-req-mid');
      expect(added.isPendingSync, isTrue);
      expect(store.pendingSyncRequests.any((r) => r.id == 'offline-req-mid'), isTrue);
    });

    test('Weak repeating PIN regex catches identical digits', () {
      final repeatingPinRegex = RegExp(r'^(\d)\1{3}$');
      expect(repeatingPinRegex.hasMatch('0000'), isTrue);
      expect(repeatingPinRegex.hasMatch('1111'), isTrue);
      expect(repeatingPinRegex.hasMatch('9999'), isTrue);

      expect(repeatingPinRegex.hasMatch('1234'), isFalse);
      expect(repeatingPinRegex.hasMatch('2048'), isFalse);
    });

    test('AppTypography switches between Cairo for Arabic and Inter for English', () {
      AppLocale.instance.setLocale(const Locale('ar'));
      expect(AppTypography.isArabicTypography, isTrue);

      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppTypography.isArabicTypography, isFalse);
    });

    test('RaiseConcern draft saves, restores, and clears cleanly', () async {
      await LocalStore.instance.saveDraft('raise_concern', {
        'category': 'Safety & Health',
        'details': 'Broken valve in production line 3',
      });

      final restored = LocalStore.instance.getDraft('raise_concern');
      expect(restored, isNotNull);
      expect(restored!['category'], 'Safety & Health');
      expect(restored['details'], 'Broken valve in production line 3');

      await LocalStore.instance.clearDraft('raise_concern');
      expect(LocalStore.instance.getDraft('raise_concern'), isNull);
    });

    test('Leave draft saves, restores, and clears cleanly', () async {
      await LocalStore.instance.saveDraft('leave_request', {
        'leaveType': 'Sick Leave',
        'notes': 'Medical appointment',
      });

      final restored = LocalStore.instance.getDraft('leave_request');
      expect(restored, isNotNull);
      expect(restored!['leaveType'], 'Sick Leave');
      expect(restored['notes'], 'Medical appointment');

      await LocalStore.instance.clearDraft('leave_request');
      expect(LocalStore.instance.getDraft('leave_request'), isNull);
    });

    test('Vacation balance: deductVacationDays and addVacationDays update balance accurately', () async {
      await LocalStore.instance.setVacationBalance(15);
      expect(LocalStore.instance.vacationDaysRemaining, 15);

      await LocalStore.instance.deductVacationDays(4);
      expect(LocalStore.instance.vacationDaysRemaining, 11);

      await LocalStore.instance.addVacationDays(4);
      expect(LocalStore.instance.vacationDaysRemaining, 15);
    });

    test('cancelRequest on offline annual leave request immediately refunds vacation days', () async {
      await LocalStore.instance.setVacationBalance(10);
      Backend.instance.online.value = false;

      const req = EmployeeRequest(
        id: 'leave-cancel-test-1',
        title: 'Annual Leave — Request Leave',
        type: 'Leave',
        refNumber: 'LEV-TEST-001',
        status: RequestStatus.inReview,
        date: 'Today',
        summary: 'Waiting approval',
        details: {
          'leaveType': 'Annual Leave',
          'days': '3',
        },
      );

      RequestsStore.instance.addRequest(req);
      await LocalStore.instance.deductVacationDays(3);
      expect(LocalStore.instance.vacationDaysRemaining, 7);

      final cancelled = await RequestsStore.instance.cancelRequest('leave-cancel-test-1');
      expect(cancelled, isTrue);
      // Vacation days must be refunded
      expect(LocalStore.instance.vacationDaysRemaining, 10);
    });
  });
}
