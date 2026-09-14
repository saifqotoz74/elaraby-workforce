import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../profile/presentation/controllers/profile_controller.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../../data/requests_store.dart';
import '../controllers/requests_controller.dart';

class VacationBalanceScreen extends ConsumerWidget {
  const VacationBalanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final remaining = ref.watch(vacationBalanceProvider);
    final requestsState = ref.watch(requestsStateProvider);

    final allReqs = requestsState.data ?? RequestsStore.instance.allRequests;
    final leaveRequests =
        allReqs.where((r) => r.type == 'Leave').toList();

    final emergencyUsed = RequestsStore.instance.emergencyDaysUsed;
    final emergencyLeft = RequestsStore.instance.emergencyDaysRemaining;
    final sickTaken = RequestsStore.instance.sickDaysTaken;

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
          AppLocale.tr('vacation_balance_hub', context),
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
                      padding: const EdgeInsets.symmetric(
                          vertical: 24, horizontal: 16),
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
                            AppLocale.tr('annual_balance_available', context),
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '$remaining ${AppLocale.tr('vac_days_remaining', context)}',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildPill(
                                  '$remaining ${AppLocale.tr('vac_annual', context)}',
                                  isPrimary: true),
                              _buildPill(
                                  '$sickTaken ${AppLocale.tr('vac_sick', context)}',
                                  isPrimary: false),
                              _buildPill(
                                  '$emergencyUsed/6 ${AppLocale.tr('vac_emergency', context)}',
                                  isPrimary: false),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Egyptian Labor Law Emergency Quota Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.shield_outlined,
                                      size: 16, color: AppColors.primary),
                                  const SizedBox(width: 6),
                                  Text(
                                    AppLocale.tr(
                                        'emergency_annual_limit', context),
                                    style: AppTypography.fontBase.copyWith(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                '$emergencyUsed / 6',
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: emergencyUsed >= 6
                                      ? AppColors.error
                                      : AppColors.primary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: (emergencyUsed / 6.0).clamp(0.0, 1.0),
                              minHeight: 8,
                              backgroundColor: const Color(0xFFF1F5F9),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                emergencyUsed >= 6
                                    ? AppColors.error
                                    : (emergencyUsed >= 4
                                        ? const Color(0xFFF59E0B)
                                        : AppColors.primary),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            AppLocale.instance.isArabic
                                ? 'متبقي لك $emergencyLeft أيام عارضة هذا العام (بحد أقصى يومين متصلين لكل طلب)'
                                : '$emergencyLeft emergency days remaining this year (max 2 consecutive days per request)',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // History Section Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          AppLocale.tr('leave_history_title', context),
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        Text(
                          '${leaveRequests.length}',
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // History Container
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
                      child: leaveRequests.isEmpty
                          ? Padding(
                              padding: const EdgeInsets.symmetric(
                                  vertical: 40, horizontal: 20),
                              child: Column(
                                children: [
                                  Icon(Icons.event_note_outlined,
                                      size: 40,
                                      color: AppColors.textSecondary
                                          .withValues(alpha: 0.4)),
                                  const SizedBox(height: 10),
                                  Text(
                                    AppLocale.instance.isArabic
                                        ? 'لا توجد طلبات إجازة مسجلة بعد'
                                        : 'No leave requests recorded yet',
                                    style: AppTypography.fontBase.copyWith(
                                      fontSize: 13,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : Column(
                              children: [
                                for (int i = 0;
                                    i < leaveRequests.length;
                                    i++) ...[
                                  _buildDynamicHistoryItem(
                                      context, leaveRequests[i]),
                                  if (i < leaveRequests.length - 1)
                                    const Divider(
                                      height: 1,
                                      indent: 16,
                                      endIndent: 16,
                                      color: AppColors.scaffoldBackground,
                                    ),
                                ],
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
                    await AppNavigation.toRequestLeave(context);
                  },
                  icon: const Icon(Icons.add_circle_outline_rounded,
                      color: Colors.white, size: 20),
                  label: Text(
                    AppLocale.tr('request_leave', context),
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

  Widget _buildDynamicHistoryItem(BuildContext context, EmployeeRequest req) {
    Color statusBg;
    Color statusColor;
    String statusLabel;

    switch (req.status) {
      case RequestStatus.approved:
        statusBg = const Color(0xFFDCFCE7);
        statusColor = AppColors.statusGreen;
        statusLabel = AppLocale.tr('stage_approved', context);
        break;
      case RequestStatus.rejected:
        statusBg = const Color(0xFFFEE2E2);
        statusColor = AppColors.error;
        statusLabel = AppLocale.tr('stage_rejected', context);
        break;
      case RequestStatus.inReview:
        statusBg = const Color(0xFFDBEAFE);
        statusColor = AppColors.primary;
        statusLabel = AppLocale.tr('stage_pending', context);
        break;
    }

    final fromDate = req.details['from'] ?? '';
    final toDate = req.details['to'] ?? '';
    final dateRange = (fromDate.isNotEmpty && toDate.isNotEmpty)
        ? '$fromDate → $toDate'
        : req.date;
    final days = req.details['days'] ?? req.details['workingDays'] ?? '1';

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        req.title,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusLabel,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  dateRange,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                if (req.details['excludedCount'] != null &&
                    req.details['excludedCount'] != '0') ...[
                  const SizedBox(height: 4),
                  Text(
                    '${req.details['excludedCount']} days off excluded',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.statusGreen,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '$days ${AppLocale.instance.isArabic ? 'أيام' : 'days'}',
            style: AppTypography.fontBase.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
