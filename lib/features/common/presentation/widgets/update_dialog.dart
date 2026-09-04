import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class UpdateDialog extends StatelessWidget {
  final AppVersionInfo info;

  const UpdateDialog({
    super.key,
    required this.info,
  });

  static Future<void> show(BuildContext context, AppVersionInfo info) {
    return showDialog(
      context: context,
      barrierDismissible: !info.isUpdateRequired,
      builder: (_) => PopScope(
        canPop: !info.isUpdateRequired,
        child: UpdateDialog(info: info),
      ),
    );
  }

  Future<void> _launchUpdateUrl() async {
    final uri = Uri.tryParse(info.updateUrl);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    final title = isAr ? info.title : info.titleEn;
    final message = isAr ? info.message : info.messageEn;
    final isForced = info.isUpdateRequired;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [
            BoxShadow(
              color: Color(0x26000000),
              blurRadius: 24,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // PR Project / Elaraby App Icon
            Container(
              width: 72,
              height: 72,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F7FF),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.15),
                  width: 1.5,
                ),
              ),
              child: Image.asset(
                'assets/images/app_logo.png',
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(height: 16),

            // Badge / Chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isForced
                    ? const Color(0xFFEF4444).withValues(alpha: 0.12)
                    : AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isForced ? Icons.error_outline_rounded : Icons.info_outline_rounded,
                    size: 14,
                    color: isForced ? const Color(0xFFDC2626) : AppColors.primary,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    isForced
                        ? (isAr ? 'تحديث إجباري مطلوب' : 'Mandatory Update')
                        : (isAr ? 'نسخة جديدة متاحة' : 'New Version Available'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: isForced ? const Color(0xFFDC2626) : AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Title
            Text(
              title,
              style: AppTypography.sectionHeading.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),

            // Message Body
            Text(
              message,
              style: AppTypography.fontBase.copyWith(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),

            // Target Version pill
            Text(
              '${isAr ? "الإصدار المتوفر" : "Available Version"}: v${info.latestVersion}',
              style: AppTypography.fontBase.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textLight,
              ),
            ),
            const SizedBox(height: 24),

            // Primary Update Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _launchUpdateUrl,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.system_update_alt_rounded, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      isAr ? 'تحديث الآن' : 'Update Now',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Optional "Later" button only if update is NOT mandatory
            if (!isForced) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 40,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    isAr ? 'لاحقاً' : 'Later',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
