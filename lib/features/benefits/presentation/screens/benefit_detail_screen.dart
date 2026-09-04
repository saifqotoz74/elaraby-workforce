import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/local_store.dart';
import '../../../services/presentation/screens/raise_concern_screen.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';

class BenefitDetailScreen extends StatelessWidget {
  final String title;
  final String discount;
  final String category;
  final String imagePath;
  final String? imageUrl;
  final String validity;
  final String description;

  const BenefitDetailScreen({
    super.key,
    this.title = 'Saudi Supermarket',
    this.discount = '20% OFF',
    this.category = 'Exclusive Perk',
    this.imagePath = 'assets/images/benefit_supermarket.png',
    this.imageUrl,
    this.validity = 'Valid through 31 Dec 2026',
    this.description = '',
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Column(
                children: [
                  // Hero Image with Floating Header & Card
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Hero Image (server image with bundled fallback)
                      SizedBox(
                        height: 240,
                        width: double.infinity,
                        child: imageUrl != null
                            ? Image.network(
                                ApiClient.instance.resolveUrl(imageUrl!),
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    Image.asset(imagePath, fit: BoxFit.cover),
                              )
                            : Image.asset(imagePath, fit: BoxFit.cover),
                      ),
                      // Gradient Overlay for AppBar Visibility
                      Container(
                        height: 100,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.6),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                      // Top Navigation Bar
                      Positioned(
                        top: MediaQuery.of(context).padding.top + 8,
                        left: 8,
                        right: 8,
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back, color: Colors.white),
                              onPressed: () => Navigator.of(context).maybePop(),
                            ),
                            Expanded(
                              child: Text(
                                title,
                                style: AppTypography.welcomeTitle.copyWith(
                                  fontSize: 18,
                                  color: Colors.white,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            const SizedBox(width: 48), // balance back button
                          ],
                        ),
                      ),
                      // Floating Offer Card
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: -45,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x10000000),
                                blurRadius: 12,
                                offset: Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              Text(
                                discount,
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                category,
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 14,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 60),

                  // Detail Content
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Pill 1: Branches
                        _buildInfoPill(
                          icon: Icons.location_on_outlined,
                          text: AppLocale.tr('ben_valid_branches'),
                        ),
                        const SizedBox(height: 8),

                        // Pill 2: Validity
                        _buildInfoPill(
                          icon: Icons.calendar_today_outlined,
                          text: validity,
                        ),
                        const SizedBox(height: 16),

                        // Card: How to Redeem
                        _buildContentCard(
                          title: AppLocale.tr('ben_redeem_title'),
                          content: Text(
                            AppLocale.tr('ben_redeem_body'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 14,
                              color: AppColors.textPrimary,
                              height: 1.4,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Card: Terms & Exclusions
                        _buildContentCard(
                          title: AppLocale.tr('ben_terms_title'),
                          content: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildBullet(AppLocale.tr('ben_terms_1')),
                              const SizedBox(height: 6),
                              _buildBullet(AppLocale.tr('ben_terms_2')),
                              const SizedBox(height: 6),
                              _buildBullet(AppLocale.tr('ben_terms_3')),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Card: About
                        _buildContentCard(
                          title: AppLocale.tr('ben_about_title'),
                          content: Text(
                            description.isEmpty ? AppLocale.tr('ben_default_desc') : description,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 14,
                              color: AppColors.textPrimary,
                              height: 1.4,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Report Issue Link
                        Center(
                          child: TextButton.icon(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const RaiseConcernScreen(),
                                ),
                              );
                            },
                            icon: const Icon(
                              Icons.outlined_flag_rounded,
                              size: 18,
                              color: AppColors.textSecondary,
                            ),
                            label: Text(
                              AppLocale.tr('ben_report_issue'),
                              style: AppTypography.fontBase.copyWith(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Action Button
          Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => _showEmployeeIdDialog(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  AppLocale.tr('ben_show_id'),
                  style: AppTypography.buttonText.copyWith(fontSize: 15),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showEmployeeIdDialog(BuildContext context) {
    final profile = LocalStore.instance.profile;
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.badge_outlined, color: AppColors.primary, size: 24),
            const SizedBox(width: 8),
            Text(AppLocale.tr('ben_employee_id')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              profile.name,
              style: AppTypography.fontBase.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.shiftBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                profile.employeeCode,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              AppLocale.tr('ben_id_note'),
              style: AppTypography.fontBase.copyWith(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(
              AppLocale.tr('common_ok'),
              style: const TextStyle(
                  color: AppColors.primary, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoPill({required IconData icon, required String text}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.shiftBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(width: 10),
          Text(
            text,
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContentCard({required String title, required Widget content}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
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
          const SizedBox(height: 10),
          content,
        ],
      ),
    );
  }

  Widget _buildBullet(String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 6, right: 8),
          child: Icon(Icons.circle, size: 5, color: AppColors.textPrimary),
        ),
        Expanded(
          child: Text(
            text,
            style: AppTypography.fontBase.copyWith(
              fontSize: 14,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
