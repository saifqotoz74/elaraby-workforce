import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';

class QuickSurveyCard extends StatefulWidget {
  const QuickSurveyCard({super.key});

  @override
  State<QuickSurveyCard> createState() => _QuickSurveyCardState();
}

class _QuickSurveyCardState extends State<QuickSurveyCard> {
  int? _selectedRating;
  bool _submitted = LocalStore.instance.surveySubmitted;

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surveyBg,
        borderRadius: BorderRadius.circular(20),
      ),
      padding: const EdgeInsets.all(16),
      child: _submitted
          ? Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEAF8F0),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    color: AppColors.statusGreen,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isAr ? 'شكراً لمشاركتك رأيك!' : 'Thank you for your feedback!',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        isAr
                            ? 'تقييمك يساعدنا على تحسين تجربة العمل.'
                            : 'Your response helps us improve the workplace experience.',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isAr ? 'استبيان سريع' : 'Quick Survey',
                            style: AppTypography.surveyHeader,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            isAr
                                ? 'هل كان من السهل العثور على ما تحتاجه في التطبيق؟'
                                : 'Was it easy to find what you needed in the app?',
                            style: AppTypography.surveyQuestion,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.surveyIconBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.assignment_rounded,
                        color: AppColors.surveyIcon,
                        size: 22,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: List.generate(5, (index) {
                    final rating = index + 1;
                    final isSelected = _selectedRating == rating;

                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          left: index == 0 ? 0 : 4,
                          right: index == 4 ? 0 : 4,
                        ),
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _selectedRating = rating;
                            });
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            height: 42,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.surveyIcon
                                  : AppColors.surveyPillBg,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.surveyIcon
                                    : AppColors.surveyPillBorder,
                                width: 1,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '$rating',
                              style: AppTypography.surveyRatingNumber.copyWith(
                                color: isSelected ? Colors.white : AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                if (_selectedRating != null) ...[
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 38,
                    child: ElevatedButton(
                      onPressed: () {
                        LocalStore.instance.setSurveySubmitted();
                        setState(() {
                          _submitted = true;
                        });
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surveyIcon,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Text(
                        isAr ? 'إرسال التقييم' : 'Submit Feedback',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}
