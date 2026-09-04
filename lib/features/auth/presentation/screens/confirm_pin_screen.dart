import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../main_navigation/presentation/screens/main_nav_screen.dart';
import '../widgets/auth_progress_bar.dart';
import '../widgets/numeric_keypad.dart';

class ConfirmPinScreen extends StatefulWidget {
  final String createdPin;

  const ConfirmPinScreen({
    super.key,
    required this.createdPin,
  });

  @override
  State<ConfirmPinScreen> createState() => _ConfirmPinScreenState();
}

class _ConfirmPinScreenState extends State<ConfirmPinScreen> {
  String _confirmedPin = '';
  bool _mismatch = false;

  Future<void> _onPinComplete() async {
    if (_confirmedPin == widget.createdPin) {
      await LocalStore.instance.setPin(widget.createdPin);
      await LocalStore.instance.setOnboarded(true);
      // Mirror the PIN to the server (hashed there too).
      final nationalId = ApiClient.instance.lastNationalId;
      if (nationalId != null) {
        Backend.instance.setPin(nationalId, widget.createdPin);
      }
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavScreen()),
        (route) => false,
      );
    } else {
      setState(() => _mismatch = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocale.tr('auth_pin_mismatch'))),
      );
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (mounted) {
        setState(() {
          _mismatch = false;
          _confirmedPin = '';
        });
      }
    }
  }

  void _onNumberPressed(String number) {
    if (_confirmedPin.length < 4) {
      setState(() {
        _confirmedPin += number;
      });

      if (_confirmedPin.length == 4) {
        Future.delayed(const Duration(milliseconds: 250), () {
          if (mounted) _onPinComplete();
        });
      }
    }
  }

  void _onDeletePressed() {
    if (_confirmedPin.isNotEmpty) {
      setState(() {
        _confirmedPin = _confirmedPin.substring(0, _confirmedPin.length - 1);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: AppColors.scaffoldBackground,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Progress Bar (Step 5 - All 5 complete)
              const AuthProgressBar(currentStep: 5),
              const SizedBox(height: 24),

              // Title & Subtitle
              Text(
                AppLocale.tr('auth_confirm_pin_title'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 8),
              Text(
                AppLocale.tr('auth_confirm_pin_subtitle'),
                style: AppTypography.dateSubtitle.copyWith(fontSize: 14),
              ),
              if (_mismatch) ...[
                const SizedBox(height: 8),
                Text(
                  AppLocale.tr('auth_pin_mismatch'),
                  style: AppTypography.dateSubtitle.copyWith(
                    fontSize: 13,
                    color: AppColors.announcementHeader,
                  ),
                ),
              ],
              const SizedBox(height: 48),

              // 4 PIN Dots
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(4, (index) {
                  final isFilled = index < _confirmedPin.length;
                  return Container(
                    width: 14,
                    height: 14,
                    margin: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: isFilled
                          ? (_mismatch ? AppColors.announcementHeader : AppColors.primary)
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
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
