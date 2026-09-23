import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:elaraby_workforce/core/tenant/tenant_brand.dart';
import 'package:elaraby_workforce/core/theme/app_theme.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/company_code_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/national_id_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppLocale.instance.setLocale(const Locale('ar'));
    AppTheme.init();
  });

  group('CompanyCodeScreen Widget & Integration Tests', () {
    testWidgets('CompanyCodeScreen renders input, presets, and platform tag', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: CompanyCodeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Heading and input field
      expect(find.text('أدخل كود المؤسسة'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('تأكيد ومتابعة'), findsOneWidget);

      // Presets
      expect(find.text('ELARABY'), findsOneWidget);
      expect(find.text('ELSEWEDY'), findsOneWidget);
      expect(find.text('GHABBOUR'), findsOneWidget);
      expect(find.text('GULF'), findsOneWidget);
    });

    testWidgets('Submitting valid code triggers welcome transition and resolves brand', (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: CompanyCodeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap ELARABY preset
      await tester.tap(find.text('ELARABY'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Welcome transition appears
      expect(find.textContaining('مرحباً بك في مجموعة العربي'), findsOneWidget);
      expect(find.text('تم التحقق من المؤسسة بنجاح'), findsOneWidget);

      // Advance through the 1.5s timer
      await tester.pump(const Duration(milliseconds: 1600));
    });

    testWidgets('Submitting invalid code shows error message', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: CompanyCodeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Enter invalid code
      await tester.enterText(find.byType(TextField), 'INVALID_XYZ_CORP');
      await tester.pump();

      await tester.tap(find.text('تأكيد ومتابعة'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      // Error message is displayed
      expect(find.textContaining('كود المؤسسة غير مسجل'), findsOneWidget);
    });

    testWidgets('CompanyCodeScreen displays offline banner when in offline UiState', (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Trigger offline state
      container.read(companyCodeProvider.notifier).setOffline();

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: CompanyCodeScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('أنت غير متصل بالإنترنت'), findsOneWidget);
      expect(find.byIcon(Icons.wifi_off_rounded), findsOneWidget);
    });
  });

  group('NationalIdScreen Flavor Adaptive Tests', () {
    testWidgets('Unlocked mode displays switch company link', (tester) async {
      final unlocked = TenantBrand.elaraby().copyWith(isFlavorLocked: false);
      AppTheme.setTenantBrand(unlocked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: NationalIdScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('تغيير الشركة'), findsOneWidget);
    });

    testWidgets('Locked mode hides switch company link', (tester) async {
      final locked = TenantBrand.elaraby().copyWith(isFlavorLocked: true);
      AppTheme.setTenantBrand(locked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: NationalIdScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('تغيير الشركة'), findsNothing);
    });
  });

  group('SettingsScreen Flavor Adaptive Tests', () {
    testWidgets('Unlocked mode displays Active Organization Code tile', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final unlocked = TenantBrand.elaraby().copyWith(isFlavorLocked: false);
      AppTheme.setTenantBrand(unlocked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('كود المؤسسة النشط'), findsOneWidget);
    });

    testWidgets('Locked mode hides Active Organization Code tile', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final locked = TenantBrand.elaraby().copyWith(isFlavorLocked: true);
      AppTheme.setTenantBrand(locked);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: SettingsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('كود المؤسسة النشط'), findsNothing);
    });
  });
}
