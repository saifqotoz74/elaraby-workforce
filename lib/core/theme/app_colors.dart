import 'package:flutter/material.dart';
import 'app_theme.dart';

/// Design tokens for colors dynamically bound to the active tenant brand
class AppColors {
  AppColors._();

  // Brand Colors - Dynamically resolved from active tenant
  static Color get primary => AppTheme.currentBrand.primaryColor;
  static Color get primaryLight => AppTheme.currentBrand.primaryLightColor;
  static Color get primarySoft => AppTheme.currentBrand.primarySoftColor;

  /// Dynamic primary color resolving to the current theme's primary
  static Color dynamicPrimary(BuildContext context) =>
      Theme.of(context).colorScheme.primary;

  // Background & Surface Colors (Kept const for compile-time widget tree optimization)
  static const Color scaffoldBackground = Color(0xFFF3F5F7);
  static const Color background = Color(0xFFF3F5F7);
  static const Color surface = Colors.white;
  static const Color cardShadow = Color(0x0A000000);

  // Text Colors
  static const Color textPrimary = Color(0xFF1A1D21);
  static const Color textSecondary = Color(0xFF8A8C8F);
  static const Color textMuted = Color(0xFF9CA3AF);
  static const Color textLight = Color(0xFFB0B3BA);

  // Announcement Card
  static const Color announcementBg = Color(0xFFFDF0F0);
  static const Color announcementIconBg = Color(0xFFF7D5D5);
  static const Color announcementHeader = Color(0xFFB13A3A);
  static const Color announcementButton = Color(0xFFD64545);

  // Today's Shift Card
  static const Color shiftBg = Color(0xFFEEF5FC);
  static const Color shiftIconBg = Color(0xFFD7E7F8);
  static const Color shiftTextBlue = Color(0xFF1668B8);

  // Stat Indicators
  static const Color statusGreen = Color(0xFF16A34A);
  static const Color error = Color(0xFFDC2626);
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static Color get badgeBlue => AppTheme.currentBrand.primaryColor;
  static Color get avatarBg => AppTheme.currentBrand.primarySoftColor;
  static Color get avatarText => AppTheme.currentBrand.primaryColor;

  // Quick Actions
  static Color get quickActionIconBg => AppTheme.currentBrand.primarySoftColor;
  static Color get quickActionIcon => AppTheme.currentBrand.primaryColor;

  // Quick Survey Card
  static const Color surveyBg = Color(0xFFE6E9FC);
  static const Color surveyIconBg = Color(0xFFD2D8F9);
  static const Color surveyIcon = Color(0xFF5362DE);
  static const Color surveyPillBg = Color(0xFFD8DEF8);
  static const Color surveyPillBorder = Color(0xFFC4CDF4);

  // Navigation
  static Color get navActive => AppTheme.currentBrand.primaryColor;
  static const Color navInactive = Color(0xFFA0AEC0);
  static const Color navBorder = Color(0xFFEEF1F4);
}
