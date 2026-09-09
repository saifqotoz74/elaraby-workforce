import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/l10n/generated/app_localizations.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppLocale.instance.setLocale(const Locale('en'));
  });

  group('ARB Files Completeness & Parity Tests', () {
    test('app_en.arb and app_ar.arb exist and have valid JSON', () {
      final enFile = File('lib/l10n/app_en.arb');
      final arFile = File('lib/l10n/app_ar.arb');

      expect(enFile.existsSync(), isTrue);
      expect(arFile.existsSync(), isTrue);

      final enJson =
          json.decode(enFile.readAsStringSync()) as Map<String, dynamic>;
      final arJson =
          json.decode(arFile.readAsStringSync()) as Map<String, dynamic>;

      expect(enJson['@@locale'], 'en');
      expect(arJson['@@locale'], 'ar');
    });

    test(
        'app_en.arb and app_ar.arb have exact 1:1 key parity without missing translations',
        () {
      final enFile = File('lib/l10n/app_en.arb');
      final arFile = File('lib/l10n/app_ar.arb');

      final enJson =
          json.decode(enFile.readAsStringSync()) as Map<String, dynamic>;
      final arJson =
          json.decode(arFile.readAsStringSync()) as Map<String, dynamic>;

      final enKeys = enJson.keys.where((k) => !k.startsWith('@')).toSet();
      final arKeys = arJson.keys.where((k) => !k.startsWith('@')).toSet();

      final missingInAr = enKeys.difference(arKeys);
      final missingInEn = arKeys.difference(enKeys);

      expect(missingInAr, isEmpty,
          reason: 'Keys in EN but missing in AR: $missingInAr');
      expect(missingInEn, isEmpty,
          reason: 'Keys in AR but missing in EN: $missingInEn');
      expect(enKeys.length, greaterThan(250));
    });
  });

  group('AppLocale & AppLocalizations Core Tests', () {
    test('Translates nav keys in English and Arabic', () {
      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppLocale.tr('nav_home'), 'Home');
      expect(AppLocale.tr('nav_services'), 'Services');
      expect(AppLocale.tr('nav_benefits'), 'Benefits');
      expect(AppLocale.tr('nav_inbox'), 'Inbox');
      expect(AppLocale.tr('nav_profile'), 'Profile');

      AppLocale.instance.setLocale(const Locale('ar'));
      expect(AppLocale.tr('nav_home'), 'الرئيسية');
      expect(AppLocale.tr('nav_services'), 'الخدمات');
      expect(AppLocale.tr('nav_benefits'), 'المزايا');
      expect(AppLocale.tr('nav_inbox'), 'الوارد');
      expect(AppLocale.tr('nav_profile'), 'حسابي');
    });

    test('Handles fallback for non-existent key gracefully', () {
      expect(AppLocale.tr('unknown_random_key_123'), 'unknown_random_key_123');
    });

    test('Toggles locale cleanly between Arabic and English', () {
      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppLocale.instance.isArabic, isFalse);

      AppLocale.instance.toggleLocale();
      expect(AppLocale.instance.isArabic, isTrue);
      expect(AppLocale.instance.currentLocale.languageCode, 'ar');

      AppLocale.instance.toggleLocale();
      expect(AppLocale.instance.isArabic, isFalse);
      expect(AppLocale.instance.currentLocale.languageCode, 'en');
    });
  });

  group('RTL and LTR Directionality Tests', () {
    test('Reflects correct TextDirection on AppLocale singleton', () {
      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppLocale.instance.isRTL, isFalse);
      expect(AppLocale.instance.textDirection, TextDirection.ltr);

      AppLocale.instance.setLocale(const Locale('ar'));
      expect(AppLocale.instance.isRTL, isTrue);
      expect(AppLocale.instance.textDirection, TextDirection.rtl);
    });

    testWidgets(
        'Applies correct Directionality in widget tree for Arabic vs English',
        (tester) async {
      Widget buildTestHarness(Locale locale) {
        return MaterialApp(
          locale: locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          home: Builder(
            builder: (context) {
              return Scaffold(
                body: Column(
                  children: [
                    Text('Direction: ${context.isRTL ? "RTL" : "LTR"}'),
                    Text(context.l10n.nav_home),
                  ],
                ),
              );
            },
          ),
        );
      }

      // Test English (LTR)
      await tester.pumpWidget(buildTestHarness(const Locale('en')));
      await tester.pumpAndSettle();
      expect(find.text('Direction: LTR'), findsOneWidget);
      expect(find.text('Home'), findsOneWidget);

      // Test Arabic (RTL)
      await tester.pumpWidget(buildTestHarness(const Locale('ar')));
      await tester.pumpAndSettle();
      expect(find.text('Direction: RTL'), findsOneWidget);
      expect(find.text('الرئيسية'), findsOneWidget);
    });
  });

  group('Pluralization Rules Tests', () {
    test('English pluralization for vacation days and lockout', () {
      AppLocale.instance.setLocale(const Locale('en'));

      expect(AppLocale.vacationDaysCount(0), '0 Days');
      expect(AppLocale.vacationDaysCount(1), '1 Day');
      expect(AppLocale.vacationDaysCount(2), '2 Days');
      expect(AppLocale.vacationDaysCount(12), '12 Days');

      expect(AppLocale.vacationDaysRemainingCount(1), '1 day remaining');
      expect(AppLocale.vacationDaysRemainingCount(5), '5 days remaining');

      expect(AppLocale.tripSeatsLeftCount(0), 'No seats left');
      expect(AppLocale.tripSeatsLeftCount(1), '1 seat left');
      expect(AppLocale.tripSeatsLeftCount(8), '8 seats left');

      expect(AppLocale.trLockedPlural(1),
          'Too many wrong attempts. Try again in 1 minute.');
      expect(AppLocale.trLockedPlural(5),
          'Too many wrong attempts. Try again in 5 minutes.');
    });

    test('Arabic pluralization forms (zero, one, two, few, many, other)', () {
      AppLocale.instance.setLocale(const Locale('ar'));

      // vacation_days_count
      expect(AppLocale.vacationDaysCount(0), '٠ يوم');
      expect(AppLocale.vacationDaysCount(1), 'يوم واحد');
      expect(AppLocale.vacationDaysCount(2), 'يومان');
      expect(AppLocale.vacationDaysCount(3), '3 أيام');
      expect(AppLocale.vacationDaysCount(10), '10 أيام');
      expect(AppLocale.vacationDaysCount(11), '11 يوماً');
      expect(AppLocale.vacationDaysCount(99), '99 يوماً');

      // trip_seats_left_count
      expect(AppLocale.tripSeatsLeftCount(0), 'لا توجد مقاعد متبقية');
      expect(AppLocale.tripSeatsLeftCount(1), 'مقعد واحد متبقٍ');
      expect(AppLocale.tripSeatsLeftCount(2), 'مقعدان متبقيان');
      expect(AppLocale.tripSeatsLeftCount(4), '4 مقاعد متبقية');
      expect(AppLocale.tripSeatsLeftCount(15), '15 مقعداً متبقياً');

      // auth_locked_minutes
      expect(AppLocale.trLockedPlural(1), contains('دقيقة واحدة'));
      expect(AppLocale.trLockedPlural(2), contains('دقيقتين'));
      expect(AppLocale.trLockedPlural(5), contains('5 دقائق'));
      expect(AppLocale.trLockedPlural(15), contains('15 دقيقة'));
    });
  });
}
