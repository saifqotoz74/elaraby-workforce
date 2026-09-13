import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/local_store.dart';
import 'identity_strategy.dart';
import 'tenant_brand.dart';
import 'tenant_features.dart';

/// StateNotifier that manages the active tenant branding dynamically.
class TenantBrandNotifier extends StateNotifier<TenantBrand> {
  TenantBrandNotifier() : super(_loadInitial());

  static TenantBrand _loadInitial() {
    try {
      final raw = LocalStore.instance.activeTenantBrandJson;
      if (raw != null && raw.isNotEmpty) {
        final map = jsonDecode(raw) as Map<String, dynamic>;
        return TenantBrand.fromJson(map);
      }
    } catch (_) {
      // Graceful fallback to default
    }
    return TenantBrand.elarabyDefault();
  }

  /// Updates the active brand and persists it locally for offline durability
  Future<void> updateBrand(TenantBrand brand) async {
    state = brand;
    try {
      await LocalStore.instance.setActiveTenantBrandJson(jsonEncode(brand.toJson()));
      await LocalStore.instance.setActiveTenantSlug(brand.tenantId);
    } catch (_) {}
  }

  /// Resets to default Elaraby branding
  Future<void> resetToDefault() async {
    state = TenantBrand.elarabyDefault();
    await LocalStore.instance.setActiveTenantBrandJson(null);
    await LocalStore.instance.setActiveTenantSlug('elaraby');
  }
}

/// StateNotifier that manages the active tenant feature toggles.
class TenantFeaturesNotifier extends StateNotifier<TenantFeatures> {
  TenantFeaturesNotifier() : super(_loadInitial());

  static TenantFeatures _loadInitial() {
    try {
      final raw = LocalStore.instance.activeTenantFeaturesJson;
      if (raw != null && raw.isNotEmpty) {
        final map = jsonDecode(raw) as Map<String, dynamic>;
        return TenantFeatures.fromJson(map);
      }
    } catch (_) {
      // Graceful fallback to all enabled
    }
    return TenantFeatures.allEnabled();
  }

  /// Updates active feature flags and persists them locally
  Future<void> updateFeatures(TenantFeatures features) async {
    state = features;
    try {
      await LocalStore.instance.setActiveTenantFeaturesJson(jsonEncode(features.toJson()));
    } catch (_) {}
  }

  /// Resets to all features enabled
  Future<void> resetToDefault() async {
    state = TenantFeatures.allEnabled();
    await LocalStore.instance.setActiveTenantFeaturesJson(null);
  }
}

/// Global provider for the active tenant branding
final tenantBrandProvider =
    StateNotifierProvider<TenantBrandNotifier, TenantBrand>((ref) {
  return TenantBrandNotifier();
});

/// Global provider for the active tenant feature toggles
final tenantFeaturesProvider =
    StateNotifierProvider<TenantFeaturesNotifier, TenantFeatures>((ref) {
  return TenantFeaturesNotifier();
});

/// Global provider for the active identity validation strategy
final identityStrategyProvider = Provider<IdentityStrategy>((ref) {
  final mode = LocalStore.instance.activeIdentityMode;
  return IdentityStrategy.fromString(mode);
});
