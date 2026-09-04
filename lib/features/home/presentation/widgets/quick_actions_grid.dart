import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../benefits/presentation/screens/benefits_screen.dart';
import '../../../profile/presentation/screens/help_support_screen.dart';
import '../../../services/presentation/screens/salary_slip_screen.dart';
import '../../../services/presentation/screens/shift_schedule_screen.dart';
import '../../../services/presentation/screens/vacation_balance_screen.dart';

class QuickActionsGrid extends StatelessWidget {
  const QuickActionsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) {
        final items = [
          _QuickActionItem(
            title: AppLocale.tr('qa_salary'),
            icon: Icons.account_balance_wallet_rounded,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SalarySlipScreen()),
              );
            },
          ),
          _QuickActionItem(
            title: AppLocale.tr('qa_vacation'),
            icon: Icons.beach_access_rounded,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const VacationBalanceScreen()),
              );
            },
          ),
          _QuickActionItem(
            title: AppLocale.tr('qa_shift'),
            icon: Icons.calendar_today_rounded,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ShiftScheduleScreen()),
              );
            },
          ),
          _QuickActionItem(
            title: AppLocale.tr('qa_benefits'),
            icon: Icons.card_giftcard_rounded,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const BenefitsScreen(initialTab: 0),
                ),
              );
            },
          ),
          _QuickActionItem(
            title: AppLocale.tr('qa_trips'),
            icon: Icons.flight_rounded,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const BenefitsScreen(initialTab: 1),
                ),
              );
            },
          ),
          _QuickActionItem(
            title: AppLocale.tr('qa_support'),
            icon: Icons.headphones_rounded,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const HelpSupportScreen()),
              );
            },
          ),
        ];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AppLocale.tr('quick_actions'),
              style: AppTypography.sectionHeading,
            ),
            const SizedBox(height: 12),
            GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              itemCount: items.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.15,
              ),
              itemBuilder: (context, index) {
                final item = items[index];
                return Material(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(18),
                  elevation: 0,
                  child: InkWell(
                    onTap: item.onTap,
                    borderRadius: BorderRadius.circular(18),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.quickActionIconBg,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            item.icon,
                            color: AppColors.quickActionIcon,
                            size: 22,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.title,
                          style: AppTypography.quickActionLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

class _QuickActionItem {
  final String title;
  final IconData icon;
  final VoidCallback onTap;

  const _QuickActionItem({
    required this.title,
    required this.icon,
    required this.onTap,
  });
}
