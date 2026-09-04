import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import 'request_leave_screen.dart';

class VacationBalanceScreen extends StatefulWidget {
  const VacationBalanceScreen({super.key});

  @override
  State<VacationBalanceScreen> createState() => _VacationBalanceScreenState();
}

class _VacationBalanceScreenState extends State<VacationBalanceScreen> {
  @override
  Widget build(BuildContext context) {
    final remaining = LocalStore.instance.vacationDaysRemaining;
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
          AppLocale.tr('vacation_balance'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Balance Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
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
                          Text(
                            AppLocale.tr('vac_total_available'),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '$remaining ${AppLocale.tr('vac_days_remaining')}',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _buildPill('10 ${AppLocale.tr('vac_annual')}', isPrimary: true),
                              const SizedBox(width: 8),
                              _buildPill('2 ${AppLocale.tr('vac_sick')}', isPrimary: true),
                              const SizedBox(width: 8),
                              _buildPill('0 ${AppLocale.tr('vac_emergency')}', isPrimary: false),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // History Section Header
                    Text(
                      AppLocale.tr('vac_history'),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // History Card
                    Container(
                      width: double.infinity,
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
                          _buildHistoryItem(
                            title: AppLocale.tr('leave_type_annual_leave'),
                            dateRange: '10 – 12 Jun 2026',
                            duration: '3 days',
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                          _buildHistoryItem(
                            title: AppLocale.tr('leave_type_sick_leave'),
                            dateRange: '05 Mar 2026',
                            duration: '1 day',
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                          _buildHistoryItem(
                            title: AppLocale.tr('leave_type_annual_leave'),
                            dateRange: '28 Nov – 02 Dec 2025',
                            duration: '5 days',
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16, color: AppColors.scaffoldBackground),
                          _buildHistoryItem(
                            title: AppLocale.tr('leave_type_emergency_leave'),
                            dateRange: '29 Dec 2025 – 02 Jan 2026',
                            duration: '4 days',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom Request Leave Button
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const RequestLeaveScreen()),
                    );
                    if (mounted) setState(() {});
                  },
                  icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.white, size: 20),
                  label: Text(
                    AppLocale.tr('request_leave'),
                    style: AppTypography.buttonText.copyWith(fontSize: 15),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPill(String label, {required bool isPrimary}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isPrimary ? AppColors.shiftBg : const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.fontBase.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: isPrimary ? AppColors.primary : AppColors.textSecondary,
        ),
      ),
    );
  }

  Widget _buildHistoryItem({
    required String title,
    required String dateRange,
    required String duration,
  }) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
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
              const SizedBox(height: 4),
              Text(
                dateRange,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          Text(
            duration,
            style: AppTypography.fontBase.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
