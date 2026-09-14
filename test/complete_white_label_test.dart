import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/tenant/tenant_brand.dart';
import 'package:elaraby_workforce/core/tenant/tenant_brand_logo.dart';
import 'package:elaraby_workforce/core/tenant/tenant_features.dart';
import 'package:elaraby_workforce/core/tenant/tenant_service.dart';
import 'package:elaraby_workforce/core/theme/app_colors.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/features/home/presentation/widgets/quick_actions_grid.dart';
import 'package:elaraby_workforce/core/theme/tenant_theme_extension.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppTheme.init();
  });

  group('Enterprise White-Label Architecture Tests', () {
    test('All 5 Premier Enterprise Presets Are Configured With Required Data', () {
      final presets = TenantService.builtInPresets;
      expect(presets.length, 5);

      // 1. Elaraby Group
      final elaraby = presets.firstWhere((p) => p.tenantId == 'elaraby');
      expect(elaraby.companyName, 'Elaraby Group');
      expect(elaraby.companyNameAr, 'مجموعة العربي');
      expect(elaraby.primaryColor, const Color(0xFF0B63B4));
      expect(elaraby.supportHotline, '19319');
      expect(elaraby.crNumber, 'EG-104821');
      expect(elaraby.taxNumber, 'EG-102-993-841');
      expect(elaraby.currency, 'EGP');
      expect(elaraby.initials, 'EG');
      expect(elaraby.factoryLocations, contains('قويسنا الصناعية'));

      // 2. Elsewedy Electric
      final elsewedy = presets.firstWhere((p) => p.tenantId == 'elsewedy');
      expect(elsewedy.companyName, 'Elsewedy Electric');
      expect(elsewedy.companyNameAr, 'السويدي إليكتريك');
      expect(elsewedy.primaryColor, const Color(0xFFC8102E));
      expect(elsewedy.supportHotline, '16244');
      expect(elsewedy.crNumber, 'EG-284910');
      expect(elsewedy.taxNumber, 'EG-284-910-112');
      expect(elsewedy.initials, 'EE');

      // 3. GB Corp
      final ghabbour = presets.firstWhere((p) => p.tenantId == 'ghabbour');
      expect(ghabbour.companyName, 'GB Corp (Ghabbour Auto)');
      expect(ghabbour.companyNameAr, 'جي بي كورب (غبور أوتو)');
      expect(ghabbour.primaryColor, const Color(0xFF1E3A8A));
      expect(ghabbour.supportHotline, '19623');
      expect(ghabbour.crNumber, 'EG-550192');
      expect(ghabbour.initials, 'GC');

      // 4. Talaat Moustafa Group
      final tmg = presets.firstWhere((p) => p.tenantId == 'tmg');
      expect(tmg.companyName, 'Talaat Moustafa Group (TMG)');
      expect(tmg.companyNameAr, 'مجموعة طلعت مصطفى');
      expect(tmg.primaryColor, const Color(0xFF15803D));
      expect(tmg.supportHotline, '19688');
      expect(tmg.crNumber, 'EG-993812');
      expect(tmg.initials, 'TM');

      // 5. Gulf Industrial Corp
      final gulf = presets.firstWhere((p) => p.tenantId == 'gulf_industrial');
      expect(gulf.companyName, 'Gulf Industrial Corp');
      expect(gulf.companyNameAr, 'الخليج للصناعات الهندسية');
      expect(gulf.primaryColor, const Color(0xFF059669));
      expect(gulf.supportHotline, '80012345');
      expect(gulf.crNumber, 'GCC-441092');
      expect(gulf.taxNumber, 'SA-300-881-229');
      expect(gulf.currency, 'SAR');
      expect(gulf.initials, 'GI');
    });

    test('Tenant Serialization and Deserialization with CR, Tax, and Locations', () {
      final brand = TenantBrand.elsewedy();
      final json = brand.toJson();
      final restored = TenantBrand.fromJson(json);

      expect(restored.tenantId, 'elsewedy');
      expect(restored.companyName, 'Elsewedy Electric');
      expect(restored.crNumber, 'EG-284910');
      expect(restored.taxNumber, 'EG-284-910-112');
      expect(restored.supportHotline, '16244');
      expect(restored.primaryColor, const Color(0xFFC8102E));
    });

    test('Dynamic AppColors Reactive Bridge Updates When Organization Switches', () async {
      // 1. Initial brand: Elaraby
      AppTheme.setTenantBrand(TenantBrand.elaraby());
      expect(AppColors.primary, const Color(0xFF0B63B4));
      expect(AppColors.navActive, const Color(0xFF0B63B4));

      // 2. Switch to Elsewedy Electric via TenantService
      final newBrand = await TenantService.instance.applyTenantCode('elsewedy');
      expect(newBrand, isNotNull);
      expect(AppTheme.currentBrand.tenantId, 'elsewedy');
      expect(AppColors.primary, const Color(0xFFC8102E));
      expect(AppColors.navActive, const Color(0xFFC8102E));

      // 3. Switch to Talaat Moustafa Group
      await TenantService.instance.applyTenantCode('tmg');
      expect(AppTheme.currentBrand.tenantId, 'tmg');
      expect(AppColors.primary, const Color(0xFF15803D));

      // 4. Switch to Gulf Industrial
      await TenantService.instance.applyTenantCode('gulf_industrial');
      expect(AppTheme.currentBrand.tenantId, 'gulf_industrial');
      expect(AppColors.primary, const Color(0xFF059669));

      // 5. Restore Elaraby
      await TenantService.instance.applyTenantCode('elaraby');
      expect(AppTheme.currentBrand.tenantId, 'elaraby');
      expect(AppColors.primary, const Color(0xFF0B63B4));
    });

    test('Dynamic Placeholder Interpolation in AppLocale ({company}, {hotline})', () {
      // Set to Elaraby
      AppTheme.setTenantBrand(TenantBrand.elaraby());
      AppLocale.instance.setLocale(const Locale('ar'));

      final arTitleElaraby = AppLocale.tr('welcome_title');
      expect(arTitleElaraby, contains('مجموعة العربي'));

      final arHotlineElaraby = AppLocale.tr('support_hotline_label');
      expect(arHotlineElaraby, contains('19319'));

      // Switch to Elsewedy
      AppTheme.setTenantBrand(TenantBrand.elsewedy());
      final arTitleElsewedy = AppLocale.tr('welcome_title');
      expect(arTitleElsewedy, contains('السويدي إليكتريك'));

      final arHotlineElsewedy = AppLocale.tr('support_hotline_label');
      expect(arHotlineElsewedy, contains('16244'));
    });

    testWidgets('TenantBrandLogo Renders Typographic Monogram Shield Fallback',
        (tester) async {
      final brandWithoutAsset = TenantBrand(
        tenantId: 'custom_tech',
        companyName: 'Apex Innovations',
        companyNameAr: 'أبيكس للابتكارات',
        primaryColor: const Color(0xFF6366F1),
        primaryLightColor: const Color(0xFF818CF8),
        primarySoftColor: const Color(0xFFEEF2FF),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: TenantBrandLogo(
                brand: brandWithoutAsset,
                size: 60,
                borderRadius: 12,
              ),
            ),
          ),
        ),
      );

      // Verify initials "AI" are displayed in the shield
      expect(find.text('AI'), findsOneWidget);
    });

    testWidgets('QuickActionsGrid Strictly Filters Disabled Modules',
        (tester) async {
      // Tenant with Buses disabled and Trips disabled
      const restrictedFeatures = TenantFeatures(
        hasPayroll: true,
        hasVacations: true,
        hasShifts: true,
        hasBuses: false,
        hasBenefits: true,
        hasSummerTrips: false,
      );

      final brand = TenantBrand.elaraby();
      final themeWithExtension = ThemeData.light().copyWith(
        extensions: [
          TenantThemeExtension(
            brand: brand,
            features: restrictedFeatures,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: themeWithExtension,
          home: const Scaffold(
            body: SingleChildScrollView(
              child: QuickActionsGrid(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Bus icon should NOT be in the tree because hasBuses is false
      expect(find.byIcon(Icons.directions_bus_rounded), findsNothing);

      // Trip icon should NOT be in the tree because hasSummerTrips is false
      expect(find.byIcon(Icons.flight_rounded), findsNothing);

      // Salary and Vacation should be present
      expect(find.byIcon(Icons.account_balance_wallet_rounded), findsOneWidget);
      expect(find.byIcon(Icons.beach_access_rounded), findsOneWidget);
    });
  });
}
