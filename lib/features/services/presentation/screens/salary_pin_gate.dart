import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/presentation/widgets/numeric_keypad.dart';

/// Modal PIN entry used when "Salary Slip Protection" is enabled. Pops with
/// `true` when the stored PIN matches, `false` when cancelled.
class SalaryPinGateDialog extends StatefulWidget {
  const SalaryPinGateDialog({super.key});

  @override
  State<SalaryPinGateDialog> createState() => _SalaryPinGateDialogState();
}

class _SalaryPinGateDialogState extends State<SalaryPinGateDialog> {
  String _pin = '';
  bool _wrong = false;

  Future<void> _onPinComplete() async {
    final ok = await LocalStore.instance.verifyPin(_pin);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _wrong = true;
        _pin = '';
      });
    }
  }

  void _onNumberPressed(String number) {
    if (_pin.length < 4) {
      setState(() => _pin += number);
      if (_pin.length == 4) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) _onPinComplete();
        });
      }
    }
  }

  void _onDeletePressed() {
    if (_pin.isNotEmpty) {
      setState(() => _pin = _pin.substring(0, _pin.length - 1));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              AppLocale.tr('settings_salary_protection'),
              style: AppTypography.fontBase.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              AppLocale.tr('slip_enter_pin'),
              style: AppTypography.dateSubtitle.copyWith(fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (index) {
                final isFilled = index < _pin.length;
                return Container(
                  width: 14,
                  height: 14,
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  decoration: BoxDecoration(
                    color: isFilled
                        ? (_wrong
                            ? AppColors.announcementHeader
                            : AppColors.primary)
                        : const Color(0xFFD1D5DB),
                    shape: BoxShape.circle,
                  ),
                );
              }),
            ),
            if (_wrong) ...[
              const SizedBox(height: 10),
              Text(
                AppLocale.tr('auth_wrong_pin'),
                style: AppTypography.fontBase.copyWith(
                  fontSize: 12,
                  color: AppColors.announcementHeader,
                ),
              ),
            ],
            const SizedBox(height: 8),
            NumericKeypad(
              onNumberPressed: _onNumberPressed,
              onDeletePressed: _onDeletePressed,
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                AppLocale.tr('common_cancel'),
                style: const TextStyle(color: AppColors.textSecondary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
