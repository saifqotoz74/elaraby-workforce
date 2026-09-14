import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'tenant_brand.dart';

/// Universal enterprise brand logo widget.
/// Resolves local bundled assets, remote network URLs, or renders an
/// institutional typographic monogram shield fallback.
class TenantBrandLogo extends StatelessWidget {
  final TenantBrand? brand;
  final double size;
  final double borderRadius;
  final bool showBorder;
  final Color? borderColor;

  const TenantBrandLogo({
    super.key,
    this.brand,
    this.size = 40.0,
    this.borderRadius = 10.0,
    this.showBorder = true,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TenantBrand>(
      valueListenable: AppTheme.tenantBrandNotifier,
      builder: (context, activeBrand, _) {
        final current = brand ?? activeBrand;

        // 1. Check for local bundled asset (e.g. assets/images/elaraby_logo.png)
        if (current.localLogoAsset != null && current.localLogoAsset!.isNotEmpty) {
          return ClipRRect(
            borderRadius: BorderRadius.circular(borderRadius),
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(borderRadius),
                border: showBorder
                    ? Border.all(
                        color: borderColor ??
                            current.primaryColor.withValues(alpha: 0.2),
                        width: 1.2,
                      )
                    : null,
              ),
              child: Image.asset(
                current.localLogoAsset!,
                width: size,
                height: size,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => _buildMonogramShield(current),
              ),
            ),
          );
        }

        // 2. Check for remote logo URL
        if (current.logoUrl != null && current.logoUrl!.isNotEmpty) {
          return ClipRRect(
            borderRadius: BorderRadius.circular(borderRadius),
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(borderRadius),
                border: showBorder
                    ? Border.all(
                        color: borderColor ??
                            current.primaryColor.withValues(alpha: 0.2),
                        width: 1.2,
                      )
                    : null,
              ),
              child: Image.network(
                current.logoUrl!,
                width: size,
                height: size,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => _buildMonogramShield(current),
              ),
            ),
          );
        }

        // 3. Fallback: Typographic Corporate Monogram Shield
        return _buildMonogramShield(current);
      },
    );
  }

  Widget _buildMonogramShield(TenantBrand current) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            current.primaryColor,
            current.primaryLightColor,
          ],
        ),
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: current.primaryColor.withValues(alpha: 0.3),
            blurRadius: size * 0.2,
            offset: Offset(0, size * 0.08),
          ),
        ],
        border: showBorder
            ? Border.all(
                color: Colors.white.withValues(alpha: 0.3),
                width: 1.2,
              )
            : null,
      ),
      child: Center(
        child: Text(
          current.initials,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w900,
            fontSize: size * 0.42,
            letterSpacing: 0.8,
            fontFamily: 'Inter',
          ),
        ),
      ),
    );
  }
}
