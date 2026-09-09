import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import 'national_id_screen.dart';

class GetStartedScreen extends StatelessWidget {
  const GetStartedScreen({super.key});

  void _showPrivacyPolicy(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isAr ? 'سياسة الخصوصية والشروط' : 'Privacy Policy & Terms'),
        content: SingleChildScrollView(
          child: Text(
            isAr
              ? 'يلتزم تطبيق العربي كونكت بحماية وتأمين بيانات جميع العاملين وفقاً لأحكام قانون حماية البيانات الشخصية رقم 151 لسنة 2020 ولائحة العمل الداخلية لمجموعة العربي. يتم تشفير كافة البيانات والمعلومات الوظيفية والمالية بأعلى معايير الأمان المؤسسية.'
              : 'Elaraby Connect is committed to protecting employee data in accordance with Egyptian Personal Data Protection Law No. 151 of 2020 and Elaraby Group internal policies. All operational, financial, and employment records are securely encrypted.',
            style: const TextStyle(fontSize: 13, height: 1.5),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(AppLocale.tr('common_ok')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) {
        final isAr = AppLocale.instance.isArabic;
        return Scaffold(
          backgroundColor: AppColors.surface,
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Bar
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFE5E7EB)),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Image.asset(
                              'assets/images/app_logo.png',
                              fit: BoxFit.contain,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'ELARABY',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppColors.primary,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                      InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () {
                          final next = isAr ? const Locale('en') : const Locale('ar');
                          AppLocale.instance.setLocale(next);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                isAr ? 'العربية' : 'English',
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.language_rounded, size: 16, color: AppColors.primary),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Hero Collage Image
                  Expanded(
                    child: Center(
                      child: Image.asset(
                        'assets/images/get_started_team.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Headlines
                  Text(
                    isAr ? 'مرحباً بك في' : 'Welcome to',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    isAr ? 'العربي كونكت' : 'Elaraby Connect',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    isAr
                      ? 'بيئة عملك الرقمية المتكاملة.\nكل الأدوات والمعلومات التي تحتاجها، في مكان واحد'
                      : 'Your digital workplace.\nAll the tools and information you need,\nin one place',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 15,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Get Started Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const NationalIdScreen()),
                        );
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
                        AppLocale.tr('auth_get_started'),
                        style: AppTypography.buttonText.copyWith(fontSize: 16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Footer
                  Center(
                    child: InkWell(
                      onTap: () => _showPrivacyPolicy(context),
                      child: Text(
                        isAr ? 'سياسة الخصوصية • الشروط والأحكام' : 'Privacy Policy • Terms & Conditions',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 12,
                          color: AppColors.primary,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
