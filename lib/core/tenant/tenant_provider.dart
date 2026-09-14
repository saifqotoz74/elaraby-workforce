import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/local_store.dart';
import 'identity_strategy.dart';
import 'tenant_brand.dart';
import 'tenant_features.dart';
import '../theme/app_theme.dart';

/// StateNotifier that manages the active tenant branding dynamically.
class TenantBrandNotifier extends StateNotifier<TenantBrand> {
  TenantBrandNotifier() : super(AppTheme.currentBrand) {
    AppTheme.tenantBrandNotifier.addListener(_onBrandChanged);
  }

  void _onBrandChanged() {
    if (state != AppTheme.tenantBrandNotifier.value) {
      state = AppTheme.tenantBrandNotifier.value;
    }
  }

  @override
  void dispose() {
    AppTheme.tenantBrandNotifier.removeListener(_onBrandChanged);
    super.dispose();
  }

  /// Updates the active brand and persists it locally for offline durability
  Future<void> updateBrand(TenantBrand brand) async {
    state = brand;
    AppTheme.setTenantBrand(brand);
    try {
      await LocalStore.instance.setActiveTenantBrandJson(jsonEncode(brand.toJson()));
      await LocalStore.instance.setActiveTenantSlug(brand.tenantId);
    } catch (_) {}
  }

  /// Resets to default neutral branding
  Future<void> resetToDefault() async {
    final defaultBrand = TenantBrand.prConnectDefault();
    state = defaultBrand;
    AppTheme.setTenantBrand(defaultBrand);
    await LocalStore.instance.setActiveTenantBrandJson(null);
    await LocalStore.instance.setActiveTenantSlug('generic');
  }

  /// Handles an incoming real-time broadcast from the Brand Studio (WebSocket / Push)
  Future<bool> handleRemoteBroadcast(Map<String, dynamic> data) async {
    final incomingId = (data['tenantId'] ?? data['slug'] ?? '').toString().toLowerCase();
    if (incomingId.isEmpty || (incomingId != state.tenantId && incomingId != state.tenantId.toLowerCase())) {
      return false; // Not targeted to current tenant
    }

    if (data['brand'] != null && data['brand'] is Map<String, dynamic>) {
      final updatedBrand = TenantBrand.fromJson(data['brand'] as Map<String, dynamic>);
      await updateBrand(updatedBrand);
      return true;
    }
    return false;
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

  /// Handles incoming real-time feature flag broadcast from Brand Studio
  Future<bool> handleRemoteBroadcast(Map<String, dynamic> data) async {
    if (data['features'] != null && data['features'] is Map<String, dynamic>) {
      final updated = TenantFeatures.fromJson(data['features'] as Map<String, dynamic>);
      await updateFeatures(updated);
      return true;
    }
    return false;
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
