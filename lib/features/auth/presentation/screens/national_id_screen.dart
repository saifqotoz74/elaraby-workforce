import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../widgets/auth_progress_bar.dart';
import 'otp_screen.dart';

class NationalIdScreen extends StatefulWidget {
  const NationalIdScreen({super.key});

  @override
  State<NationalIdScreen> createState() => _NationalIdScreenState();
}

class _NationalIdScreenState extends State<NationalIdScreen> {
  final TextEditingController _idController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  bool get _isValid => RegExp(r'^\d{14}$').hasMatch(_idController.text);

  bool _requesting = false;

  Future<void> _continue() async {
    _focusNode.unfocus();
    final nationalId = _idController.text;
    setState(() => _requesting = true);
    // Server sends the OTP (dev mode also returns the code for testing).
    // Offline -> push straight through so the flow never blocks.
    final devCode = await Backend.instance.requestOtp(nationalId);
    if (!mounted) return;
    setState(() => _requesting = false);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OtpScreen(nationalId: nationalId, devCode: devCode),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _idController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _showHelpDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppLocale.tr('help_title')),
        content: Text(AppLocale.tr('auth_id_help_body')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(AppLocale.tr('common_ok')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = _idController.text;
    final isValid = _isValid;

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
              // Progress Bar (Step 1)
              const AuthProgressBar(currentStep: 1),
              const SizedBox(height: 24),

              // Title & Subtitle
              Text(
                AppLocale.tr('auth_national_id_title'),
                style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
              ),
              const SizedBox(height: 8),
              Text(
                AppLocale.tr('auth_national_id_subtitle'),
                style: AppTypography.dateSubtitle.copyWith(fontSize: 14, height: 1.4),
              ),
              const SizedBox(height: 48),

              // 14-Digit Display (tapping focuses the hidden input below)
              GestureDetector(
                onTap: () => _focusNode.requestFocus(),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(14, (index) {
                        final hasChar = index < text.length;
                        final char = hasChar ? text[index] : '';

                        return Column(
                          children: [
                            SizedBox(
                              height: 28,
                              child: Text(
                                char,
                                style: AppTypography.fontBase.copyWith(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              width: 18,
                              height: 3,
                              decoration: BoxDecoration(
                                color: hasChar
                                    ? AppColors.primary
                                    : (index == text.length
                                        ? AppColors.primaryLight
                                        : const Color(0xFFE5EBF2)),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ],
                        );
                      }),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${text.length} ${AppLocale.tr('auth_of')} 14',
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),

              // Hidden field that actually captures the keyboard input
              SizedBox(
                height: 0,
                child: Opacity(
                  opacity: 0,
                  child: TextField(
                    controller: _idController,
                    focusNode: _focusNode,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(14),
                    ],
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ),

              const Spacer(),

              // Continue Button (enabled only with a valid 14-digit ID)
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: isValid && !_requesting ? _continue : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.35),
                    foregroundColor: Colors.white,
                    disabledForegroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _requesting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          AppLocale.tr('auth_continue'),
                          style: AppTypography.buttonText.copyWith(fontSize: 15),
                        ),
                ),
              ),
              const SizedBox(height: 16),

              // Help Link
              Center(
                child: TextButton(
                  onPressed: _showHelpDialog,
                  child: Text(
                    AppLocale.tr('auth_get_help_id'),
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
