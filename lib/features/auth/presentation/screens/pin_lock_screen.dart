import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../main_navigation/presentation/screens/main_nav_screen.dart';
import '../widgets/numeric_keypad.dart';
import 'get_started_screen.dart';

/// Lock screen shown at launch once onboarding is complete: the stored PIN
/// must be verified before the app opens. When "Fingerprint Login" is enabled
/// in settings and the device supports biometrics, a biometric prompt is
/// offered alongside the PIN.
class PinLockScreen extends StatefulWidget {
  const PinLockScreen({super.key});

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen> {
  final LocalAuthentication _auth = LocalAuthentication();

  String _pin = '';
  bool _wrong = false;
  String? _lockedMessage;
  bool _biometricAvailable = false;

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final enabled =
        LocalStore.instance.getSetting('fingerprint', defaultValue: true);
    if (!enabled) return;
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      if (mounted && canCheck && isDeviceSupported) {
        setState(() => _biometricAvailable = true);
        _authenticateBiometric();
      }
    } catch (_) {
      // No biometric hardware — the PIN remains the only path.
    }
  }

  Future<void> _authenticateBiometric() async {
    try {
      final ok = await _auth.authenticate(
        localizedReason: AppLocale.tr('biometric_prompt'),
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
      if (!mounted) return;
      if (ok) _enterApp();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocale.tr('biometric_not_setup'))),
        );
      }
    }
  }

  void _enterApp() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const MainNavScreen()),
      (route) => false,
    );
  }

  Future<void> _onPinComplete() async {
    // Server is authoritative when reachable; only an unreachable server
    // falls back to the local hash. A server lockout is never bypassed.
    var result = await Backend.instance.verifyPin(_pin);
    if (result == AuthResult.invalid && !Backend.instance.online.value) {
      final localOk = await LocalStore.instance.verifyPin(_pin);
      result = localOk ? AuthResult.success : AuthResult.invalid;
    }
    if (!mounted) return;
    final ok = result == AuthResult.success;
    if (result == AuthResult.locked) {
      setState(() {
        _lockedMessage = AppLocale.trLocked(15);
        _pin = '';
      });
      return;
    }
    if (ok) {
      _enterApp();
    } else {
      setState(() => _wrong = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocale.tr('auth_wrong_pin'))),
      );
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (mounted) {
        setState(() {
          _wrong = false;
          _pin = '';
        });
      }
    }
  }

  void _onNumberPressed(String number) {
    if (_lockedMessage != null) return; // locked out — ignore input
    if (_pin.length < 4) {
      setState(() {
        _pin += number;
        _lockedMessage = null;
      });
      if (_pin.length == 4) {
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) _onPinComplete();
        });
      }
    }
  }

  void _onDeletePressed() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
      });
    }
  }

  Future<void> _forgotPin() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppLocale.tr('auth_forgot_pin')),
        content: Text(AppLocale.tr('auth_forgot_body')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(AppLocale.tr('common_cancel')),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(AppLocale.tr('common_ok')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await LocalStore.instance.clearSession();
    await ApiClient.instance.setToken(null);
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const GetStartedScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 48),
              Text(
                AppLocale.tr('auth_unlock_title'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 8),
              Text(
                _lockedMessage ?? AppLocale.tr('auth_unlock_subtitle'),
                style: AppTypography.dateSubtitle.copyWith(
                  fontSize: 14,
                  height: 1.4,
                  color: _lockedMessage != null
                      ? AppColors.announcementHeader
                      : null,
                ),
              ),
              const SizedBox(height: 48),

              // 4 PIN Dots
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
                          ? (_wrong ? AppColors.announcementHeader : AppColors.primary)
                          : const Color(0xFFD1D5DB),
                      shape: BoxShape.circle,
                    ),
                  );
                }),
              ),
              const Spacer(),

              // Numeric Keypad
              NumericKeypad(
                onNumberPressed: _onNumberPressed,
                onDeletePressed: _onDeletePressed,
              ),
              const SizedBox(height: 8),
              if (_biometricAvailable)
                Center(
                  child: TextButton.icon(
                    onPressed: _authenticateBiometric,
                    icon: const Icon(Icons.fingerprint_rounded,
                        color: AppColors.primary, size: 22),
                    label: Text(
                      AppLocale.tr('biometric_button'),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                )
              else
                Center(
                  child: TextButton(
                    onPressed: _forgotPin,
                    child: Text(
                      AppLocale.tr('auth_forgot_pin'),
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
