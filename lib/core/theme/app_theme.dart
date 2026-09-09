import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../localization/app_locale.dart';
import '../storage/local_store.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  /// Reactive notifier for current application ThemeMode
  static final ValueNotifier<ThemeMode> themeModeNotifier =
      ValueNotifier<ThemeMode>(ThemeMode.system);

  /// Initializes the theme mode from persistent storage
  static void init() {
    final saved = LocalStore.instance.themeMode;
    switch (saved) {
      case 'light':
        themeModeNotifier.value = ThemeMode.light;
        break;
      case 'dark':
        themeModeNotifier.value = ThemeMode.dark;
        break;
      default:
        themeModeNotifier.value = ThemeMode.system;
        break;
    }
  }

  /// Changes the theme mode and persists it to LocalStore
  static void setThemeMode(ThemeMode mode) {
    themeModeNotifier.value = mode;
    LocalStore.instance.setThemeMode(mode.name);
  }

  /// Light theme configured with local bundled fonts (Cairo for Arabic, Inter for English)
  static ThemeData get lightTheme =>
      themeFor(isArabic: AppLocale.instance.isArabic, isDark: false);

  /// Dark Theme optimized for factory night shifts with local bundled fonts
  static ThemeData get darkTheme =>
      themeFor(isArabic: AppLocale.instance.isArabic, isDark: true);

  /// Factory method to build localized ThemeData completely offline
  static ThemeData themeFor({required bool isArabic, required bool isDark}) {
    // Both Cairo and Inter fonts are bundled locally in assets/fonts/
    // Runtime fetching is strictly disabled so app works completely offline without network.
    GoogleFonts.config.allowRuntimeFetching = false;

    final primaryFont = isArabic ? 'Cairo' : 'Inter';
    final fallbackFonts = isArabic ? const ['Inter'] : const ['Cairo'];

    final base = isDark
        ? ThemeData.dark(useMaterial3: true)
        : ThemeData.light(useMaterial3: true);

    final TextTheme baseTextTheme = isArabic
        ? GoogleFonts.cairoTextTheme(base.textTheme)
        : GoogleFonts.interTextTheme(base.textTheme);

    final localizedTextTheme = baseTextTheme.apply(
      fontFamily: primaryFont,
      fontFamilyFallback: fallbackFonts,
    );

    if (isDark) {
      return base.copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B132B), // Deep night slate
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.dark,
          primary: const Color(0xFF38BDF8),
          surface: const Color(0xFF1C2541),
          onSurface: Colors.white,
        ),
        cardColor: const Color(0xFF1C2541),
        dividerColor: const Color(0xFF2D3748),
        textTheme: localizedTextTheme,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1C2541),
          elevation: 0,
          scrolledUnderElevation: 0,
          iconTheme: IconThemeData(color: Colors.white),
        ),
      );
    } else {
      return base.copyWith(
        scaffoldBackgroundColor: AppColors.scaffoldBackground,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          primary: AppColors.primary,
          surface: AppColors.surface,
        ),
        textTheme: localizedTextTheme,
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.surface,
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
      );
    }
  }
}
