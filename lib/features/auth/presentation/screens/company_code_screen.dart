import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/navigation/app_navigation.dart';
import '../../../../core/state/ui_state.dart';
import '../../../../core/tenant/tenant_brand.dart';
import '../../../../core/tenant/tenant_brand_logo.dart';
import '../../../../core/tenant/tenant_provider.dart';
import '../../../../core/tenant/tenant_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/tenant_theme_extension.dart';

/// Riverpod StateNotifier managing the company code resolution lifecycle
class CompanyCodeNotifier extends StateNotifier<UiState<TenantBrand>> {
  CompanyCodeNotifier() : super(const UiState.empty());

  Future<TenantBrand?> applyCode(String rawCode) async {
    final clean = rawCode.trim().toUpperCase();
    if (clean.isEmpty) {
      state = const UiState.empty();
      return null;
    }

    state = const UiState.loading();
    try {
      final brand = await TenantService.instance.applyTenantCode(clean);
      if (brand != null) {
        state = UiState.success(brand);
        return brand;
      } else {
        state = const UiState.error('unrecognized_code');
        return null;
      }
    } catch (e) {
      final errStr = e.toString().toLowerCase();
      if (errStr.contains('offline') || errStr.contains('socket') || errStr.contains('network')) {
        state = UiState.offline(TenantBrand.prConnectDefault());
      } else {
        state = UiState.error(e.toString());
      }
      return null;
    }
  }

  void setOffline() {
    state = UiState.offline(TenantBrand.prConnectDefault());
  }

  void setRefreshing(TenantBrand brand) {
    state = UiState.refreshing(brand);
  }

  void reset() {
    state = const UiState.empty();
  }
}

final companyCodeProvider =
    StateNotifierProvider<CompanyCodeNotifier, UiState<TenantBrand>>((ref) {
  return CompanyCodeNotifier();
});

class CompanyCodeScreen extends ConsumerStatefulWidget {
  const CompanyCodeScreen({super.key});

  @override
  ConsumerState<CompanyCodeScreen> createState() => _CompanyCodeScreenState();
}

class _CompanyCodeScreenState extends ConsumerState<CompanyCodeScreen> {
  final TextEditingController _codeController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  TenantBrand? _resolvedBrand;
  bool _isTransitioning = false;
  Timer? _transitionTimer;

  static const List<Map<String, String>> presets = [
    {
      'code': 'ELARABY',
      'nameAr': 'مجموعة العربي',
      'nameEn': 'Elaraby Group',
      'color': '#0B63B4',
    },
    {
      'code': 'ELSEWEDY',
      'nameAr': 'السويدي إليكتريك',
      'nameEn': 'Elsewedy Electric',
      'color': '#C8102E',
    },
    {
      'code': 'GHABBOUR',
      'nameAr': 'جي بي كورب (غبور)',
      'nameEn': 'GB Corp (Ghabbour)',
      'color': '#1E3A8A',
    },
    {
      'code': 'GULF',
      'nameAr': 'الخليج للصناعات',
      'nameEn': 'Gulf Industrial',
      'color': '#059669',
    },
  ];

  @override
  void dispose() {
    _codeController.dispose();
    _focusNode.dispose();
    _transitionTimer?.cancel();
    super.dispose();
  }

