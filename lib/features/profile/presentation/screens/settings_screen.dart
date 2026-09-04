import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import 'help_support_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _fingerprintLogin =
      LocalStore.instance.getSetting('fingerprint', defaultValue: true);
  bool _salarySlipProtection =
      LocalStore.instance.getSetting('salary_protection');
  bool _enableNotifications =
      LocalStore.instance.getSetting('notifications', defaultValue: true);

  @override
  Widget build(BuildContext context) {
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
                    value: _fingerprintLogin,
                    onChanged: (val) {
                      LocalStore.instance.setSetting('fingerprint', val);
                      setState(() => _fingerprintLogin = val);
                    },
                  ),
                  const Divider(height: 1, indent: 64, color: AppColors.scaffoldBackground),
                  _buildSwitchTile(
                    icon: Icons.lock_outline_rounded,
                    title: AppLocale.tr('settings_salary_protection'),
                    value: _salarySlipProtection,
                    onChanged: (val) {
                      LocalStore.instance.setSetting('salary_protection', val);
                      setState(() => _salarySlipProtection = val);
                    },
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
                value: _enableNotifications,
                onChanged: (val) {
                      LocalStore.instance.setSetting('notifications', val);
                      setState(() => _enableNotifications = val);
                    },
              ),
            ),
            const SizedBox(height: 24),

            // Section 3: Help & Info
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
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const HelpSupportScreen()),
                      );
                    },
                  ),
                  const Divider(height: 1, indent: 64, color: AppColors.scaffoldBackground),
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
                        applicationLegalese: '© 2026 Elaraby Group. All rights reserved.',
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
              const Icon(Icons.chevron_right, color: AppColors.textSecondary, size: 20),
          ],
        ),
      ),
    );
  }
}
