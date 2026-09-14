import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/shifts_controller.dart';

class ApplyOvertimeSheet extends ConsumerStatefulWidget {
  final String initialDate;

  const ApplyOvertimeSheet({super.key, required this.initialDate});

  static Future<bool?> show(BuildContext context, {required String initialDate}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ApplyOvertimeSheet(initialDate: initialDate),
    );
  }

  @override
  ConsumerState<ApplyOvertimeSheet> createState() => _ApplyOvertimeSheetState();
}

class _ApplyOvertimeSheetState extends ConsumerState<ApplyOvertimeSheet> {
  late String _selectedDate;
  double _hours = 2.0;
  String _timePeriod = 'day'; // 'day' (135%), 'night' (170%), 'holiday' (200%)
  final TextEditingController _reasonCtrl = TextEditingController();
  bool _submitting = false;

  final double _baseHourlyRate = 50.0; // Standard factory rate

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate;
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  double get _multiplier {
    switch (_timePeriod) {
      case 'night':
        return 1.70;
      case 'holiday':
        return 2.00;
      case 'day':
      default:
        return 1.35;
    }
  }

  int get _estimatedAmount {
    return (_hours * _baseHourlyRate * _multiplier).round();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    final success = await ref.read(overtimeProvider.notifier).submitClaim(
          date: _selectedDate,
          hours: _hours,
          timePeriod: _timePeriod,
          reason: _reasonCtrl.text.trim().isEmpty
              ? 'Production schedule completion'
              : _reasonCtrl.text.trim(),
        );

    if (!mounted) return;
    setState(() => _submitting = false);

    if (success) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.instance.isArabic
              ? 'تم تسجيل ساعات العمل الإضافي بنجاح وإرسالها للمشرف.'
              : 'Overtime claim submitted successfully for supervisor approval.'),
          backgroundColor: AppColors.statusGreen,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.instance.isArabic
              ? 'تعذر إرسال طلب العمل الإضافي.'
              : 'Failed to submit overtime claim.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 16,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLocale.tr('log_overtime', context),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Date row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isAr ? 'تاريخ العمل الإضافي:' : 'Overtime Date:',
                style: AppTypography.fontBase.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _selectedDate,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Time period selection
          Text(
            isAr ? 'فترة العمل الإضافي (نسبة قانون العمل):' : 'Overtime Period (Statutory Rate):',
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _buildPeriodChip(
                  id: 'day',
                  label: AppLocale.tr('overtime_day_rate', context),
                  subtitle: '135%',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildPeriodChip(
                  id: 'night',
                  label: AppLocale.tr('overtime_night_rate', context),
                  subtitle: '170%',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildPeriodChip(
                  id: 'holiday',
                  label: AppLocale.tr('overtime_holiday_rate', context),
                  subtitle: '200%',
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Hours Slider
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLocale.tr('overtime_hours', context),
                style: AppTypography.fontBase.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                '$_hours ${isAr ? 'ساعات' : 'hrs'}',
                style: AppTypography.fontBase.copyWith(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          Slider(
            value: _hours,
            min: 1.0,
            max: 6.0,
            divisions: 10,
            activeColor: AppColors.primary,
            label: '$_hours hrs',
            onChanged: (val) => setState(() => _hours = val),
          ),
          const SizedBox(height: 12),

          // Compensation preview card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.08),
                  const Color(0xFFEFF6FF),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      AppLocale.tr('statutory_calculation', context),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                    Text(
                      '$_estimatedAmount EGP',
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  isAr
                      ? '$_hours ساعات × ${_baseHourlyRate.toStringAsFixed(0)} ج.م/ساعة × ${(_multiplier * 100).toInt()}% = $_estimatedAmount ج.م'
                      : '$_hours hrs × ${_baseHourlyRate.toStringAsFixed(0)} EGP/hr × ${(_multiplier * 100).toInt()}% = $_estimatedAmount EGP',
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isAr
                      ? 'طبقاً للمادة 85 من قانون العمل المصري رقم 12 لسنة 2003.'
                      : 'Calculated pursuant to Article 85 of Egyptian Labor Law No. 12.',
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Reason input
          Text(
            AppLocale.tr('overtime_reason', context),
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _reasonCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: isAr
                  ? 'مثال: تسليم طلبيات التصدير، صيانة ماكينات الخط...'
                  : 'E.g., Urgent export quota, machine line maintenance...',
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.all(12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
          ),
          const Spacer(),

          // Submit button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: !_submitting ? _submit : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      AppLocale.tr('log_overtime', context),
                      style: AppTypography.buttonText.copyWith(fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodChip({
    required String id,
    required String label,
    required String subtitle,
  }) {
    final isSelected = _timePeriod == id;
    return InkWell(
      onTap: () => setState(() => _timePeriod = id),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : const Color(0xFFE2E8F0),
          ),
        ),
        child: Column(
          children: [
            Text(
              subtitle,
              style: AppTypography.fontBase.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isSelected ? Colors.white : AppColors.primary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.fontBase.copyWith(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
