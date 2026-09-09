import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/settings_controller.dart';
import '../../../../core/navigation/app_navigation.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsStateProvider);
    final notifier = ref.read(settingsStateProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          AppLocale.tr('settings_title'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: ListView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // Section 1: Security & Fast Access
            _buildSectionHeader(AppLocale.tr('settings_security')),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: Column(
                children: [
                  _buildSwitchTile(
                    icon: Icons.fingerprint_rounded,
                    title: AppLocale.tr('settings_fingerprint'),
                    value: settings.biometricEnabled,
                    onChanged: (val) => notifier.setBiometric(val),
                  ),
                  const Divider(
                      height: 1,
                      indent: 64,
                      color: AppColors.scaffoldBackground),
                  _buildSwitchTile(
                    icon: Icons.lock_outline_rounded,
                    title: AppLocale.tr('settings_salary_protection'),
                    value: settings.salaryProtectionEnabled,
                    onChanged: (val) => notifier.setSalaryProtection(val),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Section 2: Notification
            _buildSectionHeader(AppLocale.tr('settings_notifications_header')),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: _buildSwitchTile(
                icon: Icons.notifications_rounded,
                title: AppLocale.tr('settings_notifications'),
                value: settings.notificationsEnabled,
                onChanged: (val) =>
                    notifier.setNotifications(val, context: context),
              ),
            ),
            const SizedBox(height: 24),

            // Section 3: Appearance & Shift Mode
            _buildSectionHeader(AppLocale.instance.isArabic
                ? 'المظهر ووردية المصنع'
                : 'Appearance & Shift Mode'),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: Column(
                children: [
                  _buildThemeOptionTile(
                    title: AppLocale.instance.isArabic
                        ? 'تلقائي (حسب إعدادات الهاتف)'
                        : 'System Default',
                    mode: ThemeMode.system,
                    isSelected: settings.themeMode == ThemeMode.system.name ||
                        settings.themeMode.isEmpty,
                    icon: Icons.brightness_auto_rounded,
                    onTap: () => notifier.updateTheme(ThemeMode.system),
                  ),
                  const Divider(
                      height: 1,
                      indent: 64,
                      color: AppColors.scaffoldBackground),
                  _buildThemeOptionTile(
                    title: AppLocale.instance.isArabic
                        ? 'الوضع الفاتح (النهاري)'
                        : 'Light Mode',
                    mode: ThemeMode.light,
                    isSelected: settings.themeMode == ThemeMode.light.name,
                    icon: Icons.light_mode_rounded,
                    onTap: () => notifier.updateTheme(ThemeMode.light),
                  ),
                  const Divider(
                      height: 1,
                      indent: 64,
                      color: AppColors.scaffoldBackground),
                  _buildThemeOptionTile(
                    title: AppLocale.instance.isArabic
                        ? 'الوضع الليلي (لورديات المصنع)'
                        : 'Dark / Night Shift Mode',
                    mode: ThemeMode.dark,
                    isSelected: settings.themeMode == ThemeMode.dark.name,
                    icon: Icons.nightlight_round,
                    onTap: () => notifier.updateTheme(ThemeMode.dark),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Section 4: Help & Info
            _buildSectionHeader('Help & Info'),
            const SizedBox(height: 8),
            Container(
              decoration: _cardDecoration(),
              child: Column(
                children: [
                  _buildNavTile(
                    icon: Icons.headphones_rounded,
                    title: AppLocale.tr('settings_help'),
                    subtitle: 'Contact IT or HR',
                    hasChevron: true,
                    onTap: () {
                      AppNavigation.toHelpSupport(context);
                    },
                  ),
                  const Divider(
                      height: 1,
                      indent: 64,
                      color: AppColors.scaffoldBackground),
                  _buildNavTile(
                    icon: Icons.info_outline_rounded,
                    title: AppLocale.tr('settings_about'),
                    subtitle: 'App Version 1.0.0',
                    hasChevron: false,
                    onTap: () {
                      showAboutDialog(
                        context: context,
                        applicationName: 'Elaraby Connect',
                        applicationVersion: '1.0.0 (Build 2026)',
                        applicationLegalese:
                            '© 2026 Elaraby Group. All rights reserved.',
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  BoxDecoration _cardDecoration() {
    return BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      boxShadow: const [
        BoxShadow(
          color: Color(0x06000000),
          blurRadius: 6,
          offset: Offset(0, 2),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: AppTypography.fontBase.copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.shiftBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              title,
              style: AppTypography.fontBase.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          CupertinoSwitch(
            value: value,
            activeTrackColor: AppColors.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildNavTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool hasChevron,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.shiftBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            if (hasChevron)
              const Icon(Icons.chevron_right,
                  color: AppColors.textSecondary, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildThemeOptionTile({
    required String title,
    required ThemeMode mode,
    required bool isSelected,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primarySoft
                    : AppColors.scaffoldBackground,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected ? AppColors.primary : AppColors.textPrimary,
                ),
              ),
            ),
            if (isSelected)
              const Icon(
                Icons.check_circle_rounded,
                color: AppColors.primary,
                size: 20,
              ),
          ],
        ),
      ),
    );
  }
}
