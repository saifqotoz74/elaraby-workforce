import 'dart:convert';
import 'package:flutter/material.dart';
import '../network/api_client.dart';
import '../storage/local_store.dart';
import '../theme/app_theme.dart';
import 'tenant_brand.dart';
import 'tenant_features.dart';

/// Service responsible for remote and local tenant discovery and switching.
class TenantService {
  static final TenantService instance = TenantService._();
  TenantService._();

  /// Built-in enterprise presets available immediately offline
  static final List<TenantBrand> builtInPresets = [
    TenantBrand.elarabyDefault(),
    const TenantBrand(
      tenantId: 'elsewedy',
      companyName: 'Elsewedy Electric',
      companyNameAr: 'السويدي إليكتريك',
      primaryColor: Color(0xFFC8102E),
      primaryLightColor: Color(0xFFE02B47),
      primarySoftColor: Color(0xFFFCECEF),
      scaffoldBgColor: Color(0xFFF8F9FA),
      surfaceColor: Colors.white,
      supportHotline: '16244',
    ),
    const TenantBrand(
      tenantId: 'gulf_industrial',
      companyName: 'Gulf Industrial Corp',
      companyNameAr: 'الخليج للصناعات',
      primaryColor: Color(0xFF059669),
      primaryLightColor: Color(0xFF10B981),
      primarySoftColor: Color(0xFFECFDF5),
      scaffoldBgColor: Color(0xFFF3F4F6),
      surfaceColor: Colors.white,
      supportHotline: '80012345',
    ),
  ];

  /// Resolves an organization code, fetches remote config if available, or applies offline preset.
  Future<TenantBrand?> applyTenantCode(String rawCode) async {
    final clean = rawCode.trim().toLowerCase().replaceAll(RegExp(r'\s+'), '_');
    if (clean.isEmpty) return null;

    // 1. Check if matching a local built-in preset
    TenantBrand? brand;
    for (final preset in builtInPresets) {
      if (preset.tenantId == clean ||
          preset.tenantId.contains(clean) ||
          preset.companyName.toLowerCase().contains(clean) ||
          preset.companyNameAr.contains(clean)) {
        brand = preset;
        break;
      }
    }

    TenantFeatures features = TenantFeatures.allEnabled();
    String? identityMode;

    // 2. Attempt remote fetch if network is available
    try {
      final res = await ApiClient.instance.request('GET', '/tenant/config?slug=$clean');
      if (res.isSuccess && res.data != null && res.data!['tenant'] != null) {
        final tenantMap = res.data!['tenant'] as Map<String, dynamic>;
        brand = TenantBrand(
          tenantId: tenantMap['id'] as String? ?? clean,
          companyName: tenantMap['name'] as String? ?? (brand?.companyName ?? clean),
          companyNameAr: tenantMap['nameAr'] as String? ?? (brand?.companyNameAr ?? clean),
          primaryColor: TenantBrand.fromJson(tenantMap['brand'] ?? {}).primaryColor,
          primaryLightColor: TenantBrand.fromJson(tenantMap['brand'] ?? {}).primaryLightColor,
          primarySoftColor: TenantBrand.fromJson(tenantMap['brand'] ?? {}).primarySoftColor,
          supportHotline: tenantMap['brand']?['supportHotline'] as String? ?? '19319',
        );
        if (tenantMap['features'] != null) {
          features = TenantFeatures.fromJson(tenantMap['features'] as Map<String, dynamic>);
        }
        identityMode = tenantMap['authMode'] as String?;
      }
    } catch (_) {
      // Network failure: retain local preset match
    }

    if (brand == null) {
      return null;
    }

    // 3. Persist locally for offline persistence
    await LocalStore.instance.setActiveTenantSlug(brand.tenantId);
    await LocalStore.instance.setActiveTenantBrandJson(jsonEncode(brand.toJson()));
    await LocalStore.instance.setActiveTenantFeaturesJson(jsonEncode(features.toJson()));
    if (identityMode != null) {
      await LocalStore.instance.setActiveIdentityMode(identityMode);
    }

    // 4. Update dynamic runtime theme
    AppTheme.setTenantBrand(brand);

    return brand;
  }
}
