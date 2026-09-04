import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../services/presentation/screens/hr_request_screen.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key});

  /// Opens the URL (dialer / WhatsApp); falls back to a toast when no app
  /// can handle it (e.g. desktop or emulator without a dialer).
  Future<void> _launchOrToast(BuildContext context, Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('${AppLocale.tr('help_cannot_open')}: $uri'),
          backgroundColor: AppColors.primary,
        ),
      );
    }
  }

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
          AppLocale.tr('settings_help'),
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
            // Top Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x06000000),
                    blurRadius: 8,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      color: AppColors.shiftBg,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.support_agent_rounded,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AppLocale.tr('help_subtitle'),
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          AppLocale.tr('help_direct_channels'),
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Section 1: Contact Channels
            Text(
              AppLocale.tr('help_direct_channels'),
              style: AppTypography.fontBase.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 10),

            _buildContactCard(
              context,
              icon: Icons.phone_in_talk_rounded,
              title: AppLocale.tr('help_hotline'),
              subtitle: '19319 (Direct Ext. 2)',
              timing: 'Sun – Thu • 8:00 AM – 4:30 PM',
              actionLabel: AppLocale.tr('help_call_now'),
              actionIcon: Icons.call,
              onTap: () => _launchOrToast(
                context,
                Uri(scheme: 'tel', path: '19319'),
              ),
            ),
            const SizedBox(height: 12),

            _buildContactCard(
              context,
              icon: Icons.chat_rounded,
              title: AppLocale.tr('help_whatsapp'),
              subtitle: '+20 10 9988 7766',
              timing: 'Instant responses for common inquiries',
              actionLabel: AppLocale.tr('help_open_chat'),
              actionIcon: Icons.chat_bubble_outline_rounded,
              onTap: () => _launchOrToast(
                context,
                Uri(scheme: 'https', host: 'wa.me', path: '/201099887766'),
              ),
            ),
            const SizedBox(height: 12),

            _buildContactCard(
              context,
              icon: Icons.computer_rounded,
              title: AppLocale.tr('help_it'),
              subtitle: 'Internal Ext. 4022',
              timing: 'App access, PIN reset, device issues',
              actionLabel: AppLocale.tr('help_call_it'),
              actionIcon: Icons.call,
              onTap: () => _launchOrToast(
                context,
                Uri(scheme: 'tel', path: '4022'),
              ),
            ),
            const SizedBox(height: 12),

            _buildContactCard(
              context,
              icon: Icons.medical_services_outlined,
              title: AppLocale.tr('help_clinic'),
              subtitle: '10th of Ramadan Branch Medical Unit',
              timing: 'Available 24/7 during all operational shifts',
              actionLabel: AppLocale.tr('help_emergency_call'),
              actionIcon: Icons.emergency,
              isEmergency: true,
              onTap: () => _launchOrToast(
                context,
                Uri(scheme: 'tel', path: '107'),
              ),
            ),
            const SizedBox(height: 24),

            // Section 2: Submit a Written Request
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.shiftBg,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLocale.tr('help_formal_inquiry'),
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    AppLocale.tr('help_track_request'),
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 12,
                      color: AppColors.shiftTextBlue,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 42,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const HrRequestScreen()),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Text(
                        AppLocale.tr('help_open_hr_form'),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
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

  Widget _buildContactCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required String timing,
    required String actionLabel,
    required IconData actionIcon,
    required VoidCallback onTap,
    bool isEmergency = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isEmergency ? const Color(0xFFFEECEC) : AppColors.shiftBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: isEmergency ? AppColors.announcementButton : AppColors.primary,
                  size: 22,
                ),
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
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isEmergency ? AppColors.announcementButton : AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      timing,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 38,
            child: OutlinedButton.icon(
              onPressed: onTap,
              icon: Icon(actionIcon, size: 16, color: isEmergency ? AppColors.announcementButton : AppColors.primary),
              label: Text(
                actionLabel,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isEmergency ? AppColors.announcementButton : AppColors.primary,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(
                  color: isEmergency ? const Color(0xFFFCA5A5) : const Color(0xFFBFDBFE),
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
