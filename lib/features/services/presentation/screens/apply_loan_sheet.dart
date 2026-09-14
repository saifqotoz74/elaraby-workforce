import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/loan_controller.dart';
import 'salary_pin_gate.dart';

class ApplyLoanSheet extends ConsumerStatefulWidget {
  const ApplyLoanSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const ApplyLoanSheet(),
    );
  }

  @override
  ConsumerState<ApplyLoanSheet> createState() => _ApplyLoanSheetState();
}

class _ApplyLoanSheetState extends ConsumerState<ApplyLoanSheet> {
  String _selectedType = 'emergency_advance'; // emergency_advance, social_loan
  double _amount = 2000;
  int _installments = 2;
  String _purpose = 'emergency_medical';
  final TextEditingController _notesController = TextEditingController();

  final List<Map<String, String>> _purposes = [
    {'key': 'emergency_medical', 'ar': 'مصاريف علاجية وطبية طارئة', 'en': 'Emergency Medical'},
    {'key': 'marriage', 'ar': 'زواج أو مناسبة عائلية', 'en': 'Marriage / Family Occasion'},
    {'key': 'education', 'ar': 'مصاريف مدرسية وجامعية', 'en': 'Education / School Fees'},
    {'key': 'home_repair', 'ar': 'صيانة وتجهيزات منزلية', 'en': 'Home Renovation'},
    {'key': 'urgent_personal', 'ar': 'التزام شخصي عاجل', 'en': 'Urgent Personal Need'},
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loanState = ref.watch(loanStateProvider);
    final elig = loanState.eligibility;

    final isEmergency = _selectedType == 'emergency_advance';
    final maxAmount = isEmergency
        ? elig.maxEmergencyAdvance.toDouble()
        : elig.maxSocialLoan.toDouble();

    // Clamp current amount within allowed range
    if (_amount > maxAmount) {
      _amount = maxAmount;
    }
    if (_amount < 500) {
      _amount = 500;
    }

    // Allowed installments
    final allowedInstallments = isEmergency ? [1, 2] : [3, 6, 9, 12];
    if (!allowedInstallments.contains(_installments)) {
      _installments = allowedInstallments.first;
    }

    final monthlyDeduction = (_amount / _installments).round();

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        top: 20,
        left: 20,
        right: 20,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag Handle & Title Bar
            Center(
              child: Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.textSecondary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  AppLocale.tr('apply_new_loan'),
                  style: AppTypography.sectionHeading.copyWith(fontSize: 18),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Type Toggle: Emergency Advance vs Social Loan
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _buildTypeButton(
                      type: 'emergency_advance',
                      title: AppLocale.tr('emergency_advance'),
                      subtitle: 'حد أقصى ${elig.maxEmergencyAdvance} ج.م',
                      isSelected: isEmergency,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: _buildTypeButton(
                      type: 'social_loan',
                      title: AppLocale.tr('social_loan'),
                      subtitle: 'حد أقصى ${elig.maxSocialLoan} ج.م',
                      isSelected: !isEmergency,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Requested Amount Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  AppLocale.tr('loan_amount'),
                  style: AppTypography.fontBase.copyWith(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  '${_amount.toInt()} ج.م',
                  style: AppTypography.sectionHeading.copyWith(
                    color: AppColors.primary,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: AppColors.primary,
                inactiveTrackColor: AppColors.primary.withValues(alpha: 0.15),
                thumbColor: AppColors.primary,
                overlayColor: AppColors.primary.withValues(alpha: 0.2),
              ),
              child: Slider(
                value: _amount,
                min: 500,
                max: maxAmount,
                divisions: ((maxAmount - 500) / 250).round().clamp(1, 100),
                onChanged: (val) => setState(() => _amount = val),
              ),
            ),

            // Quick preset chips
            Row(
              children: [
                _buildQuickAmountChip(1000),
                const SizedBox(width: 8),
                _buildQuickAmountChip(2500),
                const SizedBox(width: 8),
                if (!isEmergency) ...[
                  _buildQuickAmountChip(5000),
                  const SizedBox(width: 8),
                ],
                _buildQuickAmountChip(maxAmount.toInt(), label: 'الحد الأقصى'),
              ],
            ),
            const SizedBox(height: 20),

            // Repayment Period / Installments
            Text(
              AppLocale.tr('repayment_months'),
              style: AppTypography.fontBase.copyWith(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: allowedInstallments.map((count) {
                final isSel = _installments == count;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    onTap: () => setState(() => _installments = count),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSel ? AppColors.primary : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isSel ? AppColors.primary : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Text(
                        '$count ${AppLocale.instance.isArabic ? (count <= 2 ? "شهور" : "شهر") : "months"}',
                        style: TextStyle(
                          color: isSel ? Colors.white : AppColors.textPrimary,
                          fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Live Repayment Preview Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF86EFAC)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.calculate_outlined, color: Color(0xFF16A34A), size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${AppLocale.tr('monthly_installment')}: $monthlyDeduction ج.م',
                          style: const TextStyle(
                            color: Color(0xFF15803D),
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'يتم الاستقطاع تلقائياً من راتب الشهر القادم ولمدة $_installments أقساط',
                          style: TextStyle(
                            color: const Color(0xFF15803D).withValues(alpha: 0.8),
                            fontSize: 11.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Purpose Selection
            Text(
              AppLocale.tr('loan_purpose'),
              style: AppTypography.fontBase.copyWith(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _purpose,
                  isExpanded: true,
                  items: _purposes.map((p) {
                    return DropdownMenuItem(
                      value: p['key'],
                      child: Text(
                        AppLocale.instance.isArabic ? p['ar']! : p['en']!,
                        style: AppTypography.fontBase.copyWith(fontSize: 13.5),
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _purpose = val);
                  },
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Submit Button with PIN verification
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: loanState.isSubmitting ? null : () => _confirmAndSubmit(context),
                child: loanState.isSubmitting
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.verified_user_outlined, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            AppLocale.instance.isArabic
                                ? 'تأكيد بالرمز السري وتقديم الطلب'
                                : 'Confirm with PIN & Submit',
                            style: AppTypography.buttonText.copyWith(fontSize: 15),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeButton({
    required String type,
    required String title,
    required String subtitle,
    required bool isSelected,
  }) {
    return InkWell(
      onTap: () => setState(() => _selectedType = type),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 2))]
              : null,
        ),
        child: Column(
          children: [
            Text(
              title,
              style: TextStyle(
                color: isSelected ? AppColors.primary : AppColors.textPrimary,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                color: isSelected ? AppColors.primary.withValues(alpha: 0.8) : AppColors.textSecondary,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAmountChip(int amount, {String? label}) {
    return InkWell(
      onTap: () => setState(() => _amount = amount.toDouble()),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label ?? '$amount',
          style: const TextStyle(fontSize: 11.5, color: AppColors.textPrimary),
        ),
      ),
    );
  }

  Future<void> _confirmAndSubmit(BuildContext context) async {
    // 1. PIN / Biometric confirmation dialog
    final verified = await showDialog<dynamic>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => const SalaryPinGateDialog(),
    );

    if (verified != true && !(verified is String && verified.isNotEmpty)) {
      return;
    }

    final pin = verified is String ? verified : null;

    // 2. Submit application
    final loan = await ref.read(loanStateProvider.notifier).submitLoanApplication(
      type: _selectedType,
      amount: _amount.toInt(),
      installmentsCount: _installments,
      purpose: _purpose,
      notes: _notesController.text,
      pin: pin,
    );

    if (!mounted || !context.mounted) return;

    if (loan != null) {
      Navigator.pop(context); // Close sheet
      _showSuccessReceipt(context, loan);
    } else {
      final err = ref.read(loanStateProvider).errorMessage ?? 'Submission failed';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: Colors.red),
      );
    }
  }

  void _showSuccessReceipt(BuildContext context, dynamic loan) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 26),
            const SizedBox(width: 8),
            Text(
              AppLocale.tr('loan_receipt_title'),
              style: AppTypography.sectionHeading.copyWith(fontSize: 16),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'تم استلام طلبكم المالي بنجاح وبدء جدول الاستقطاع الآلي.',
              style: AppTypography.fontBase.copyWith(fontSize: 13),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _receiptRow(AppLocale.tr('loan_receipt_ref'), loan.referenceNumber),
                  _receiptRow(AppLocale.tr('loan_amount'), '${loan.amount} ج.م'),
                  _receiptRow(AppLocale.tr('installment_count_desc'), '${loan.installmentsCount} أقساط'),
                  _receiptRow(AppLocale.tr('monthly_installment'), '${loan.monthlyInstallment} ج.م / شهر'),
                ],
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppLocale.tr('auth_continue')),
          ),
        ],
      ),
    );
  }

  Widget _receiptRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
