import 'package:flutter/material.dart';

/// Design tokens for colors extracted directly from Figma designs
class AppColors {
  AppColors._();

  // Brand Colors
  static const Color primary = Color(0xFF0B63B4);
  static const Color primaryLight = Color(0xFF1668B8);
  static const Color primarySoft = Color(0xFFE8F1FA);

  // Background & Surface Colors
  static const Color scaffoldBackground = Color(0xFFF3F5F7);
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
  static const Color badgeBlue = Color(0xFF0B63B4);
  static const Color avatarBg = Color(0xFFC7E0F3);
  static const Color avatarText = Color(0xFF0B63B4);

  // Quick Actions
  static const Color quickActionIconBg = Color(0xFFEEF5FC);
  static const Color quickActionIcon = Color(0xFF0B63B4);

  // Quick Survey Card
  static const Color surveyBg = Color(0xFFE6E9FC);
  static const Color surveyIconBg = Color(0xFFD2D8F9);
  static const Color surveyIcon = Color(0xFF5362DE);
  static const Color surveyPillBg = Color(0xFFD8DEF8);
  static const Color surveyPillBorder = Color(0xFFC4CDF4);

  // Navigation
  static const Color navActive = Color(0xFF0B63B4);
  static const Color navInactive = Color(0xFFA0AEC0);
  static const Color navBorder = Color(0xFFEEF1F4);
}
