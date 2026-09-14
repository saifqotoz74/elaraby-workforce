import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:elaraby_workforce/core/tenant/tenant_brand.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/get_started_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/profile_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/widgets/organization_switcher_sheet.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppLocale.instance.setLocale(const Locale('ar'));
    AppTheme.init();
  });

  group('TenantBrand Flavor Locking Architecture Tests', () {
    test('isFlavorLocked defaults to false and survives JSON round-trip', () {
      final defaultBrand = TenantBrand.elaraby();
      expect(defaultBrand.isFlavorLocked, isFalse);

      final lockedBrand = defaultBrand.copyWith(isFlavorLocked: true);
      expect(lockedBrand.isFlavorLocked, isTrue);

      final json = lockedBrand.toJson();
      expect(json['isFlavorLocked'], isTrue);

      final restored = TenantBrand.fromJson(json);
      expect(restored.isFlavorLocked, isTrue);
    });

    test('All enterprise presets can be locked into dedicated flavor configurations', () {
      final elsewedyLocked = TenantBrand.elsewedy().copyWith(isFlavorLocked: true);
      final ghabbourLocked = TenantBrand.ghabbour().copyWith(isFlavorLocked: true);
      final tmgLocked = TenantBrand.talaatMoustafa().copyWith(isFlavorLocked: true);
      final gulfLocked = TenantBrand.gulfIndustrial().copyWith(isFlavorLocked: true);

      expect(elsewedyLocked.tenantId, 'elsewedy');
      expect(elsewedyLocked.isFlavorLocked, isTrue);
      expect(ghabbourLocked.tenantId, 'ghabbour');
      expect(ghabbourLocked.isFlavorLocked, isTrue);
      expect(tmgLocked.tenantId, 'tmg');
      expect(tmgLocked.isFlavorLocked, isTrue);
      expect(gulfLocked.tenantId, 'gulf_industrial');
      expect(gulfLocked.isFlavorLocked, isTrue);
    });
  });

  group('GetStartedScreen Flavor Adaptive UI Tests', () {
    testWidgets('Unlocked dynamic mode displays switcher dropdown and prompt', (tester) async {
      final unlocked = TenantBrand.elaraby().copyWith(isFlavorLocked: false);
      AppTheme.setTenantBrand(unlocked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: GetStartedScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.arrow_drop_down_rounded), findsOneWidget);
      expect(
        find.textContaining('اضغط لتغيير المؤسسة'),
        findsOneWidget,
      );

      // Tapping opens OrganizationSwitcherSheet
      await tester.tap(find.byIcon(Icons.arrow_drop_down_rounded));
      await tester.pumpAndSettle();
      expect(find.byType(OrganizationSwitcherSheet), findsOneWidget);
    });

    testWidgets('Locked dedicated flavor hides dropdown chevron and disables switcher sheet', (tester) async {
      final locked = TenantBrand.elsewedy().copyWith(isFlavorLocked: true);
      AppTheme.setTenantBrand(locked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: GetStartedScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Dropdown chevron is hidden
      expect(find.byIcon(Icons.arrow_drop_down_rounded), findsNothing);

      // Shows enterprise portal tag instead of tap prompt
      expect(find.textContaining('منصة العمل المؤسسية'), findsOneWidget);
      expect(find.textContaining('اضغط لتغيير المؤسسة'), findsNothing);

      // Tapping does NOT open OrganizationSwitcherSheet
      await tester.tap(find.textContaining('منصة العمل المؤسسية'));
      await tester.pumpAndSettle();
      expect(find.byType(OrganizationSwitcherSheet), findsNothing);
    });
  });

  group('ProfileScreen Flavor Adaptive UI Tests', () {
    testWidgets('Unlocked mode displays Organization & Workplace menu tile', (tester) async {
      final unlocked = TenantBrand.elaraby().copyWith(isFlavorLocked: false);
      AppTheme.setTenantBrand(unlocked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: ProfileScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('المؤسسة وجهة العمل'), findsOneWidget);
    });

    testWidgets('Locked dedicated flavor suppresses Organization & Workplace menu tile', (tester) async {
      final locked = TenantBrand.ghabbour().copyWith(isFlavorLocked: true);
      AppTheme.setTenantBrand(locked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: ProfileScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('المؤسسة وجهة العمل'), findsNothing);
    });
  });
}
