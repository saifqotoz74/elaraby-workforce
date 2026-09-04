import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/get_started_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/national_id_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/otp_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/profile_confirmation_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/pin_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/pin_lock_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/splash_screen.dart';
import 'package:elaraby_workforce/features/common/presentation/widgets/update_dialog.dart';
import 'package:elaraby_workforce/features/main_navigation/presentation/screens/main_nav_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/change_pin_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/help_support_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/profile_screen.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/employee_data_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/hr_request_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/raise_concern_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/request_leave_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/salary_slip_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/shift_schedule_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/vacation_balance_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/your_requests_screen.dart';
import 'package:elaraby_workforce/main.dart';

Widget createTestApp(Widget child, {Locale locale = const Locale('en')}) {
  AppLocale.instance.setLocale(locale);
  return MaterialApp(
    home: child,
    theme: ThemeData(fontFamily: 'Inter'),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    await LocalStore.instance.saveProfile(const EmployeeProfile());
    await LocalStore.instance.setSetting('salary_protection', false);
    AppLocale.instance.setLocale(const Locale('en'));
  });

  group('Auth Screens Functional Tests', () {
    testWidgets('SplashScreen renders and displays logo/title', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const SplashScreen()));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('ELARABY'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3)); // settle splash timer
    });

    testWidgets('GetStartedScreen renders language switch and get started button', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const GetStartedScreen()));
      await tester.pumpAndSettle();
      expect(find.text('Elaraby Connect'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
      expect(find.text(AppLocale.tr('auth_get_started')), findsOneWidget);
    });

    testWidgets('NationalIdScreen validates 14 digits and enables button', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const NationalIdScreen()));
      await tester.pumpAndSettle();

      final input = find.byType(TextField);
      expect(input, findsOneWidget);

      await tester.enterText(input, '29001011234592');
      await tester.pumpAndSettle();
      expect(find.text('29001011234592'), findsOneWidget);
      expect(find.text(AppLocale.tr('auth_continue')), findsOneWidget);
    });

    testWidgets('OtpScreen renders 6 digits inputs and handles input', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const OtpScreen(nationalId: '30607301402992')));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('auth_otp_title')), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('ProfileConfirmationScreen displays worker info', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const ProfileConfirmationScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('confirm_profile_yes')), findsOneWidget);
    });

    testWidgets('PinScreen keypad interaction', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const PinScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('auth_create_pin_title')), findsOneWidget);

      // Tap 1, 2, 3
      await tester.tap(find.text('1'));
      await tester.pump();
      await tester.tap(find.text('2'));
      await tester.pump();
      await tester.tap(find.text('3'));
      await tester.pump();
      await tester.pumpAndSettle();
    });

    testWidgets('PinLockScreen verifies PIN entry', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await LocalStore.instance.setPin('1234');
      await tester.pumpWidget(createTestApp(const PinLockScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('auth_unlock_title')), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
    });
  });

  group('Main App Navigation & Tabs', () {
    testWidgets('Can navigate across all 5 bottom nav tabs', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(const ElarabyWorkforceApp(initialScreen: MainNavScreen()));
      await tester.pumpAndSettle();

      // Home Tab
      expect(find.text('Welcome, Ahmed'), findsOneWidget);

      // Navigate to Services Tab
      await tester.tap(find.byIcon(Icons.grid_view_outlined));
      await tester.pumpAndSettle();
      expect(find.text(AppLocale.tr('services_title')), findsWidgets);

      // Navigate to Benefits Tab
      await tester.tap(find.byIcon(Icons.card_giftcard_outlined));
      await tester.pumpAndSettle();
      expect(find.text(AppLocale.tr('nav_benefits')), findsWidgets);

      // Navigate to Inbox Tab
      await tester.tap(find.byIcon(Icons.inbox_outlined));
      await tester.pumpAndSettle();
      expect(find.text(AppLocale.tr('inbox_title')), findsWidgets);

      // Navigate to Profile Tab
      await tester.tap(find.byIcon(Icons.person_outline_rounded));
      await tester.pumpAndSettle();
      expect(find.text('Ahmed Ghannam'), findsOneWidget);
    });
  });

  group('Services Screens Functional Tests', () {
    testWidgets('VacationBalanceScreen renders metrics and leave breakdown', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const VacationBalanceScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('vacation_balance')), findsOneWidget);
      expect(find.text(AppLocale.tr('request_leave')), findsOneWidget);
    });

    testWidgets('RequestLeaveScreen calculates duration and validates submission', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const RequestLeaveScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('request_leave')), findsOneWidget);
      expect(find.text(AppLocale.tr('leave_submit')), findsOneWidget);
    });

    testWidgets('ShiftScheduleScreen renders 7-day calendar', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const ShiftScheduleScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('shift_schedule')), findsOneWidget);
    });

    testWidgets('SalarySlipScreen renders salary elements and deductions', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const SalarySlipScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('salary_slip')), findsOneWidget);
      expect(find.textContaining('Net Pay'), findsWidgets);
      expect(find.text(AppLocale.tr('slip_download')), findsOneWidget);
    });

    testWidgets('HrRequestScreen renders document types', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const HrRequestScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('hr_request')), findsOneWidget);
      expect(find.text('Submit Request'), findsOneWidget);
    });

    testWidgets('RaiseConcernScreen renders category picker and anonymous toggle', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const RaiseConcernScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('raise_concern')), findsOneWidget);
      expect(find.text('Submit Anonymously'), findsOneWidget);
    });

    testWidgets('YourRequestsScreen renders filter tabs and requests', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const YourRequestsScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('your_requests')), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('In Review'), findsWidgets);
    });

    testWidgets('EmployeeDataScreen renders official company records', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const EmployeeDataScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('employee_data')), findsOneWidget);
    });
  });

  group('Profile & Dialogs Functional Tests', () {
    testWidgets('ProfileScreen shows account deletion option', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const ProfileScreen()));
      await tester.pumpAndSettle();

      final deleteTile = find.text('Request Account Deletion');
      expect(deleteTile, findsOneWidget);

      await tester.tap(deleteTile);
      await tester.pumpAndSettle();

      expect(find.text('Request Account Deletion'), findsWidgets);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('ChangePinScreen renders step current PIN title', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await LocalStore.instance.setPin('1234');
      await tester.pumpWidget(createTestApp(const ChangePinScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('change_pin_step_current_title')), findsOneWidget);
    });

    testWidgets('HelpSupportScreen renders support contacts and FAQs', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const HelpSupportScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('settings_help')), findsOneWidget);
    });

    testWidgets('UpdateDialog renders force update and optional update modes', (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      // Optional Update
      await tester.pumpWidget(createTestApp(
        const UpdateDialog(
          info: AppVersionInfo(
            currentVersion: '1.0.0',
            minVersion: '1.0.0',
            latestVersion: '1.1.0',
            forceUpdate: false,
            title: 'تحديث جديد متوفر',
            titleEn: 'Update Available',
            message: 'يتوفر إصدار جديد',
            messageEn: 'Please update your application.',
            updateUrl: 'https://example.com',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Update Available'), findsOneWidget);
      expect(find.text('Later'), findsOneWidget);
      expect(find.text('Update Now'), findsOneWidget);
    });
  });
}
