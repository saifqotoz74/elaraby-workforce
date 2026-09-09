import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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

  static ThemeData get lightTheme {
    // Inter ships bundled (assets/fonts + pubspec fonts section), so the
    // app renders correctly offline on first launch.
    GoogleFonts.config.allowRuntimeFetching = false;
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.scaffoldBackground,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        surface: AppColors.surface,
      ),
      textTheme: GoogleFonts.interTextTheme(base.textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
    );
  }

  /// Dark Theme optimized for 24/7 factory night shift workers (low-glare, WCAG AAA contrast)
  static ThemeData get darkTheme {
    GoogleFonts.config.allowRuntimeFetching = false;
    final base = ThemeData.dark(useMaterial3: true);
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
      textTheme: GoogleFonts.interTextTheme(base.textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF1C2541),
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: Colors.white),
      ),
    );
  }
}
