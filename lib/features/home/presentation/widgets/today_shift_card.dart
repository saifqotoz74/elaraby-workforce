import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';

class TodayShiftCard extends StatelessWidget {
  const TodayShiftCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppLocale.instance,
      builder: (context, _) => Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.shiftBg,
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    AppLocale.tr('todays_shift'),
                    style: AppTypography.shiftCategory,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    AppLocale.tr('shift_time'),
                    style: AppTypography.shiftTime,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    AppLocale.tr('shift_line'),
                    style: AppTypography.shiftSubtitle,
                  ),
                ],
              ),
            ),
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.shiftIconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.calendar_today_rounded,
                color: AppColors.shiftTextBlue,
                size: 22,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
