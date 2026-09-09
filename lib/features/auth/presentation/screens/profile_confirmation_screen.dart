import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../widgets/auth_progress_bar.dart';
import '../../../../core/navigation/app_navigation.dart';

class ProfileConfirmationScreen extends StatelessWidget {
  const ProfileConfirmationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBackground,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Progress Bar (Step 3)
              const AuthProgressBar(currentStep: 3),
              const SizedBox(height: 24),

              // Title & Subtitle
              Text(
                AppLocale.tr('confirm_profile_title'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 8),
              Text(
                AppLocale.tr('confirm_profile_subtitle'),
                style: AppTypography.dateSubtitle.copyWith(fontSize: 14),
              ),
              const SizedBox(height: 36),

              if (!LocalStore.instance.hasSavedProfile)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline,
                          size: 18, color: AppColors.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          AppLocale.instance.isArabic
                              ? 'يرجى مراجعة وتأكيد بيانات الهوية الخاصة بك بعناية قبل إنشاء الرمز السري.'
                              : 'Please review and confirm your identity credentials carefully before creating your PIN.',
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 12,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Profile Card
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
                child: Column(
                  children: [
                    _buildDataRow(AppLocale.tr('confirm_profile_name'),
                        LocalStore.instance.profile.name),
                    const SizedBox(height: 20),
                    _buildDataRow(AppLocale.tr('confirm_profile_employee_id'),
                        LocalStore.instance.profile.employeeCode),
                    const SizedBox(height: 20),
                    _buildDataRow(AppLocale.tr('confirm_profile_factory'),
                        LocalStore.instance.profile.factory),
                    const SizedBox(height: 20),
                    _buildDataRow(AppLocale.tr('confirm_profile_department'),
                        LocalStore.instance.profile.department),
                  ],
                ),
              ),

              const Spacer(),

              // Yes, this is me Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    AppNavigation.toCreatePin(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    AppLocale.tr('confirm_profile_yes'),
                    style: AppTypography.buttonText.copyWith(fontSize: 15),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // No, this isn't me Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: TextButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  style: TextButton.styleFrom(
                    backgroundColor: AppColors.surface,
                    foregroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    AppLocale.tr('confirm_profile_no'),
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDataRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: AppTypography.fontBase.copyWith(
            fontSize: 13,
            color: AppColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: AppTypography.fontBase.copyWith(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
