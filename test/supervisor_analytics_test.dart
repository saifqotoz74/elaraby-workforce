import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/supervisor_analytics_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppLocale.instance.setLocale(const Locale('ar'));
  });

  Widget buildTestWidget({
    String shiftName = 'الوردية الصباحية (08:00 - 16:00)',
    String departmentName = 'قطاع التجميع والصناعات الهندسية',
  }) {
    return MaterialApp(
      home: SupervisorAnalyticsScreen(
        shiftName: shiftName,
        departmentName: departmentName,
      ),
    );
  }

  group('Supervisor Floor Analytics Mobile Screen', () {
    testWidgets('1. Renders shift header, department, and LIVE badge', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        departmentName: 'مصنع الأجهزة المنزلية - قويسنا',
        shiftName: 'وردية المساء (16:00 - 00:00)',
      ));
      await tester.pumpAndSettle();

      expect(find.text('مصنع الأجهزة المنزلية - قويسنا'), findsOneWidget);
      expect(find.text('وردية المساء (16:00 - 00:00)'), findsOneWidget);
      expect(find.text('مباشر'), findsOneWidget);
    });

    testWidgets('2. Displays circular attendance fill rate and metric counters', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Attendance meter & counters
      expect(find.text('ملء الوردية'), findsOneWidget);
      expect(find.text('الحاضرون بالوردية'), findsOneWidget);
      expect(find.text('44 / 48'), findsOneWidget);
      expect(find.text('المستهدف التشغيلي'), findsOneWidget);
      expect(find.text('92.0%'), findsOneWidget);
    });

    testWidgets('3. Renders stoppage risk floor alert banner', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Alert banner
      expect(find.byIcon(Icons.warning_amber_rounded), findsWidgets);
      expect(find.text('تنبيه عجز تشغيلي على خط التجميع'), findsOneWidget);
    });

    testWidgets('4. Displays Smart Backfill candidates with roles and 1-tap assign button', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      expect(find.text('التعويض الذكي الفوري (Smart Backfill)'), findsOneWidget);
      expect(find.text('محمود عبد الفتاح'), findsOneWidget);
      expect(find.text('(EG-1042)'), findsOneWidget);
      expect(find.text('فني تجميع وتشغيل ماكينات • Line-B (خط التجميع الرئيسي)'), findsOneWidget);

      // Verify assign button exists
      final assignButtons = find.widgetWithText(ElevatedButton, 'تعيين كبديل');
      expect(assignButtons, findsWidgets);
    });

    testWidgets('5. 1-Tap Smart Backfill Assignment updates worker state, increments count & shows SnackBar', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      // Initial count is 44 / 48
      expect(find.text('44 / 48'), findsOneWidget);

      // Tap first assign button
      final firstAssignBtn = find.widgetWithText(ElevatedButton, 'تعيين كبديل').first;
      await tester.tap(firstAssignBtn);
      await tester.pump(); // Start animation / snackbar

      // Verify SnackBar appears
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.textContaining('تم تعيين العامل'), findsOneWidget);

      await tester.pumpAndSettle();

      // Candidate state updated to 'تم التعيين'
      expect(find.text('تم التعيين'), findsOneWidget);

      // Count incremented to 45 / 48
      expect(find.text('45 / 48'), findsOneWidget);
    });

    testWidgets('6. Renders Department Overtime Budget Meter with progress indicator', (tester) async {
      await tester.pumpWidget(buildTestWidget());
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('ميزانية الساعات الإضافية للمصنع'),
        100,
        scrollable: find.byType(Scrollable),
      );

      expect(find.text('ميزانية الساعات الإضافية للمصنع'), findsOneWidget);
      expect(find.text('142 / 180 ساعة'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
    });
  });
}
