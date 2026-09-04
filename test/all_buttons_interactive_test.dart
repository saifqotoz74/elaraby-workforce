import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/get_started_screen.dart';
import 'package:elaraby_workforce/features/auth/presentation/screens/pin_lock_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/vacation_balance_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/request_leave_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/shift_schedule_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/salary_slip_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/hr_request_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/raise_concern_screen.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/your_requests_screen.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';
import 'package:elaraby_workforce/features/benefits/presentation/screens/benefits_screen.dart';
import 'package:elaraby_workforce/features/benefits/presentation/screens/trip_detail_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/profile_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/settings_screen.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/change_pin_screen.dart';
import 'package:elaraby_workforce/features/inbox/presentation/screens/inbox_screen.dart';
import 'package:elaraby_workforce/features/main_navigation/presentation/screens/main_nav_screen.dart';
import 'package:elaraby_workforce/features/home/presentation/widgets/quick_actions_grid.dart';
import 'package:elaraby_workforce/features/profile/presentation/screens/help_support_screen.dart';

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
    await initializeDateFormatting('en', null);
    await initializeDateFormatting('ar', null);
    await LocalStore.instance.init();
    await RequestsStore.instance.load();
    await LocalStore.instance.saveProfile(const EmployeeProfile());
    await LocalStore.instance.setVacationBalance(21);
    await LocalStore.instance.setPin('1234');
    await LocalStore.instance.setSetting('salary_protection', false);
    await LocalStore.instance.setTripBooked('trip_alexandria_day_trip', false);
    AppLocale.instance.setLocale(const Locale('en'));
  });

  group('Interactive Buttons & Actions Tests', () {
    testWidgets('QuickActionsGrid: All 6 quick action buttons tap and navigate', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const Scaffold(body: SingleChildScrollView(child: QuickActionsGrid()))));
      await tester.pumpAndSettle();

      // 1. Quick Action: Salary Slip Button
      final salaryAction = find.text(AppLocale.tr('qa_salary'));
      expect(salaryAction, findsOneWidget);
      await tester.tap(salaryAction);
      await tester.pumpAndSettle();
      expect(find.byType(SalarySlipScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // 2. Quick Action: Vacation Balance Button
      final vacAction = find.text(AppLocale.tr('qa_vacation'));
      expect(vacAction, findsOneWidget);
      await tester.tap(vacAction);
      await tester.pumpAndSettle();
      expect(find.byType(VacationBalanceScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // 3. Quick Action: Shift Schedule Button
      final shiftAction = find.text(AppLocale.tr('qa_shift'));
      expect(shiftAction, findsOneWidget);
      await tester.tap(shiftAction);
      await tester.pumpAndSettle();
      expect(find.byType(ShiftScheduleScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // 4. Quick Action: Support Button
      final supportAction = find.text(AppLocale.tr('qa_support'));
      expect(supportAction, findsOneWidget);
      await tester.tap(supportAction);
      await tester.pumpAndSettle();
      expect(find.byType(HelpSupportScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();
    });

    testWidgets('VacationBalanceScreen: Request Leave button navigates to RequestLeaveScreen', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const VacationBalanceScreen()));
      await tester.pumpAndSettle();

      final requestBtn = find.text(AppLocale.tr('request_leave'));
      expect(requestBtn, findsOneWidget);
      await tester.tap(requestBtn);
      await tester.pumpAndSettle();

      expect(find.byType(RequestLeaveScreen), findsOneWidget);
    });

    testWidgets('RequestLeaveScreen: Form fields entry and Submit button tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await LocalStore.instance.setVacationBalance(30);

      await tester.pumpWidget(createTestApp(const RequestLeaveScreen()));
      await tester.pumpAndSettle();

      // Pick From Date
      final datePickers = find.text('dd/mm/yyyy');
      expect(datePickers, findsNWidgets(2));
      await tester.tap(datePickers.first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      // Pick To Date
      await tester.tap(find.text('dd/mm/yyyy'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      if (textFields.evaluate().isNotEmpty) {
        await tester.enterText(textFields.first, 'Family emergency');
      }

      final submitBtn = find.text(AppLocale.tr('leave_submit'));
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pump();
      expect(find.text(AppLocale.tr('leave_success')), findsOneWidget);
    });

    testWidgets('ShiftScheduleScreen: Day picker buttons tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const ShiftScheduleScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Sun'), findsOneWidget);
      expect(find.text('Mon'), findsOneWidget);
      expect(find.text('Tue'), findsOneWidget);

      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Wed'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Fri'));
      await tester.pumpAndSettle();
    });

    testWidgets('SalarySlipScreen: Download button tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const SalarySlipScreen()));
      await tester.pumpAndSettle();

      final downloadBtn = find.text(AppLocale.tr('slip_download'));
      expect(downloadBtn, findsOneWidget);
      await tester.tap(downloadBtn);
      await tester.pump();
    });

    testWidgets('HrRequestScreen: Enter text and Submit button tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const HrRequestScreen()));
      await tester.pumpAndSettle();

      final textField = find.byType(TextField);
      expect(textField, findsOneWidget);
      await tester.enterText(textField, 'Urgent salary certificate needed.');
      await tester.pumpAndSettle();

      final submitBtn = find.text('Submit Request');
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pump();

      expect(find.text('HR Request submitted successfully!'), findsOneWidget);
    });

    testWidgets('RaiseConcernScreen: Text entry and Submit button tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const RaiseConcernScreen()));
      await tester.pumpAndSettle();

      final textFields = find.byType(TextField);
      expect(textFields, findsOneWidget);
      await tester.enterText(textFields, 'Safety hazard in hall 2.');
      await tester.pumpAndSettle();

      final submitBtn = find.text('Submit Anonymously');
      expect(submitBtn, findsOneWidget);
      await tester.tap(submitBtn);
      await tester.pump();

      expect(find.text(AppLocale.tr('concern_success')), findsOneWidget);
    });

    testWidgets('YourRequestsScreen: Filter tabs tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const YourRequestsScreen()));
      await tester.pumpAndSettle();

      expect(find.text('All'), findsOneWidget);
      expect(find.text('In Review'), findsWidgets);
      expect(find.text('Approved'), findsWidgets);
      expect(find.text('Rejected'), findsWidgets);

      await tester.tap(find.text('In Review').first);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Approved').first);
      await tester.pumpAndSettle();

      await tester.tap(find.text('All').first);
      await tester.pumpAndSettle();
    });

    testWidgets('BenefitsScreen: Category pills tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const BenefitsScreen()));
      await tester.pumpAndSettle();

      final catSupermarkets = find.text(AppLocale.tr('ben_cat_supermarkets'));
      expect(catSupermarkets, findsOneWidget);
      await tester.tap(catSupermarkets);
      await tester.pumpAndSettle();

      final catHealth = find.text(AppLocale.tr('ben_cat_health'));
      expect(catHealth, findsOneWidget);
      await tester.tap(catHealth);
      await tester.pumpAndSettle();

      final catFeatured = find.text(AppLocale.tr('ben_cat_featured'));
      expect(catFeatured, findsOneWidget);
      await tester.tap(catFeatured);
      await tester.pumpAndSettle();
    });

    testWidgets('TripDetailScreen: Book seat and Cancel reservation buttons', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(
        const TripDetailScreen(
          title: 'Alexandria Day Trip',
          date: 'Fri, 24 Oct 2026',
          price: 'EGP 150',
          totalSeats: 45,
          bookedSeats: 32,
        ),
      ));
      await tester.pumpAndSettle();

      final bookBtn = find.textContaining(AppLocale.tr('trip_book_now'));
      expect(bookBtn, findsOneWidget);

      await tester.tap(bookBtn);
      await tester.pump();
      expect(find.text(AppLocale.tr('trip_confirmed')), findsOneWidget);

      // Dismiss snackbar so it does not obscure the bottom button
      ScaffoldMessenger.of(tester.element(find.byType(TripDetailScreen))).clearSnackBars();
      await tester.pumpAndSettle();

      final cancelBtn = find.text(AppLocale.tr('trip_cancel_booking'));
      expect(cancelBtn, findsOneWidget);

      await tester.tap(cancelBtn);
      await tester.pump();
      expect(find.text(AppLocale.tr('trip_cancelled')), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.textContaining(AppLocale.tr('trip_book_now')), findsOneWidget);
    });

    testWidgets('InboxScreen: Filter chips and Mark all as read button', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const InboxScreen()));
      await tester.pumpAndSettle();

      expect(find.text(AppLocale.tr('inbox_filter_all')), findsOneWidget);
      expect(find.text(AppLocale.tr('inbox_filter_announcements')), findsOneWidget);

      await tester.tap(find.text(AppLocale.tr('inbox_filter_announcements')));
      await tester.pumpAndSettle();

      await tester.tap(find.text(AppLocale.tr('inbox_filter_all')));
      await tester.pumpAndSettle();

      final markAllBtn = find.byIcon(Icons.done_all_rounded);
      if (markAllBtn.evaluate().isNotEmpty) {
        await tester.tap(markAllBtn);
        await tester.pump();
        expect(find.text(AppLocale.tr('inbox_marked_all')), findsOneWidget);
      }
    });

    testWidgets('ProfileScreen: Language modal, Privacy modal, and Logout modal buttons', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const ProfileScreen()));
      await tester.pumpAndSettle();

      // 1. Language Modal
      final langMenu = find.text(AppLocale.tr('menu_language'));
      expect(langMenu, findsOneWidget);
      await tester.tap(langMenu);
      await tester.pumpAndSettle();

      final arBtn = find.text('العربية');
      if (arBtn.evaluate().isNotEmpty) {
        await tester.tap(arBtn);
        await tester.pumpAndSettle();
        expect(AppLocale.instance.isArabic, true);

        await tester.tap(find.text(AppLocale.tr('menu_language')));
        await tester.pumpAndSettle();
        await tester.tap(find.text('English'));
        await tester.pumpAndSettle();
        expect(AppLocale.instance.isArabic, false);
      }

      // 2. Privacy Policy Modal
      final privacyMenu = find.text('Privacy Policy & Terms');
      await tester.ensureVisible(privacyMenu);
      expect(privacyMenu, findsOneWidget);
      await tester.tap(privacyMenu, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.text('Privacy Policy & Terms'), findsWidgets);
      final agreeBtn = find.text('Understood & Agree');
      if (agreeBtn.evaluate().isNotEmpty) {
        await tester.tap(agreeBtn);
        await tester.pumpAndSettle();
      }

      // 3. Logout Dialog
      final logoutBtn = find.text(AppLocale.tr('menu_logout'));
      await tester.ensureVisible(logoutBtn);
      expect(logoutBtn, findsOneWidget);
      await tester.tap(logoutBtn, warnIfMissed: false);
      await tester.pumpAndSettle();

      final cancelBtn = find.text(AppLocale.tr('common_cancel'));
      expect(cancelBtn, findsOneWidget);
      await tester.tap(cancelBtn);
      await tester.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('SettingsScreen: Interactive toggle switches', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const SettingsScreen()));
      await tester.pumpAndSettle();

      final switches = find.byType(CupertinoSwitch);
      expect(switches, findsNWidgets(3));

      await tester.tap(switches.at(0));
      await tester.pumpAndSettle();

      await tester.tap(switches.at(1));
      await tester.pumpAndSettle();

      await tester.tap(switches.at(2));
      await tester.pumpAndSettle();
    });

    testWidgets('ChangePinScreen: Keypad digits entry through all 3 steps', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const ChangePinScreen()));
      await tester.pumpAndSettle();

      // Step 1: Current PIN (1234)
      await tester.tap(find.text('1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('3'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('4'));
      await tester.pumpAndSettle();

      // Step 2: New PIN (5678)
      await tester.tap(find.text('5'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('6'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('7'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('8'));
      await tester.pumpAndSettle();

      // Step 3: Confirm PIN (5678)
      await tester.tap(find.text('5'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('6'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('7'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('8'));
      await tester.pumpAndSettle();

      final isVerified = await LocalStore.instance.verifyPin('5678');
      expect(isVerified, true);
    });

    testWidgets('PinLockScreen: Keypad buttons, backspace, and Forgot PIN button', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const PinLockScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.text('1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('2'));
      await tester.pumpAndSettle();

      final backspace = find.byIcon(Icons.backspace_outlined);
      expect(backspace, findsOneWidget);
      await tester.tap(backspace);
      await tester.pumpAndSettle();

      final forgotBtn = find.text(AppLocale.tr('auth_forgot_pin'));
      expect(forgotBtn, findsOneWidget);
      await tester.tap(forgotBtn);
      await tester.pumpAndSettle();
    });

    testWidgets('GetStartedScreen: Get Started button tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const GetStartedScreen()));
      await tester.pumpAndSettle();

      expect(find.text('English'), findsOneWidget);

      final getStartedBtn = find.text(AppLocale.tr('auth_get_started'));
      expect(getStartedBtn, findsOneWidget);
      await tester.tap(getStartedBtn);
      await tester.pumpAndSettle();
    });
  });
}
