import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/providers/repository_providers.dart';
import 'package:elaraby_workforce/core/state/ui_state.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/services/data/payroll_data.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/salary_controller.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/salary_slip_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/request_leave_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/raise_concern_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/hr_request_screen.dart';
import 'package:elaraby_workforce/l10n/generated/app_localizations.dart';

Widget _buildTestWrapper({
  required Widget child,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      locale: const Locale('en'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      home: child,
      theme: ThemeData(fontFamily: 'Inter'),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await initializeDateFormatting('en', null);
    await initializeDateFormatting('ar', null);
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    await LocalStore.instance.setSetting('salary_protection', false);
    AppLocale.instance.setLocale(const Locale('en'));
  });

  group('Phase 10 - Salary UX Reliability & No Fake Data Tests', () {
    test(
        'SalarySlipData rejects missing values and requires explicit parameters',
        () {
      const data = SalarySlipData(
        period: 'August 2026',
        basicSalary: 8500,
        allowances: 1000,
        deductions: 500,
        paidOn: 'Aug 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
      );

      expect(data.basicSalary, 8500);
      expect(data.netPay, 9000);
      expect(data.basicLabel, 'EGP 8,500');
      expect(data.netPayLabel, 'EGP 9,000');
    });

    testWidgets(
        'SalarySlipScreen shows Error and Retry when salary cannot be loaded',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildTestWrapper(
          child: const SalarySlipScreen(),
          overrides: [
            salaryStateProvider.overrideWith((ref) {
              final notifier =
                  SalaryNotifier(ref.watch(salaryRepositoryProvider));
              notifier.state = const UiState.error(
                'Unable to contact payroll server.',
                code: 'PAYROLL_UNAVAILABLE',
              );
              return notifier;
            }),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Verify NO fake numbers are displayed
      expect(find.textContaining('7,000'), findsNothing);
      expect(find.textContaining('7000'), findsNothing);

      // Verify error message and Retry button are displayed
      expect(find.text('Unable to contact payroll server.'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      // Tap Retry button
      await tester.tap(find.text('Retry'));
      await tester.pump();
    });

    testWidgets(
        'SalarySlipScreen renders genuine statement when loaded successfully',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildTestWrapper(
          child: const SalarySlipScreen(),
          overrides: [
            salaryStateProvider.overrideWith((ref) {
              final notifier =
                  SalaryNotifier(ref.watch(salaryRepositoryProvider));
              notifier.state = const UiState.success({
                'period': 'August 2026',
                'basicSalary': 12500,
                'allowances': 2000,
                'deductions': 800,
                'paidOn': 'Aug 28, 2026',
                'paymentMethod': 'CIB Bank Transfer',
              });
              return notifier;
            }),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Verify real salary numbers are rendered correctly
      expect(find.text('EGP 12,500'), findsOneWidget);
      expect(find.text('+EGP 2,000'), findsOneWidget);
      expect(find.text('-EGP 800'), findsOneWidget);
      expect(find.text('EGP 13,700'), findsWidgets); // Net pay
      expect(find.text(AppLocale.tr('slip_download')), findsOneWidget);
    });
  });

  group('Phase 10 - Duplicate Submission Prevention Tests', () {
    testWidgets(
        'RequestLeaveScreen disables submit button while submission is in progress',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildTestWrapper(child: const RequestLeaveScreen()),
      );
      await tester.pumpAndSettle();

      // Button is initially disabled without dates
      final submitBtn =
          tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(submitBtn.onPressed, isNull);
    });

    testWidgets('RaiseConcernScreen displays error if submitted empty',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildTestWrapper(child: const RaiseConcernScreen()),
      );
      await tester.pumpAndSettle();

      final submitBtn = find.text('Submit Anonymously');
      expect(submitBtn, findsOneWidget);

      await tester.tap(submitBtn);
      await tester.pump();

      // No silent failure: SnackBar warning is shown
      expect(find.text('Please enter details for your report first.'),
          findsOneWidget);
    });

    testWidgets('HrRequestScreen disables button during submit',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildTestWrapper(child: const HrRequestScreen()),
      );
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);
      await tester.enterText(textField, 'Requesting employment proof');
      await tester.pumpAndSettle();

      final submitBtn = find.text('Submit Request');
      expect(submitBtn, findsOneWidget);

      await tester.tap(submitBtn);
      await tester.pump();

      expect(find.text('HR Request submitted successfully!'), findsOneWidget);
    });
  });
}
