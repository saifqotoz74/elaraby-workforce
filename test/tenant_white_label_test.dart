import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:elaraby_workforce/core/tenant/tenant_brand.dart';
import 'package:elaraby_workforce/core/tenant/tenant_features.dart';
import 'package:elaraby_workforce/core/tenant/identity_strategy.dart';
import 'package:elaraby_workforce/core/tenant/tenant_service.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/core/theme/tenant_theme_extension.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/auth/presentation/widgets/company_code_modal.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/national_id_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppTheme.setTenantBrand(TenantBrand.elarabyDefault());
  });

  group('TenantBrand Model & Serialization Tests', () {
    test('TenantBrand.elarabyDefault returns institutional baseline colors', () {
      final defaultBrand = TenantBrand.elarabyDefault();
      expect(defaultBrand.tenantId, 'elaraby');
      expect(defaultBrand.primaryColor, const Color(0xFF0B63B4));
      expect(defaultBrand.companyName, 'Elaraby Group');
      expect(defaultBrand.supportHotline, '19319');
    });

    test('TenantBrand serializes to and from JSON with hexadecimal color strings', () {
      const custom = TenantBrand(
        tenantId: 'elsewedy',
        companyName: 'Elsewedy Electric',
        companyNameAr: 'السويدي إليكتريك',
        primaryColor: Color(0xFFC8102E),
        primaryLightColor: Color(0xFFE02B47),
        primarySoftColor: Color(0xFFFCECEF),
        scaffoldBgColor: Color(0xFFF8F9FA),
        supportHotline: '16244',
      );

      final jsonMap = custom.toJson();
      expect(jsonMap['tenantId'], 'elsewedy');
      expect(jsonMap['primaryColor'], '#C8102E');
      expect(jsonMap['supportHotline'], '16244');

      final deserialized = TenantBrand.fromJson(jsonMap);
      expect(deserialized.tenantId, 'elsewedy');
      expect(deserialized.primaryColor, const Color(0xFFC8102E));
      expect(deserialized.companyName, 'Elsewedy Electric');
    });

    test('TenantBrand.fromJson handles missing or malformed hex gracefully', () {
      final fallback = TenantBrand.fromJson({'tenantId': 'unknown'});
      expect(fallback.primaryColor, const Color(0xFF0B63B4));
      expect(fallback.companyName, 'Elaraby Group');
    });
  });

  group('TenantFeatures Model & Toggles Tests', () {
    test('TenantFeatures.allEnabled provides all true flags', () {
      final all = TenantFeatures.allEnabled();
      expect(all.hasShifts, isTrue);
      expect(all.hasPayroll, isTrue);
      expect(all.hasVacations, isTrue);
      expect(all.hasBuses, isTrue);
      expect(all.hasBenefits, isTrue);
      expect(all.hasSummerTrips, isTrue);
      expect(all.hasWhistleblower, isTrue);
      expect(all.hasSurveys, isTrue);
      expect(all.hasMedicalNetwork, isTrue);
    });

    test('TenantFeatures parses custom module configurations', () {
      final custom = TenantFeatures.fromJson({
        'hasBuses': false,
        'hasSummerTrips': false,
        'hasBenefits': false,
      });
      expect(custom.hasShifts, isTrue);
      expect(custom.hasPayroll, isTrue);
      expect(custom.hasBuses, isFalse);
      expect(custom.hasSummerTrips, isFalse);
      expect(custom.hasBenefits, isFalse);
    });
  });

  group('Identity Strategy Pattern Tests', () {
    test('EgyptianNationalIdStrategy validates 14 digits and century/governorate', () {
      final strategy = IdentityStrategy.fromMode(IdentityMode.egyptianNationalId);
      expect(strategy.isNumericOnly, isTrue);
      expect(strategy.exactLength, 14);

      // Valid: male born in 1990 in Cairo (01)
      expect(strategy.validate('29001010112345'), isTrue);
      // Invalid: 13 digits
      expect(strategy.validate('2900101011234'), isFalse);
      // Invalid: Letters
      expect(strategy.validate('2900101011234A'), isFalse);
    });

    test('GulfIqamaStrategy validates 10 digits starting with 1 or 2', () {
      final strategy = IdentityStrategy.fromMode(IdentityMode.gulfIqama);
      expect(strategy.exactLength, 10);
      expect(strategy.validate('1012345678'), isTrue); // Citizen
      expect(strategy.validate('2012345678'), isTrue); // Resident
      expect(strategy.validate('3012345678'), isFalse); // Invalid prefix
      expect(strategy.validate('101234567'), isFalse); // 9 digits
    });

    test('GenericEmployeeCodeStrategy validates alphanumeric identifiers', () {
      final strategy = IdentityStrategy.fromMode(IdentityMode.genericEmployeeCode);
      expect(strategy.isNumericOnly, isFalse);
      expect(strategy.validate('EG-20481'), isTrue);
      expect(strategy.validate('EMP_9921'), isTrue);
      expect(strategy.validate('A1'), isFalse); // Too short (< 3 chars)
      expect(strategy.validate('EMP@#!*'), isFalse); // Disallowed characters
    });
  });

  group('Dynamic Theme & LocalStore Persistence Tests', () {
    test('AppTheme updates dynamically when new TenantBrand is applied', () {
      const redBrand = TenantBrand(
        tenantId: 'custom_red',
        companyName: 'Red Industries',
        companyNameAr: 'الصناعات الحمراء',
        primaryColor: Color(0xFFE11D48),
        primaryLightColor: Color(0xFFF43F5E),
        primarySoftColor: Color(0xFFFFE4E6),
      );

      AppTheme.setTenantBrand(redBrand);
      expect(AppTheme.currentBrand.tenantId, 'custom_red');
      expect(AppTheme.currentBrand.primaryColor, const Color(0xFFE11D48));

      final lightTheme = AppTheme.themeFor(isArabic: false, isDark: false);
      expect(lightTheme.colorScheme.primary, const Color(0xFFE11D48));
    });

    test('LocalStore persists and restores active tenant brand across restarts', () async {
      const customBrand = TenantBrand(
        tenantId: 'fresh',
        companyName: 'Fresh Electric',
        companyNameAr: 'فريش إليكتريك',
        primaryColor: Color(0xFFFF5722),
        primaryLightColor: Color(0xFFFF7043),
        primarySoftColor: Color(0xFFFBE9E7),
      );

      await LocalStore.instance.setActiveTenantBrandJson(jsonEncode(customBrand.toJson()));
      await LocalStore.instance.setActiveTenantSlug('fresh');

      expect(LocalStore.instance.activeTenantSlug, 'fresh');
      final retrievedJson = LocalStore.instance.activeTenantBrandJson;
      expect(retrievedJson, isNotNull);

      final restored = TenantBrand.fromJson(jsonDecode(retrievedJson!));
      expect(restored.tenantId, 'fresh');
      expect(restored.primaryColor, const Color(0xFFFF5722));
    });

    testWidgets('TenantThemeExtension attaches and resolves from context', (tester) async {
      const testBrand = TenantBrand(
        tenantId: 'test_brand',
        companyName: 'Test Corp',
        companyNameAr: 'شركة اختبار',
        primaryColor: Color(0xFF10B981),
        primaryLightColor: Color(0xFF34D399),
        primarySoftColor: Color(0xFFD1FAE5),
      );

      AppTheme.setTenantBrand(testBrand);

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData.light(useMaterial3: true).copyWith(
            extensions: [
              TenantThemeExtension(
                brand: testBrand,
                features: TenantFeatures.allEnabled(),
              ),
            ],
          ),
          home: Builder(
            builder: (context) {
              final brand = context.tenantBrand;
              final features = context.tenantFeatures;
              return Scaffold(
                body: Text('${brand.companyName} - ${features.hasShifts}'),
              );
            },
          ),
        ),
      );

      expect(find.text('Test Corp - true'), findsOneWidget);
    });
  });

  group('TenantService Discovery & CompanyCodeModal Tests', () {
    test('TenantService applies built-in Elsewedy preset cleanly', () async {
      final brand = await TenantService.instance.applyTenantCode('elsewedy');
      expect(brand, isNotNull);
      expect(brand!.tenantId, 'elsewedy');
      expect(brand.primaryColor, const Color(0xFFC8102E));
      expect(LocalStore.instance.activeTenantSlug, 'elsewedy');
      expect(AppTheme.currentBrand.tenantId, 'elsewedy');
    });

    test('TenantService returns null for non-existent code', () async {
      final brand = await TenantService.instance.applyTenantCode('unknown_non_existent_xyz');
      expect(brand, isNull);
    });

    testWidgets('CompanyCodeModal renders presets and allows selection', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => ElevatedButton(
                  onPressed: () => CompanyCodeModal.show(context),
                  child: const Text('Open Modal'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Modal'));
      await tester.pumpAndSettle();

      expect(find.text('Set Organization Code'), findsOneWidget);
      expect(find.text('Elsewedy Electric'), findsOneWidget);
      expect(find.text('Elaraby Group'), findsOneWidget);

      // Tap Elsewedy preset chip
      await tester.tap(find.text('Elsewedy Electric'));
      await tester.pumpAndSettle();

      expect(AppTheme.currentBrand.tenantId, 'elsewedy');
    });

    testWidgets('NationalIdScreen adapts to Gulf Iqama mode (10 slots)', (tester) async {
      await LocalStore.instance.setActiveIdentityMode('gulf_iqama');

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: NationalIdScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('0 of 10'), findsOneWidget);
      expect(find.text('National / Resident ID (Iqama)'), findsOneWidget);
    });

    testWidgets('NationalIdScreen adapts to Employee Code mode (field input)', (tester) async {
      await LocalStore.instance.setActiveIdentityMode('employee_code');

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: NationalIdScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Employee ID Code'), findsOneWidget);
      expect(find.text('EG-20481'), findsOneWidget);
    });
  });
}

