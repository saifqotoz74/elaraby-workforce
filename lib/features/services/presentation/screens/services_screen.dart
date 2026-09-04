import 'package:flutter/material.dart';
import '../../../inbox/presentation/screens/inbox_screen.dart';
import '../../data/requests_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_typography.dart';
import 'employee_data_screen.dart';
import 'hr_request_screen.dart';
import 'raise_concern_screen.dart';
import 'request_leave_screen.dart';
import 'salary_slip_screen.dart';
import 'shift_schedule_screen.dart';
import 'vacation_balance_screen.dart';
import 'your_requests_screen.dart';

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  bool _q1Expanded = false;
  bool _q2Expanded = false;

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          // Pinned App Bar
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x08000000),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            padding: EdgeInsets.fromLTRB(20, topPadding + 12, 20, 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Services',
                      style: AppTypography.welcomeTitle,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Everything you need in one place.',
                      style: AppTypography.dateSubtitle,
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const InboxScreen()),
                    );
                  },
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF1F4F8),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.notifications,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Scrollable Body
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 16),

                  // Your Requests Card
                  _buildYourRequestsCard(context),
                  const SizedBox(height: 24),

                  // Section: Pay & Time
                  _buildSectionTitle(AppLocale.tr('pay_and_time')),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.payments_outlined,
                    title: AppLocale.tr('salary_slip'),
                    subtitle: AppLocale.tr('svc_salary_subtitle'),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SalarySlipScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.calendar_month_outlined,
                    title: AppLocale.tr('shift_schedule'),
                    subtitle: AppLocale.tr('svc_shift_subtitle'),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const ShiftScheduleScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.beach_access_outlined,
                    title: AppLocale.tr('vacation_balance'),
                    subtitle: '${LocalStore.instance.vacationDaysRemaining} ${AppLocale.tr('svc_days_remaining')}',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const VacationBalanceScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 24),

                  // Section: Requests
                  _buildSectionTitle(AppLocale.tr('requests_section')),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.assignment_outlined,
                    title: AppLocale.tr('request_leave'),
                    badgeText: RequestsStore.instance.inReviewRequests.isEmpty
                        ? null
                        : '${RequestsStore.instance.inReviewRequests.length} ${AppLocale.tr('svc_pending')}',
                    badgeBg: const Color(0xFFFFF7ED),
                    badgeColor: const Color(0xFFEA580C),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RequestLeaveScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.description_outlined,
                    title: AppLocale.tr('hr_request'),
                    subtitle: AppLocale.tr('svc_hr_subtitle'),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const HrRequestScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.support_agent_outlined,
                    title: AppLocale.tr('raise_concern'),
                    subtitle: AppLocale.tr('svc_concern_subtitle'),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RaiseConcernScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 24),

                  // Section: My Info
                  _buildSectionTitle(AppLocale.tr('my_info')),
                  const SizedBox(height: 10),
                  _buildServiceTile(
                    icon: Icons.badge_outlined,
                    title: AppLocale.tr('employee_data'),
                    subtitle: AppLocale.tr('svc_view_profile'),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const EmployeeDataScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: 24),

                  // Section: Common Questions
                  _buildSectionTitle(AppLocale.tr('common_questions')),
                  const SizedBox(height: 10),
                  _buildFaqTile(
                    question: 'Why is my salary different this month?',
                    answer:
                        'Salary variations may occur due to overtime hours, unpaid absences, social insurance adjustments, or newly applied bonuses and allowances.',
                    isExpanded: _q1Expanded,
                    onToggle: () => setState(() => _q1Expanded = !_q1Expanded),
                  ),
                  const SizedBox(height: 10),
                  _buildFaqTile(
                    question: 'How long does a leave request take?',
                    answer:
                        'Leave requests are typically reviewed by your Line Manager within 24 to 48 hours and finalized by HR promptly.',
                    isExpanded: _q2Expanded,
                    onToggle: () => setState(() => _q2Expanded = !_q2Expanded),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildYourRequestsCard(BuildContext context) {
    return ListenableBuilder(
      listenable: RequestsStore.instance,
      builder: (context, _) {
        final requests = RequestsStore.instance.allRequests;
        final top3 = requests.take(3).toList();
        final remainingCount = requests.length - top3.length;

        return Container(
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
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Your Requests',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.history_rounded, color: AppColors.textPrimary, size: 22),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const YourRequestsScreen()),
                      );
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Top 3 requests
              ...top3.asMap().entries.map((entry) {
                final idx = entry.key;
                final r = entry.value;
                Color dotColor;
                if (r.status == RequestStatus.inReview) {
                  dotColor = AppColors.primary;
                } else if (r.status == RequestStatus.approved) {
                  dotColor = AppColors.statusGreen;
                } else {
                  dotColor = AppColors.announcementButton;
                }

                return Column(
                  children: [
                    _buildRequestItem(
                      dotColor: dotColor,
                      title: '${r.title} — ${r.statusLabel}',
                      subtitle: '${r.date} • ${r.summary}',
                    ),
                    if (idx < top3.length - 1) const SizedBox(height: 14),
                  ],
                );
              }),

              const SizedBox(height: 18),

              // Bottom Action Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    remainingCount > 0 ? '+$remainingCount other requests' : '${requests.length} total requests',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.primary,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const YourRequestsScreen()),
                      );
                    },
                    child: Row(
                      children: [
                        Text(
                          'View all',
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward_rounded, size: 16, color: AppColors.primary),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRequestItem({
    required Color dotColor,
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4, right: 12),
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
            ),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 14,
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
      ],
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: AppTypography.fontBase.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _buildServiceTile({
    required IconData icon,
    required String title,
    String? subtitle,
    String? badgeText,
    Color? badgeBg,
    Color? badgeColor,
    required VoidCallback onTap,
  }) {
    return Container(
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
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
                      if (subtitle != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (badgeText != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: badgeBg ?? AppColors.shiftBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      badgeText,
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: badgeColor ?? AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                const Icon(
                  Icons.chevron_right,
                  color: AppColors.textSecondary,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFaqTile({
    required String question,
    required String answer,
    required bool isExpanded,
    required VoidCallback onToggle,
  }) {
    return Container(
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onToggle,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        question,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      color: AppColors.primary,
                    ),
                  ],
                ),
                if (isExpanded) ...[
                  const SizedBox(height: 10),
                  Text(
                    answer,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
