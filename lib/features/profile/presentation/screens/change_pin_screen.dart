import 'dart:async';
import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/presentation/widgets/numeric_keypad.dart';

class ChangePinScreen extends StatefulWidget {
  const ChangePinScreen({super.key});

  @override
  State<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends State<ChangePinScreen> {
  // 0: Current PIN, 1: New PIN, 2: Confirm New PIN
  int _step = 0;
  String _currentPin = '';
  String _newPin = '';
  String _confirmedPin = '';
  String? _errorMessage;
  int _failedCurrentPinAttempts = 0;
  int _lockoutSeconds = 0;
  Timer? _lockoutTimer;

  @override
  void dispose() {
    _lockoutTimer?.cancel();
    super.dispose();
  }

  void _startLockout() {
    setState(() {
      _lockoutSeconds = 30;
      _errorMessage = AppLocale.instance.isArabic
          ? 'محاولات كثيرة خاطئة. يرجى الانتظار 30 ثانية'
          : 'Too many failed attempts. Please wait 30 seconds';
      _currentPin = '';
    });
    _lockoutTimer?.cancel();
    _lockoutTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_lockoutSeconds > 1) {
        setState(() {
          _lockoutSeconds--;
          _errorMessage = AppLocale.instance.isArabic
              ? 'محاولات كثيرة خاطئة. يرجى الانتظار $_lockoutSeconds ثانية'
              : 'Too many failed attempts. Please wait $_lockoutSeconds seconds';
        });
      } else {
        timer.cancel();
        setState(() {
          _lockoutSeconds = 0;
          _failedCurrentPinAttempts = 0;
          _errorMessage = null;
        });
      }
    });
  }

  void _onNumberPressed(String number) {
    if (_lockoutSeconds > 0) return;
    setState(() {
      _errorMessage = null;
      if (_step == 0) {
        if (_currentPin.length < 4) {
          _currentPin += number;
          if (_currentPin.length == 4) {
            Future.delayed(const Duration(milliseconds: 200), () async {
              final ok = await LocalStore.instance.verifyPin(_currentPin);
              if (!mounted) return;
              if (ok) {
                _failedCurrentPinAttempts = 0;
                setState(() => _step = 1);
              } else {
                _failedCurrentPinAttempts++;
                if (_failedCurrentPinAttempts >= 5) {
                  _startLockout();
                } else {
                  setState(() {
                    _errorMessage = AppLocale.tr('change_pin_wrong_current');
                    _currentPin = '';
                  });
                }
              }
            });
          }
        }
      } else if (_step == 1) {
        if (_newPin.length < 4) {
          _newPin += number;
          if (_newPin.length == 4) {
            if (RegExp(r'^(\d)\1{3}$').hasMatch(_newPin)) {
              setState(() {
                _errorMessage = AppLocale.instance.isArabic
                    ? 'رمز PIN ضعيف جداً، يرجى تجنب تكرار الرقم نفسه'
                    : 'PIN is too weak. Please avoid repeating the same digit.';
                _newPin = '';
              });
              return;
            }
            Future.delayed(const Duration(milliseconds: 200), () {
              if (mounted) setState(() => _step = 2);
            });
          }
        }
      } else if (_step == 2) {
        if (_confirmedPin.length < 4) {
          _confirmedPin += number;
          if (_confirmedPin.length == 4) {
            if (_confirmedPin == _newPin) {
              Future.delayed(const Duration(milliseconds: 200), () async {
                if (ApiClient.instance.token != null) {
                  final result =
                      await Backend.instance.changePin(_currentPin, _newPin);
                  if (!mounted) return;
                  if (result == AuthResult.locked) {
                    setState(() {
                      _errorMessage = AppLocale.trLocked(15);
                      _confirmedPin = '';
                    });
                    return;
                  }
                  if (result != AuthResult.success) {
                    setState(() {
                      _errorMessage = AppLocale.tr('change_pin_wrong_current');
                      _confirmedPin = '';
                      _step = 0;
                      _currentPin = '';
                      _newPin = '';
                    });
                    return;
                  }
                }
                await LocalStore.instance.setPin(_newPin);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(AppLocale.tr('change_pin_success')),
                    backgroundColor: AppColors.statusGreen,
                  ),
                );
                Navigator.of(context).pop();
              });
            } else {
              Future.delayed(const Duration(milliseconds: 200), () {
                if (!mounted) return;
                setState(() {
                  _errorMessage = AppLocale.tr('auth_pin_mismatch');
                  _confirmedPin = '';
                });
              });
            }
          }
        }
      }
    });
  }

  void _onDeletePressed() {
    if (_lockoutSeconds > 0) return;
    setState(() {
      _errorMessage = null;
      if (_step == 0 && _currentPin.isNotEmpty) {
        _currentPin = _currentPin.substring(0, _currentPin.length - 1);
      } else if (_step == 1 && _newPin.isNotEmpty) {
        _newPin = _newPin.substring(0, _newPin.length - 1);
      } else if (_step == 2 && _confirmedPin.isNotEmpty) {
        _confirmedPin = _confirmedPin.substring(0, _confirmedPin.length - 1);
      }
    });
  }

  String get _currentInput {
    if (_step == 0) return _currentPin;
    if (_step == 1) return _newPin;
    return _confirmedPin;
  }

  String get _title {
    if (_step == 0) return AppLocale.tr('change_pin_step_current_title');
    if (_step == 1) return AppLocale.tr('change_pin_step_new_title');
    return AppLocale.tr('change_pin_step_confirm_title');
  }

  String get _subtitle {
    if (_step == 0) return AppLocale.tr('change_pin_step_current_subtitle');
    if (_step == 1) return AppLocale.tr('change_pin_step_new_subtitle');
    return AppLocale.tr('change_pin_step_confirm_subtitle');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () {
            if (_step > 0) {
              setState(() {
                _step--;
                _errorMessage = null;
              });
            } else {
              Navigator.of(context).maybePop();
            }
          },
        ),
        title: Text(
          AppLocale.tr('menu_change_pin'),
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              const SizedBox(height: 32),

              // Step indicator
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(3, (i) {
                  final isActive = i <= _step;
                  return Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: isActive ? AppColors.primary : const Color(0xFFE5E7EB),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 32),

              // Title & Subtitle
              Text(
                _title,
                style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 8),
              Text(
                _subtitle,
                style: AppTypography.dateSubtitle.copyWith(fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),

              // PIN Dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(4, (index) {
                  final isFilled = index < _currentInput.length;
                  return Container(
                    width: 14,
                    height: 14,
                    margin: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: isFilled ? AppColors.primary : const Color(0xFFD1D5DB),
                      shape: BoxShape.circle,
                    ),
                  );
                }),
              ),

              if (_errorMessage != null) ...[
                const SizedBox(height: 16),
                Text(
                  _errorMessage!,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 13,
                    color: const Color(0xFFDC2626),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],

              const Spacer(),

              // Numeric Keypad
              NumericKeypad(
                onNumberPressed: _onNumberPressed,
                onDeletePressed: _onDeletePressed,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