  Future<void> _handleSubmit(String code) async {
    _focusNode.unfocus();
    final clean = code.trim().toUpperCase();
    if (clean.isEmpty) return;

    final brand = await ref.read(companyCodeProvider.notifier).applyCode(clean);
    if (!mounted) return;

    if (brand != null) {
      await ref.read(tenantBrandProvider.notifier).updateBrand(brand);
      setState(() {
        _resolvedBrand = brand;
        _isTransitioning = true;
      });

      _transitionTimer = Timer(const Duration(milliseconds: 1500), () {
        if (mounted) {
          AppNavigation.toGetStarted(context);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final uiState = ref.watch(companyCodeProvider);
    final isAr = AppLocale.instance.isArabic;
    final currentBrand = context.tenantBrand;

    // 1. If actively in smooth 1.5s transition to newly resolved tenant brand
    if (_isTransitioning && _resolvedBrand != null) {
      final brand = _resolvedBrand!;
      return Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TenantBrandLogo(
                    brand: brand,
                    size: 96,
                    borderRadius: 24,
                  ),
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: brand.primarySoftColor,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_rounded, size: 16, color: brand.primaryColor),
                        const SizedBox(width: 6),
                        Text(
                          isAr ? 'تم التحقق من المؤسسة بنجاح' : 'Organization Verified',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: brand.primaryColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    isAr
                        ? 'مرحباً بك في ${brand.companyNameAr}'
                        : 'Welcome to ${brand.companyName}',
                    style: AppTypography.welcomeTitle.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isAr
                        ? 'جاري تحميل الهوية المؤسسية والخدمات المخصصة...'
                        : 'Loading organizational workspace and custom services...',
                    style: AppTypography.dateSubtitle.copyWith(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 36),
                  SizedBox(
                    width: 32,
                    height: 32,
                    child: CircularProgressIndicator(
                      color: brand.primaryColor,
                      strokeWidth: 3,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // 2. Normal Company Code Entry Screen - Exhaustive 6-State Handling
    final bool isLoading = uiState.isLoading || uiState.isRefreshing;
    final bool hasError = uiState.isError;
    final bool isOffline = uiState.isOffline;
    final String? errorMessage = hasError
        ? (isAr
            ? 'كود المؤسسة غير مسجل. يرجى التحقق وإعادة المحاولة.'
            : 'Unrecognized organization code. Please verify and try again.')
        : null;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          TextButton.icon(
            onPressed: () {
              AppLocale.instance.setLocale(
                isAr ? const Locale('en') : const Locale('ar'),
              );
            },
            icon: const Icon(Icons.language_rounded, size: 18, color: AppColors.textSecondary),
            label: Text(
              isAr ? 'English' : 'عربي',
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 24),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header Badge & Monogram
                      Center(
                        child: Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: currentBrand.primarySoftColor,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: currentBrand.primaryColor.withValues(alpha: 0.15),
                              width: 1.5,
                            ),
                          ),
                          child: Icon(
                            Icons.domain_rounded,
                            size: 34,
                            color: currentBrand.primaryColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Title & Subtitle
                      Center(
                        child: Text(
                          isAr ? 'أدخل كود المؤسسة' : 'Enter Company Code',
                          style: AppTypography.welcomeTitle.copyWith(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          isAr
                              ? 'أدخل الكود المعتمد لمصنعك أو شركتك للوصول إلى بوابة العمل المخصصة'
                              : 'Enter your verified factory or company code to access your customized workforce portal',
                          style: AppTypography.dateSubtitle.copyWith(
                            fontSize: 13.5,
                            height: 1.45,
                            color: AppColors.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: 36),

                      // Offline State Notice Banner
                      if (isOffline) ...[
                        Container(
                          margin: const EdgeInsets.only(bottom: 20),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFFCD34D)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.wifi_off_rounded, size: 20, color: Color(0xFFB45309)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  isAr
                                      ? 'أنت غير متصل بالإنترنت. يمكنك اختيار شركتك من الرموز المتاحة محلياً أدناه.'
                                      : 'You are offline. You can select your company from the local presets below.',
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFB45309),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Code Input Field
                      Text(
                        isAr ? 'كود المؤسسة / Company Code' : 'Company Code / كود المؤسسة',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _codeController,
                        focusNode: _focusNode,
                        textCapitalization: TextCapitalization.characters,
                        autocorrect: false,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 2.0,
                          color: AppColors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          hintText: 'ELARABY, ELSEWEDY...',
                          hintStyle: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 1.0,
                            color: AppColors.textMuted.withValues(alpha: 0.8),
                          ),
                          prefixIcon: Icon(
                            Icons.badge_outlined,
                            color: currentBrand.primaryColor,
                          ),
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                          filled: true,
                          fillColor: const Color(0xFFF9FAFB),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: hasError ? const Color(0xFFEF4444) : const Color(0xFFE5E7EB),
                              width: hasError ? 1.5 : 1.0,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(
                              color: hasError ? const Color(0xFFEF4444) : currentBrand.primaryColor,
                              width: 1.8,
                            ),
                          ),
                        ),
                        onSubmitted: (val) => _handleSubmit(val),
                        onChanged: (_) {
                          if (uiState.isError) {
                            ref.read(companyCodeProvider.notifier).reset();
                          }
                          setState(() {});
                        },
                      ),
                      if (errorMessage != null) ...[
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.error_outline_rounded,
                                size: 16, color: Color(0xFFDC2626)),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                errorMessage,
                                style: const TextStyle(
                                  color: Color(0xFFDC2626),
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 20),

                      // Submit Button
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: isLoading || _codeController.text.trim().isEmpty
                              ? null
                              : () => _handleSubmit(_codeController.text),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: currentBrand.primaryColor,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor:
                                currentBrand.primaryColor.withValues(alpha: 0.35),
                            disabledForegroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(
                                  isAr ? 'تأكيد ومتابعة' : 'Confirm & Continue',
                                  style: AppTypography.buttonText.copyWith(fontSize: 15),
                                ),
                        ),
                      ),
                      const SizedBox(height: 36),

                      // Presets Header Divider
                      Row(
                        children: [
                          const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              isAr ? 'أو اختر كود شركتك مباشرة' : 'Or select your company',
                              style: const TextStyle(
                                color: Color(0xFF9CA3AF),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Preset Suggestion Chips
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: presets.map((p) {
                          final code = p['code']!;
                          final name = isAr ? p['nameAr']! : p['nameEn']!;
                          final chipColor = TenantBrand.elaraby().primaryColor;

                          return InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () {
                              _codeController.text = code;
                              _handleSubmit(code);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF9FAFB),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE5E7EB)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      color: chipColor,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    code,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.5,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    '($name)',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),

                      const Spacer(),
                      const SizedBox(height: 24),

                      // Platform Tag Footer
                      Center(
                        child: Text(
                          'Workforce OS • PR Connect Multi-Tenant Engine',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textMuted.withValues(alpha: 0.7),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
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
