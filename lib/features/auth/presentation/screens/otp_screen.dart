import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/network/phone_auth_service.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/national_id_validator.dart';
import '../widgets/auth_progress_bar.dart';
import '../../../../core/navigation/app_navigation.dart';

class OtpScreen extends StatefulWidget {
  final String? nationalId;

  /// Present when the server runs in dev mode (no SMS gateway) — shown as a
  /// testing hint. Null means the server was unreachable (offline pass-through).
  final String? devCode;

  /// Masked phone number of the employee (e.g. +20 122 ••••• 79) returned by server.
  final String? maskedPhone;

  /// Full E.164 phone number of the employee for Firebase Phone Authentication.
  final String? phone;

  const OtpScreen({
    super.key,
    this.nationalId,
    this.devCode,
    this.maskedPhone,
    this.phone,
  });

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  static const _codeLength = 6;
  static const _resendSeconds = 30;

  final TextEditingController _codeController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  Timer? _timer;
  int _remaining = _resendSeconds;
  bool _verifying = false;
  bool _wrongCode = false;
  String? _lockedMessage;
  String? _firebaseVerificationId;

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
    _startTimer();
    _startFirebasePhoneAuth();
  }

  void _startFirebasePhoneAuth({int? forceResendingToken}) {
    final phone = widget.phone;
    if (phone == null || phone.trim().isEmpty) return;
    PhoneAuthService.instance.verifyPhoneNumber(
      phoneNumber: phone,
      forceResendingToken: forceResendingToken,
      onCodeSent: (verificationId, resendToken) {
        if (!mounted) return;
        setState(() {
          _firebaseVerificationId = verificationId;
        });
      },
      onAutoVerified: (idToken) async {
        if (!mounted) return;
        await _verifyWithFirebaseToken(idToken);
      },
      onFailed: (error) {
        debugPrint('OtpScreen: Firebase Phone Auth notice: $error');
      },
    );
  }

  Future<void> _verifyWithFirebaseToken(String idToken) async {
    final String? nid = widget.nationalId;
    if (nid == null || nid.isEmpty || _verifying) return;
    setState(() {
      _verifying = true;
      _wrongCode = false;
      _lockedMessage = null;
    });
    final result = await Backend.instance.verifyOtp(
      nid,
      'firebase_auto',
      firebaseIdToken: idToken,
    );
    if (!mounted) return;
    if (result == AuthResult.success) {
      await AppNavigation.toProfileConfirmation(context);
      setState(() => _verifying = false);
    } else {
      setState(() => _verifying = false);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _codeController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _remaining = _resendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remaining > 0) {
        setState(() => _remaining--);
      } else {
        timer.cancel();
      }
    });
  }

  void _onCodeChanged(String code) {
    setState(() {});
    if (code.length == _codeLength && !_verifying) {
      _verify(code);
    }
  }

  Future<void> _verify(String code) async {
    setState(() {
      _verifying = true;
      _wrongCode = false;
      _lockedMessage = null;
    });
    final String? nid = widget.nationalId;
    if (nid == null || nid.isEmpty) {
      if (!mounted) return;
      setState(() => _verifying = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocale.instance.isArabic
                ? 'رقم الهوية الوطنية غير متوفر، يرجى إعادة المحاولة'
                : 'National ID is missing, please try again.',
          ),
          backgroundColor: AppColors.announcementHeader,
        ),
      );
      return;
    }

    // Attempt Firebase SMS Code confirmation if verificationId is active
    String? firebaseIdToken;
    if (_firebaseVerificationId != null) {
      try {
        firebaseIdToken = await PhoneAuthService.instance.verifySmsCode(
          code,
          verificationId: _firebaseVerificationId,
        );
      } catch (e) {
        debugPrint('OtpScreen: Firebase SMS verification notice: $e');
      }
    }

    final result = await Backend.instance.verifyOtp(
      nid,
      code,
      firebaseIdToken: firebaseIdToken,
    );
    if (!mounted) return;
    if (result == AuthResult.locked) {
      // The server does not tell us the remaining window — assume the full
      // cool-down and clear the input.
      setState(() {
        _verifying = false;
        _lockedMessage = AppLocale.trLocked(15);
        _codeController.clear();
      });
      _focusNode.requestFocus();
      return;
    }
    if (result == AuthResult.networkError) {
      setState(() => _verifying = false);
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocale.instance.isArabic
                ? 'تعذر الاتصال بالخادم، يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً'
                : 'Unable to connect to server. Please check your internet connection and try again.',
          ),
          backgroundColor: AppColors.announcementHeader,
          duration: const Duration(seconds: 4),
        ),
      );
      _focusNode.requestFocus();
      return;
    }
    final ok = result == AuthResult.success;
    if (ok) {
      await AppNavigation.toProfileConfirmation(context);
      setState(() => _verifying = false);
    } else {
      setState(() {
        _wrongCode = true;
        _verifying = false;
        _codeController.clear();
      });
      _focusNode.requestFocus();
    }
  }

  Future<void> _resendCode() async {
    _codeController.clear();
    setState(() {});
    _focusNode.requestFocus();
    _startTimer();
    final messenger = ScaffoldMessenger.of(context);
    if (widget.nationalId != null) {
      await Backend.instance.requestOtp(widget.nationalId!);
      if (!mounted) return;
    }
    if (widget.phone != null && widget.phone!.trim().isNotEmpty) {
      _startFirebasePhoneAuth(
        forceResendingToken: PhoneAuthService.instance.resendToken,
      );
    }
    messenger.showSnackBar(
      SnackBar(content: Text(AppLocale.tr('auth_code_resent'))),
    );
  }

  void _showHelpDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppLocale.tr('help_title')),
        content: Text(AppLocale.tr('auth_otp_help_body')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(AppLocale.tr('common_ok')),
          ),
        ],
      ),
    );
  }

  String get _phoneHint {
    if (widget.maskedPhone != null && widget.maskedPhone!.trim().isNotEmpty) {
      return widget.maskedPhone!;
    }
    if (widget.nationalId != null &&
        widget.nationalId == LocalStore.instance.nationalId) {
      return LocalStore.instance.profile.maskedPhone;
    }
    return AppLocale.tr('auth_registered_phone');
  }

  @override
  Widget build(BuildContext context) {
    final code = _codeController.text;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
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
              // Progress Bar (Step 2)
              const AuthProgressBar(currentStep: 2),
              const SizedBox(height: 24),

              // Title & Subtitle
              Text(
                AppLocale.tr('auth_otp_title'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 8),
              Text(
                '${AppLocale.tr('auth_otp_sent_to')} $_phoneHint',
                style: AppTypography.dateSubtitle
                    .copyWith(fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 48),

              // 6 OTP Boxes (tapping focuses the hidden input below)
              GestureDetector(
                onTap: () => _focusNode.requestFocus(),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final boxWidth =
                        ((constraints.maxWidth - (_codeLength - 1) * 8) /
                                _codeLength)
                            .clamp(36.0, 48.0);
                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(_codeLength, (index) {
                        final isActive = index == code.length && !_verifying;
                        final digit = index < code.length ? code[index] : '';
                        return Container(
                          width: boxWidth,
                          height: 56,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF9FAFB),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isActive
                                  ? AppColors.primary
                                  : const Color(0xFFE5E7EB),
                              width: isActive ? 2 : 1,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: _verifying && index == 0
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: AppColors.primary,
                                  ),
                                )
                              : Text(
                                  digit,
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                        );
                      }),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),

              Center(
                child: Text(
                  _lockedMessage ??
                      (_wrongCode
                          ? AppLocale.tr('auth_wrong_code')
                          : AppLocale.tr('auth_auto_verify')),
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 13,
                    color: (_wrongCode || _lockedMessage != null)
                        ? AppColors.announcementHeader
                        : AppColors.textSecondary,
                  ),
                ),
              ),

              // Field that captures the keyboard input
              SizedBox(
                height: 0,
                child: Opacity(
                  opacity: 0,
                  child: TextField(
                    controller: _codeController,
                    focusNode: _focusNode,
                    autofocus: true,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      TextInputFormatter.withFunction((oldValue, newValue) {
                        final normalized =
                            EgyptianNationalIdValidator.normalizeDigits(
                                newValue.text);
                        return TextEditingValue(
                          text: normalized,
                          selection: TextSelection.collapsed(
                              offset: normalized.length),
                        );
                      }),
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(_codeLength),
                    ],
                    onChanged: _onCodeChanged,
                  ),
                ),
              ),

              const Spacer(),

              // Resend Timer / Resend action
              Center(
                child: _remaining > 0
                    ? Text(
                        '${AppLocale.tr('auth_resend_in')} 00:${_remaining.toString().padLeft(2, '0')}',
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      )
                    : TextButton(
                        onPressed: _resendCode,
                        child: Text(
                          AppLocale.tr('auth_resend_now'),
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
              ),
              const SizedBox(height: 16),

              // Help Link
              Center(
                child: TextButton(
                  onPressed: _showHelpDialog,
                  child: Text(
                    AppLocale.tr('auth_no_code_help'),
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
