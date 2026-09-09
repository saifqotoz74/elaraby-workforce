import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/core/theme/app_typography.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
  });

  group('Phase 9 - Local Font Bundling & Assets Tests', () {
    test('Cairo and Inter font assets exist locally in assets/fonts/', () {
      final requiredFonts = [
        'assets/fonts/Inter-Regular.ttf',
        'assets/fonts/Inter-Medium.ttf',
        'assets/fonts/Inter-SemiBold.ttf',
        'assets/fonts/Inter-Bold.ttf',
        'assets/fonts/Cairo-Regular.ttf',
        'assets/fonts/Cairo-Medium.ttf',
        'assets/fonts/Cairo-SemiBold.ttf',
        'assets/fonts/Cairo-Bold.ttf',
        'assets/fonts/Cairo-VariableFont_slnt,wght.ttf',
      ];

      for (final fontPath in requiredFonts) {
        final file = File(fontPath);
        expect(file.existsSync(), isTrue,
            reason: 'Missing bundled font file: $fontPath');
        expect(file.lengthSync(), greaterThan(10000),
            reason: 'Bundled font file is suspiciously small: $fontPath');
      }
    });

    test('pubspec.yaml declares Cairo and Inter font families', () {
      final pubspecFile = File('pubspec.yaml');
      expect(pubspecFile.existsSync(), isTrue);
      final content = pubspecFile.readAsStringSync();

      expect(content.contains('family: Cairo'), isTrue,
          reason: 'pubspec.yaml must declare Cairo font family');
      expect(content.contains('family: Inter'), isTrue,
          reason: 'pubspec.yaml must declare Inter font family');
      expect(content.contains('- assets/fonts/'), isTrue,
          reason: 'pubspec.yaml must include assets/fonts/ in assets section');
    });
  });

  group('Phase 9 - Localized ThemeData & Offline Typography Tests', () {
    test('AppTheme enforces allowRuntimeFetching = false for offline safety',
        () {
      // Accessing themes initializes the runtime fetching configuration
      expect(AppTheme.lightTheme, isNotNull);
      expect(GoogleFonts.config.allowRuntimeFetching, isFalse);

      expect(AppTheme.darkTheme, isNotNull);
      expect(GoogleFonts.config.allowRuntimeFetching, isFalse);
    });

    test('ThemeData configures Cairo for Arabic and Inter for English', () {
      final arabicLight = AppTheme.themeFor(isArabic: true, isDark: false);
      expect(arabicLight.textTheme.bodyMedium?.fontFamily, contains('Cairo'));
      expect(arabicLight.textTheme.titleLarge?.fontFamily, contains('Cairo'));

      final englishLight = AppTheme.themeFor(isArabic: false, isDark: false);
      expect(englishLight.textTheme.bodyMedium?.fontFamily, contains('Inter'));
      expect(englishLight.textTheme.titleLarge?.fontFamily, contains('Inter'));

      final arabicDark = AppTheme.themeFor(isArabic: true, isDark: true);
      expect(arabicDark.textTheme.bodyMedium?.fontFamily, contains('Cairo'));

      final englishDark = AppTheme.themeFor(isArabic: false, isDark: true);
      expect(englishDark.textTheme.bodyMedium?.fontFamily, contains('Inter'));
    });

    test('AppTypography switches family dynamically based on active AppLocale',
        () {
      AppLocale.instance.setLocale(const Locale('ar'));
      expect(AppTypography.isArabicTypography, isTrue);
      final arabicWelcome = AppTypography.welcomeTitle;
      expect(arabicWelcome.fontFamily, contains('Cairo'));

      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppTypography.isArabicTypography, isFalse);
      final englishWelcome = AppTypography.welcomeTitle;
      expect(englishWelcome.fontFamily, contains('Inter'));
    });

    testWidgets('Arabic UI renders completely offline with bundled Cairo theme',
        (tester) async {
      AppLocale.instance.setLocale(const Locale('ar'));
      final theme = AppTheme.themeFor(isArabic: true, isDark: false);

      await tester.pumpWidget(
        MaterialApp(
          theme: theme,
          locale: const Locale('ar'),
          home: Scaffold(
            appBar: AppBar(
              title: const Text('مجموعة العربي'),
            ),
            body: Center(
              child: Text(
                'أهلاً بك في تطبيق العربي للقوى العاملة',
                style: AppTypography.welcomeTitle,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('مجموعة العربي'), findsOneWidget);
      expect(
          find.text('أهلاً بك في تطبيق العربي للقوى العاملة'), findsOneWidget);
    });
  });
}
