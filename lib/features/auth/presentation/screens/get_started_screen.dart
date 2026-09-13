import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/tenant/tenant_provider.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../widgets/company_code_modal.dart';

class GetStartedScreen extends ConsumerWidget {
  const GetStartedScreen({super.key});

  void _showPrivacyPolicy(BuildContext context, String companyName) {
    final isAr = AppLocale.instance.isArabic;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isAr ? 'سياسة الخصوصية والشروط' : 'Privacy Policy & Terms'),
        content: SingleChildScrollView(
          child: Text(
            isAr
                ? 'يلتزم تطبيق $companyName بحماية وتأمين بيانات جميع العاملين وفقاً لأحكام قانون حماية البيانات الشخصية رقم 151 لسنة 2020 ولائحة العمل الداخلية. يتم تشفير كافة البيانات والمعلومات الوظيفية والمالية بأعلى معايير الأمان المؤسسية.'
                : '$companyName Connect is committed to protecting employee data in accordance with Personal Data Protection Law No. 151 of 2020 and internal workplace policies. All operational, financial, and employment records are securely encrypted.',
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
  Widget build(BuildContext context, WidgetRef ref) {
    final brand = ref.watch(tenantBrandProvider);

    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) {
        final isAr = AppLocale.instance.isArabic;
        final connectTitleEn = (brand.companyName == 'Elaraby Group' || brand.companyName == 'Elaraby')
            ? 'Elaraby Connect'
            : (brand.companyName.endsWith('Connect') ? brand.companyName : '${brand.companyName} Connect');
        final connectTitleAr = (brand.companyNameAr == 'مجموعة العربي' || brand.companyNameAr == 'العربي')
            ? 'العربي كونكت'
            : (brand.companyNameAr.endsWith('كونكت') ? brand.companyNameAr : '${brand.companyNameAr} كونكت');

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
                      InkWell(
                        onTap: () => CompanyCodeModal.show(context),
                        borderRadius: BorderRadius.circular(10),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                          child: Row(
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
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        brand.companyName.split(' ').first.toUpperCase(),
                                        style: AppTypography.fontBase.copyWith(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w900,
                                          color: brand.primaryColor,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                                      const SizedBox(width: 2),
                                      Icon(Icons.arrow_drop_down_rounded, size: 20, color: brand.primaryColor),
                                    ],
                                  ),
                                  Text(
                                    isAr ? 'اضغط لتغيير المؤسسة' : 'Tap to switch code',
                                    style: TextStyle(fontSize: 10, color: AppColors.textMuted),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () {
                          final next =
                              isAr ? const Locale('en') : const Locale('ar');
                          AppLocale.instance.setLocale(next);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
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
                              Icon(Icons.language_rounded,
                                  size: 16, color: brand.primaryColor),
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
                    isAr ? connectTitleAr : connectTitleEn,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: brand.primaryColor,
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
                  const SizedBox(height: 28),

                  // Get Started Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        AppNavigation.toNationalId(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: brand.primaryColor,
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
                  const SizedBox(height: 14),

                  // Switch Organization Code Button
                  Center(
                    child: TextButton.icon(
                      onPressed: () => CompanyCodeModal.show(context),
                      icon: Icon(Icons.swap_horiz_rounded, size: 16, color: brand.primaryColor),
                      label: Text(
                        isAr ? 'تغيير كود المؤسسة / الشركة' : 'Switch Organization Code',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: brand.primaryColor,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Footer
                  Center(
                    child: InkWell(
                      onTap: () => _showPrivacyPolicy(context, isAr ? brand.companyNameAr : brand.companyName),
                      child: Text(
                        isAr
                            ? 'سياسة الخصوصية • الشروط والأحكام'
                            : 'Privacy Policy • Terms & Conditions',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 12,
                          color: brand.primaryColor,
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
