import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/tenant/tenant_brand.dart';
import '../../../../core/tenant/tenant_provider.dart';
import '../../../../core/tenant/tenant_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/tenant_theme_extension.dart';

class CompanyCodeModal extends ConsumerStatefulWidget {
  const CompanyCodeModal({super.key});

  static Future<TenantBrand?> show(BuildContext context) {
    return showModalBottomSheet<TenantBrand>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const CompanyCodeModal(),
    );
  }

  @override
  ConsumerState<CompanyCodeModal> createState() => _CompanyCodeModalState();
}

class _CompanyCodeModalState extends ConsumerState<CompanyCodeModal> {
  final TextEditingController _codeController = TextEditingController();
  bool _loading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submit(String code) async {
    final clean = code.trim();
    if (clean.isEmpty) return;

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    final brand = await TenantService.instance.applyTenantCode(clean);

    if (!mounted) return;
    setState(() => _loading = false);

    if (brand != null) {
      await ref.read(tenantBrandProvider.notifier).updateBrand(brand);
      if (!mounted) return;
      Navigator.of(context).pop(brand);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            AppLocale.instance.isArabic
                ? 'تم تغيير المؤسسة إلى: ${brand.companyNameAr}'
                : 'Switched organization to: ${brand.companyName}',
          ),
          backgroundColor: brand.primaryColor,
          duration: const Duration(seconds: 3),
        ),
      );
    } else {
      setState(() {
        _errorMessage = AppLocale.instance.isArabic
            ? 'كود الشركة غير مسجل. يرجى التحقق وإعادة المحاولة.'
            : 'Unrecognized organization code. Please check and try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    final currentBrand = context.tenantBrand;
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottomPadding + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Modal Title
          Text(
            isAr ? 'تحديد كود المؤسسة / الشركة' : 'Set Organization Code',
            style: AppTypography.fontBase.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isAr
                ? 'أدخل الكود المعتمد لمصنعك أو شركتك لتحميل الهوية المخصصة'
                : 'Enter your company or factory code to load customized branding and tools',
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),

          // Code Input Field
          TextField(
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            decoration: InputDecoration(
              hintText: isAr ? 'مثال: ELARABY, ELSEWEDY' : 'e.g. ELARABY, ELSEWEDY',
              prefixIcon: const Icon(Icons.business_rounded, color: Color(0xFF9CA3AF)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: currentBrand.primaryColor, width: 1.5),
              ),
            ),
            onSubmitted: (val) => _submit(val),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(
              _errorMessage!,
              style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12),
            ),
          ],
          const SizedBox(height: 16),

          // Apply Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _loading ? null : () => _submit(_codeController.text),
              style: ElevatedButton.styleFrom(
                backgroundColor: currentBrand.primaryColor,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : Text(
                      isAr ? 'تطبيق والتحويل' : 'Apply Organization',
                      style: AppTypography.buttonText.copyWith(fontSize: 15),
                    ),
            ),
          ),
          const SizedBox(height: 20),

          // Presets Divider
          Row(
            children: [
              const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Text(
                  isAr ? 'أو اختر من المنظمات المتاحة' : 'Or choose from presets',
                  style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                ),
              ),
              const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
            ],
          ),
          const SizedBox(height: 14),

          // Quick Preset Chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: TenantService.builtInPresets.map((preset) {
              final isCurrent = preset.tenantId == currentBrand.tenantId;
              return InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => _submit(preset.tenantId),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isCurrent ? preset.primarySoftColor : const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isCurrent ? preset.primaryColor : const Color(0xFFE5E7EB),
                      width: isCurrent ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: preset.primaryColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isAr ? preset.companyNameAr : preset.companyName,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                          color: isCurrent ? preset.primaryColor : const Color(0xFF374151),
                        ),
                      ),
                      if (isCurrent) ...[
                        const SizedBox(width: 4),
                        Icon(Icons.check_rounded, size: 14, color: preset.primaryColor),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
