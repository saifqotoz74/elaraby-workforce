import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../services/presentation/screens/shift_schedule_screen.dart';
import '../../data/home_content.dart';

class TodayShiftCard extends StatelessWidget {
  const TodayShiftCard({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([AppLocale.instance, HomeContent.instance]),
      builder: (context, _) {
        final isAr = AppLocale.instance.isArabic;
        final shift = HomeContent.instance.todayShift;
        final profile = LocalStore.instance.profile;

        // Dynamic time
        final String shiftTime;
        if (shift != null) {
          shiftTime = isAr ? shift.timeAr : shift.time;
        } else {
          shiftTime = AppLocale.tr('shift_time');
        }

        // Dynamic line / description
        final String shiftSubtitle;
        if (shift != null) {
          final name = isAr ? shift.shiftNameAr : shift.shiftName;
          final line = isAr ? shift.lineAr : shift.line;
          shiftSubtitle = '$name • $line';
        } else {
          final dept = profile.department.isNotEmpty
              ? profile.department
              : AppLocale.tr('shift_line');
          shiftSubtitle = '${profile.factory} • $dept';
        }

        final bool isOff = shift?.offDuty ?? false;

        return Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const ShiftScheduleScreen(),
                ),
              );
            },
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.shiftBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  width: 1,
                ),
              ),
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              AppLocale.tr('todays_shift'),
                              style: AppTypography.shiftCategory,
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: isOff
                                    ? const Color(0xFF6B7280).withValues(alpha: 0.15)
                                    : const Color(0xFF10B981).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 6,
                                    height: 6,
                                    decoration: BoxDecoration(
                                      color: isOff
                                          ? const Color(0xFF6B7280)
                                          : const Color(0xFF10B981),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isOff
                                        ? (isAr ? 'عطلة' : 'Off')
                                        : (isAr ? 'قيد العمل' : 'On Duty'),
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: isOff
                                          ? const Color(0xFF4B5563)
                                          : const Color(0xFF059669),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          shiftTime,
                          style: AppTypography.shiftTime,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          shiftSubtitle,
                          style: AppTypography.shiftSubtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.shiftIconBg,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.calendar_month_rounded,
                      color: AppColors.shiftTextBlue,
                      size: 22,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
