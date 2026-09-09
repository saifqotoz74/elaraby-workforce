import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../services/presentation/screens/salary_slip_screen.dart';
import '../../../services/presentation/screens/vacation_balance_screen.dart';

class MetricCardsRow extends StatelessWidget {
  const MetricCardsRow({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([AppLocale.instance, LocalStore.instance]),
      builder: (context, _) => Row(
        children: [
          // Left Card: Vacation Left
          Expanded(
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const VacationBalanceScreen()),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
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
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AppLocale.tr('vacation_left'),
                        style: AppTypography.metricLabel,
                      ),
                      const SizedBox(height: 8),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '${LocalStore.instance.vacationDaysRemaining} ${AppLocale.tr('vac_days_unit')} ${AppLocale.tr('vac_left_suffix')}',
                          style: AppTypography.metricValue,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          // Right Card: Salary
          Expanded(
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const SalarySlipScreen()),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
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
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AppLocale.tr('salary_label'),
                        style: AppTypography.metricLabel,
                      ),
                      const SizedBox(height: 8),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          AppLocale.tr('view_payslip_action'),
                          style: AppTypography.metricValue.copyWith(
                            fontSize: 16,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
