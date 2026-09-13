import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/tenant/identity_strategy.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/utils/national_id_validator.dart';
import '../widgets/auth_progress_bar.dart';
import '../../../../core/navigation/app_navigation.dart';

class NationalIdScreen extends StatefulWidget {
  const NationalIdScreen({super.key});

  @override
  State<NationalIdScreen> createState() => _NationalIdScreenState();
}

class _NationalIdScreenState extends State<NationalIdScreen> {
  final TextEditingController _idController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  IdentityStrategy get _strategy =>
      IdentityStrategy.fromString(LocalStore.instance.identityMode);

  bool get _isValid => _strategy.validate(_idController.text);

  bool _requesting = false;

  Future<void> _continue() async {
    _focusNode.unfocus();
    final nationalId = _idController.text;
    setState(() => _requesting = true);
    final otpRes = await Backend.instance.requestOtp(nationalId);
    if (!mounted) return;
    setState(() => _requesting = false);

    if (!otpRes.found) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocale.tr('auth_id_not_found')),
          backgroundColor: AppColors.announcementHeader,
          duration: const Duration(seconds: 4),
        ),
      );
      return;
    }

    await AppNavigation.toOtp(
      context,
      nationalId: nationalId,
      devCode: otpRes.devCode,
      maskedPhone: otpRes.maskedPhone,
      phone: otpRes.phone,
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

  Widget _buildSlottedInput(IdentityStrategy strategy, String text, bool isAr) {
    final length = strategy.exactLength!;
    final slotWidth = length == 10 ? 24.0 : 18.0;

    return GestureDetector(
      onTap: () => _focusNode.requestFocus(),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(length, (index) {
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
                    width: slotWidth,
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
            '${text.length} ${AppLocale.tr('auth_of')} $length',
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          if (text.length == length && !_isValid) ...[
            const SizedBox(height: 8),
            Text(
              strategy.id == 'gulf_iqama'
                  ? (isAr
                      ? 'رقم الإقامة غير صحيح، يجب أن يتكون من 10 أرقام تبدأ بـ 1 أو 2'
                      : 'Invalid Iqama ID. Must be 10 digits starting with 1 or 2')
                  : (isAr
                      ? 'الرقم القومي غير صحيح، يرجى مراجعة الأرقام'
                      : 'Invalid National ID format, please verify numbers'),
              style: AppTypography.fontBase.copyWith(
                fontSize: 12,
                color: AppColors.announcementButton,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFieldInput(IdentityStrategy strategy, String text, bool isAr) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF9FAFB),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _isValid
                  ? AppColors.primary
                  : (text.isNotEmpty && !_isValid
                      ? const Color(0xFFEF4444)
                      : const Color(0xFFE5E7EB)),
              width: 1.5,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            children: [
              Icon(
                Icons.badge_rounded,
                color: _isValid ? AppColors.primary : AppColors.textSecondary,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _idController,
                  focusNode: _focusNode,
                  autofocus: true,
                  textCapitalization: TextCapitalization.characters,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: AppColors.textPrimary,
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    hintText: strategy.hintText,
                    hintStyle: AppTypography.fontBase.copyWith(
                      color: AppColors.textMuted,
                      fontSize: 16,
                      letterSpacing: 1.0,
                    ),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              if (_isValid)
                const Icon(Icons.check_circle_rounded,
                    color: Color(0xFF10B981), size: 20),
            ],
          ),
        ),
        if (text.isNotEmpty && !_isValid) ...[
          const SizedBox(height: 8),
          Text(
            isAr
                ? 'كود الموظف غير صحيح، يرجى إدخال كود صالح'
                : 'Invalid employee code, please enter a valid ID',
            style: AppTypography.fontBase.copyWith(
              fontSize: 12,
              color: AppColors.announcementButton,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final strategy = _strategy;
    final text = _idController.text;
    final isValid = _isValid;
    final isAr = AppLocale.instance.isArabic;
    final title = strategy.id == 'egyptian_national_id'
        ? AppLocale.tr('auth_national_id_title')
        : (isAr ? strategy.labelAr : strategy.labelEn);
    final subtitle = strategy.id == 'gulf_iqama'
        ? (isAr
            ? 'أدخل رقم الهوية الوطنية أو الإقامة للمتابعة'
            : 'Enter your National or Resident ID to continue')
        : (strategy.id == 'employee_code'
            ? (isAr
                ? 'أدخل كود الموظف الخاص بك للمتابعة'
                : 'Enter your official employee ID code to continue')
            : AppLocale.tr('auth_national_id_subtitle'));

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
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
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
                          title,
                          style: AppTypography.welcomeTitle.copyWith(fontSize: 22),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          subtitle,
                          style: AppTypography.dateSubtitle
                              .copyWith(fontSize: 14, height: 1.4),
                        ),
                        const SizedBox(height: 48),

                        // Input Section
                        if (strategy.exactLength != null) ...[
                          _buildSlottedInput(strategy, text, isAr),
                          // Hidden field that captures keyboard input for slotted display
                          SizedBox(
                            width: 1,
                            height: 1,
                            child: Opacity(
                              opacity: 0.01,
                              child: TextField(
                                controller: _idController,
                                focusNode: _focusNode,
                                autofocus: true,
                                keyboardType: strategy.isNumericOnly
                                    ? TextInputType.number
                                    : TextInputType.text,
                                inputFormatters: [
                                  if (strategy.isNumericOnly) ...[
                                    TextInputFormatter.withFunction(
                                        (oldValue, newValue) {
                                      final normalized =
                                          EgyptianNationalIdValidator
                                              .normalizeDigits(newValue.text);
                                      return TextEditingValue(
                                        text: normalized,
                                        selection: TextSelection.collapsed(
                                            offset: normalized.length),
                                      );
                                    }),
                                    FilteringTextInputFormatter.digitsOnly,
                                  ],
                                  LengthLimitingTextInputFormatter(
                                      strategy.maxLength),
                                ],
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                          ),
                        ] else ...[
                          _buildFieldInput(strategy, text, isAr),
                        ],

                        const Spacer(),

                        // Continue Button
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed:
                                isValid && !_requesting ? _continue : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              disabledBackgroundColor:
                                  AppColors.primary.withValues(alpha: 0.35),
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
                          style:
                              AppTypography.buttonText.copyWith(fontSize: 15),
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
    ),
  );
},
        ),
      ),
    );
  }
}
