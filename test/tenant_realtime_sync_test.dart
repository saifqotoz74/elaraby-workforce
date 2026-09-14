import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/core/tenant/tenant_brand.dart';
import 'package:elaraby_workforce/core/tenant/tenant_provider.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await LocalStore.instance.setActiveTenantBrandJson(null);
    await LocalStore.instance.setActiveTenantFeaturesJson(null);
    await LocalStore.instance.setActiveTenantSlug('elaraby');
    AppTheme.setTenantBrand(TenantBrand.elarabyDefault());
  });

  group('Tenant Realtime Broadcast Synchronization Tests', () {
    test('TenantBrandNotifier handles remote broadcast for matching active tenant', () async {
      final notifier = TenantBrandNotifier();
      expect(notifier.state.tenantId, 'elaraby');

      final broadcastPayload = {
        'tenantId': 'elaraby',
        'slug': 'elaraby',
        'brand': {
          'tenantId': 'elaraby',
          'companyName': 'Elaraby Group Global',
          'companyNameAr': 'مجموعة العربي العالمية',
          'primaryColor': '#0284C7',
          'primaryLightColor': '#38BDF8',
          'primarySoftColor': '#E0F2FE',
          'supportHotline': '19319',
          'crNumber': 'EG-999111',
          'taxNumber': 'EG-999-111-222',
          'corporateSubtitle': 'Global Electronics & Appliances',
          'currency': 'EGP',
        },
      };

      final handled = await notifier.handleRemoteBroadcast(broadcastPayload);
      expect(handled, isTrue);

      // Verify state was updated
      expect(notifier.state.companyName, 'Elaraby Group Global');
      expect(notifier.state.primaryColor, const Color(0xFF0284C7));
      expect(notifier.state.crNumber, 'EG-999111');

      // Verify dynamic AppTheme was updated on the fly
      expect(AppTheme.currentBrand.companyName, 'Elaraby Group Global');
      expect(AppTheme.currentBrand.primaryColor, const Color(0xFF0284C7));

      // Verify LocalStore cached the update
      final cachedJson = LocalStore.instance.activeTenantBrandJson;
      expect(cachedJson, isNotNull);
      final parsed = jsonDecode(cachedJson!) as Map<String, dynamic>;
      expect(parsed['companyName'], 'Elaraby Group Global');
    });

    test('TenantBrandNotifier rejects remote broadcast targeted to a different tenant', () async {
      final notifier = TenantBrandNotifier();
      expect(notifier.state.tenantId, 'elaraby');

      final broadcastPayload = {
        'tenantId': 'elsewedy',
        'slug': 'elsewedy',
        'brand': {
          'tenantId': 'elsewedy',
          'companyName': 'Elsewedy Electric',
          'primaryColor': '#C8102E',
        },
      };

      final handled = await notifier.handleRemoteBroadcast(broadcastPayload);
      expect(handled, isFalse);

      // Verify state was NOT modified
      expect(notifier.state.tenantId, 'elaraby');
      expect(notifier.state.primaryColor, const Color(0xFF0B63B4));
    });

    test('TenantFeaturesNotifier handles remote feature toggle broadcast', () async {
      final featuresNotifier = TenantFeaturesNotifier();
      expect(featuresNotifier.state.hasSummerTrips, isTrue);

      final broadcastPayload = {
        'tenantId': 'elaraby',
        'features': {
          'hasPayroll': true,
          'hasBuses': true,
          'hasSummerTrips': false, // Toggled off in admin studio
          'hasWhistleblower': true,
        },
      };

      final handled = await featuresNotifier.handleRemoteBroadcast(broadcastPayload);
      expect(handled, isTrue);
      expect(featuresNotifier.state.hasSummerTrips, isFalse);
      expect(featuresNotifier.state.hasBuses, isTrue);
    });
  });
}
