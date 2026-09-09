import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../localization/app_locale.dart';
import 'app_colors.dart';

/// Typography definitions matching Figma design specs with Arabic ligature preservation.
class AppTypography {
  AppTypography._();

  static bool get isArabicTypography => AppLocale.instance.isArabic;

  static double get _letterSpacingTitle => AppLocale.instance.isArabic ? 0.0 : -0.3;
  static double get _letterSpacingHeading => AppLocale.instance.isArabic ? 0.0 : -0.2;

  static TextStyle _font({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? letterSpacing,
    double? height,
  }) {
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return GoogleFonts.inter(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );
    }
    if (AppLocale.instance.isArabic) {
      return GoogleFonts.cairo(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );
    }
    return GoogleFonts.inter(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: height,
    );
  }

  static TextStyle get fontBase {
    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return GoogleFonts.inter();
    }
    return AppLocale.instance.isArabic ? GoogleFonts.cairo() : GoogleFonts.inter();
  }

  // App Bar & Headings
  static TextStyle get dateSubtitle => _font(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      );

  static TextStyle get welcomeTitle => _font(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        letterSpacing: _letterSpacingTitle,
      );

  static TextStyle get sectionHeading => _font(
        fontSize: 17,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        letterSpacing: _letterSpacingHeading,
      );

  static TextStyle get viewAllLink => _font(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.primaryLight,
      );

  // Cards
  static TextStyle get announcementBadge => _font(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.announcementHeader,
      );

  static TextStyle get announcementTitle => _font(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.35,
      );

  static TextStyle get buttonText => _font(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: Colors.white,
      );

  static TextStyle get shiftCategory => _font(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.shiftTextBlue,
      );

  static TextStyle get shiftTime => _font(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      );

  static TextStyle get shiftSubtitle => _font(
        fontSize: 13,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
      );

  // Metrics
  static TextStyle get metricLabel => _font(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.shiftTextBlue,
      );

  static TextStyle get metricValue => _font(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      );

  static TextStyle get metricValueSuccess => _font(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.statusGreen,
      );

  // Quick Actions
  static TextStyle get quickActionLabel => _font(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.textPrimary,
      );

  // News
  static TextStyle get newsTitle => _font(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.35,
      );

  static TextStyle get newsTimestamp => _font(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
      );

  // Survey
  static TextStyle get surveyHeader => _font(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: AppColors.surveyIcon,
      );

  static TextStyle get surveyQuestion => _font(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        height: 1.35,
      );

  static TextStyle get surveyRatingNumber => _font(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      );

  // Bottom Navigation
  static TextStyle get navLabelActive => _font(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: AppColors.navActive,
      );

  static TextStyle get navLabelInactive => _font(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        color: AppColors.navInactive,
      );
}
