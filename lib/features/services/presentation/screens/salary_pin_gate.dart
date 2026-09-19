import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/services/biometric_service.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/presentation/widgets/numeric_keypad.dart';

/// Modal PIN entry used when "Salary Slip Protection" is enabled. Pops with
/// `true` when the stored PIN matches, `false` when cancelled.
class SalaryPinGateDialog extends StatefulWidget {
  final BiometricService? biometricService;

  const SalaryPinGateDialog({super.key, this.biometricService});

  @override
  State<SalaryPinGateDialog> createState() => _SalaryPinGateDialogState();
}

class _SalaryPinGateDialogState extends State<SalaryPinGateDialog> {
  BiometricService get _biometricService =>
      widget.biometricService ?? BiometricService.instance;
  String _pin = '';
  bool _wrong = false;
  int _failedAttempts = 0;
  int _lockoutSeconds = 0;
  Timer? _lockoutTimer;
  bool _biometricAvailable = false;
  BiometricCapability? _biometricCapability;

  @override
  void initState() {
    super.initState();
    _failedAttempts = LocalStore.instance.salaryGateFailedAttempts;
    final lockoutUntil = LocalStore.instance.salaryGateLockoutUntil;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (lockoutUntil > now) {
      final remaining = ((lockoutUntil - now) / 1000).ceil();
      _startLockout(remaining > 0 ? remaining : 1);
    }
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final enabled =
        LocalStore.instance.getSetting('fingerprint', defaultValue: true);
    if (!enabled) return;
    try {
      final capability = await _biometricService.checkCapability();
      if (mounted && capability.canAuthenticate) {
        setState(() {
          _biometricAvailable = true;
          _biometricCapability = capability;
        });
        _authenticateBiometric();
      }
    } on Exception catch (e) {
      debugPrint('Biometric check failed: $e');
    }
  }

  Future<void> _authenticateBiometric() async {
    try {
      final ok = await _biometricService.authenticate(
        reason: AppLocale.tr('biometric_prompt'),
      );
      if (!mounted) return;
      if (ok) {
        await LocalStore.instance.resetSalaryGateLockout();
        if (!mounted) return;
        Navigator.of(context).pop(true);
      }
    } on Exception catch (e) {
      debugPrint('Biometric authentication failed: $e');
    }
  }

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    super.dispose();
  }

  void _startLockout([int seconds = 30]) {
    setState(() {
      _lockoutSeconds = seconds;
      _wrong = false;
      _pin = '';
    });
    _lockoutTimer?.cancel();
    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_lockoutSeconds > 1) {
        setState(() => _lockoutSeconds--);
      } else {
        timer.cancel();
        LocalStore.instance.resetSalaryGateLockout();
        setState(() {
          _lockoutSeconds = 0;
          _failedAttempts = 0;
        });
      }
    });
  }

  Future<void> _onPinComplete() async {
    if (_lockoutSeconds > 0) return;
    final ok = await LocalStore.instance.verifyPin(_pin);
    if (!mounted) return;
    if (ok) {
      await LocalStore.instance.resetSalaryGateLockout();
      if (!mounted) return;
      Navigator.of(context).pop(_pin);
    } else {
      _failedAttempts++;
      await LocalStore.instance.setSalaryGateFailedAttempts(_failedAttempts);
      if (_failedAttempts >= 5) {
        final lockoutUntil = DateTime.now().millisecondsSinceEpoch + 30000;
        await LocalStore.instance.setSalaryGateLockoutUntil(lockoutUntil);
        _startLockout(30);
      } else {
        setState(() {
          _wrong = true;
          _pin = '';
        });
      }
    }
  }

  void _onNumberPressed(String number) {
    if (_lockoutSeconds > 0) return;
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
    if (_lockoutSeconds > 0) return;
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
            if (_lockoutSeconds > 0) ...[
              const SizedBox(height: 10),
              Text(
                AppLocale.trLocked(_lockoutSeconds),
                style: AppTypography.fontBase.copyWith(
                  fontSize: 12,
                  color: AppColors.announcementHeader,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
            ] else if (_wrong) ...[
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
            if (_biometricAvailable) ...[
              IconButton(
                icon: Icon(
                  _biometricCapability?.icon ?? Icons.fingerprint_rounded,
                  size: 36,
                  color: AppColors.primary,
                ),
                onPressed: _authenticateBiometric,
                tooltip: _biometricCapability
                        ?.buttonLabel(AppLocale.instance.isArabic) ??
                    AppLocale.tr('biometric_prompt'),
              ),
              const SizedBox(height: 4),
            ],
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
