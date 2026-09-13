import 'package:flutter/material.dart';
import '../tenant/tenant_brand.dart';
import '../tenant/tenant_features.dart';
import 'app_theme.dart';

/// Material 3 ThemeExtension for active Tenant Branding and Feature matrix.
class TenantThemeExtension extends ThemeExtension<TenantThemeExtension> {
  final TenantBrand brand;
  final TenantFeatures features;

  const TenantThemeExtension({
    required this.brand,
    required this.features,
  });

  @override
  TenantThemeExtension copyWith({
    TenantBrand? brand,
    TenantFeatures? features,
  }) {
    return TenantThemeExtension(
      brand: brand ?? this.brand,
      features: features ?? this.features,
    );
  }

  @override
  TenantThemeExtension lerp(
      ThemeExtension<TenantThemeExtension>? other, double t) {
    if (other is! TenantThemeExtension) return this;
    return TenantThemeExtension(
      brand: t < 0.5 ? brand : other.brand,
      features: t < 0.5 ? features : other.features,
    );
  }
}

/// Ergonomic BuildContext extensions to access tenant properties seamlessly.
extension TenantThemeContext on BuildContext {
  TenantBrand get tenantBrand =>
      Theme.of(this).extension<TenantThemeExtension>()?.brand ??
      AppTheme.currentBrand;

  TenantFeatures get tenantFeatures =>
      Theme.of(this).extension<TenantThemeExtension>()?.features ??
      TenantFeatures.allEnabled();
}
