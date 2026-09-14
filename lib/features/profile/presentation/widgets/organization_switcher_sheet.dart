import 'package:flutter/material.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/tenant/tenant_brand.dart';
import '../../../../core/tenant/tenant_brand_logo.dart';
import '../../../../core/tenant/tenant_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/app_typography.dart';

/// Modal bottom sheet allowing employees and admins to switch organizations dynamically
class OrganizationSwitcherSheet extends StatefulWidget {
  const OrganizationSwitcherSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const OrganizationSwitcherSheet(),
    );
  }

  @override
  State<OrganizationSwitcherSheet> createState() => _OrganizationSwitcherSheetState();
}

class _OrganizationSwitcherSheetState extends State<OrganizationSwitcherSheet> {
  final TextEditingController _codeController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _selectBrand(TenantBrand brand) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await TenantService.instance.applyTenantCode(brand.tenantId);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocale.instance.isArabic
                  ? 'تم التبديل بنجاح إلى: ${brand.companyNameAr}'
                  : 'Switched to: ${brand.companyName}',
            ),
            backgroundColor: brand.primaryColor,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _applyCustomCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final brand = await TenantService.instance.applyTenantCode(code);
      if (brand != null && mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocale.instance.isArabic
                  ? 'تم تفعيل هوية: ${brand.companyNameAr}'
                  : 'Activated identity: ${brand.companyName}',
            ),
            backgroundColor: brand.primaryColor,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      } else if (mounted) {
        setState(() {
          _errorMessage = AppLocale.instance.isArabic
              ? 'كود المؤسسة غير موجود أو غير صالح'
              : 'Invalid or unknown organization code';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    final currentBrand = AppTheme.currentBrand;

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        top: 20,
        left: 20,
        right: 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle Bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header Title
            Row(
              children: [
                TenantBrandLogo(
                  brand: currentBrand,
                  size: 38,
                  borderRadius: 10,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isAr ? 'المؤسسة وجهة العمل' : 'Organization & Workplace',
                        style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
                      ),
                      Text(
                        isAr
                            ? 'اختر جهة العمل أو أدخل كود المؤسسة'
                            : 'Select organization or enter enterprise code',
                        style: AppTypography.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Premier Presets List
            Text(
              isAr ? 'المؤسسات والشركات المعتمدة' : 'Verified Enterprise Clients',
              style: AppTypography.sectionHeading.copyWith(fontSize: 13),
            ),
            const SizedBox(height: 10),

            ...TenantService.builtInPresets.map((preset) {
              final isSelected = preset.tenantId == currentBrand.tenantId;

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? preset.primarySoftColor
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isSelected
                        ? preset.primaryColor
                        : const Color(0xFFE2E8F0),
                    width: isSelected ? 1.8 : 1.0,
                  ),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  leading: TenantBrandLogo(
                    brand: preset,
                    size: 36,
                    borderRadius: 8,
                  ),
                  title: Row(
                    children: [
                      Text(
                        preset.localizedCompanyName(isAr),
                        style: AppTypography.labelBold.copyWith(
                          fontSize: 14,
                          color: isSelected ? preset.primaryColor : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: preset.primaryColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                  subtitle: Text(
                    preset.corporateSubtitle,
                    style: AppTypography.bodySmall.copyWith(fontSize: 11),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: isSelected
                      ? Icon(Icons.check_circle_rounded, color: preset.primaryColor, size: 22)
                      : const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
                  onTap: _isLoading ? null : () => _selectBrand(preset),
                ),
              );
            }),

            const SizedBox(height: 16),
            const Divider(color: Color(0xFFF1F5F9)),
            const SizedBox(height: 12),

            // Custom Code Input Section
            Text(
              isAr ? 'كود مؤسسة مخصص' : 'Custom Organization Code',
              style: AppTypography.sectionHeading.copyWith(fontSize: 13),
            ),
            const SizedBox(height: 8),

            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _codeController,
                    decoration: InputDecoration(
                      hintText: isAr
                          ? 'أدخل كود الشركة (مثال: elsewedy, tmg)'
                          : 'Enter tenant slug / code',
                      hintStyle: AppTypography.bodySmall.copyWith(fontSize: 12),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      prefixIcon: const Icon(Icons.business_rounded, size: 20, color: Color(0xFF94A3B8)),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: currentBrand.primaryColor, width: 1.5),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _applyCustomCode,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: currentBrand.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                      elevation: 0,
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(
                            isAr ? 'تطبيق' : 'Apply',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ],
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                style: const TextStyle(color: AppColors.error, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
