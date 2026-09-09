import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../localization/app_locale.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'app_routes.dart';

/// Screen displayed whenever an unknown or unmapped route is accessed.
class UnknownRouteScreen extends StatelessWidget {
  final String? path;

  const UnknownRouteScreen({super.key, this.path});

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              context.go(AppRoutes.main);
            }
          },
        ),
      ),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.explore_off_rounded,
                    size: 48,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  isAr ? 'الصفحة غير موجودة' : 'Page Not Found',
                  style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  isAr
                      ? 'عذراً، الرابط أو الصفحة المطلوبة غير متوفرة حالياً في النظام.'
                      : 'Sorry, the requested page or route could not be found.',
                  style: AppTypography.dateSubtitle.copyWith(fontSize: 14),
                  textAlign: TextAlign.center,
                ),
                if (path != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    path!,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () => context.go(AppRoutes.main),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      isAr ? 'العودة للرئيسية' : 'Return to Home',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
