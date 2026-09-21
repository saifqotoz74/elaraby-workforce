import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/features/kiosk/presentation/screens/kiosk_screen.dart';
import 'package:elaraby_workforce/features/kiosk/presentation/screens/kiosk_qr_screen.dart';
import 'package:elaraby_workforce/features/kiosk/presentation/widgets/machine_status_card.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppLocale.instance.setLocale(const Locale('ar'));
  });

  Widget buildTestWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('Kiosk Screen & Widgets Test Suite', () {
    testWidgets('1. KioskScreen renders employee name', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(buildTestWidget(const KioskScreen()));
      await tester.pump();

      expect(find.text('محمود أحمد'), findsWidgets);
      expect(find.text('تسجيل الحضور / الانصراف'), findsOneWidget);
    });

    testWidgets('2. KioskScreen shows machine status cards grid', (tester) async {
      await tester.pumpWidget(buildTestWidget(const KioskScreen()));
      await tester.pump();

      expect(find.text('حالة الماكينات'), findsOneWidget);
      expect(find.text('خط التجميع A'), findsOneWidget);
      expect(find.text('ضاغط الهواء C'), findsOneWidget);
    });

    testWidgets('3. Stopped machine card shows red indicator and reason', (tester) async {
      await tester.pumpWidget(buildTestWidget(const KioskScreen()));
      await tester.pump();

      expect(find.text('صيانة دورية'), findsOneWidget);
      // "⚠️ تحذير: 1 ماكينة متوقفة"
      expect(find.textContaining('تحذير: 1 ماكينة متوقفة'), findsOneWidget);
    });

    testWidgets('4. Running machine shows green indicator', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        const MachineStatusCard(
          id: 'M001',
          name: 'خط التجميع A',
          status: 'running',
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('خط التجميع A'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
    });

    testWidgets('5. Work order tile shows progress', (tester) async {
      await tester.pumpWidget(buildTestWidget(const KioskScreen()));
      await tester.pump();

      expect(find.text('أوامر التشغيل الحالية'), findsOneWidget);
      expect(find.text('تجميع ثلاجات 12 قدم'), findsOneWidget);
      expect(find.text('145 / 200'), findsOneWidget);
    });

    testWidgets('6. KioskQrScreen submits and shows success', (tester) async {
      await tester.pumpWidget(buildTestWidget(const KioskQrScreen()));
      await tester.pumpAndSettle();

      expect(find.text('تسجيل الحضور والانصراف'), findsOneWidget);
      
      final textField = find.byType(TextField);
      expect(textField, findsOneWidget);
      
      await tester.enterText(textField, '12345');
      await tester.pump();
      
      final submitBtn = find.widgetWithText(ElevatedButton, 'تسجيل');
      await tester.tap(submitBtn);
      
      await tester.pump(); // trigger setState
      
      expect(find.text('تم التسجيل بنجاح'), findsOneWidget);
    });

    testWidgets('7. MachineStatusCard renders correctly for all 3 statuses', (tester) async {
      await tester.pumpWidget(buildTestWidget(
        Column(
          children: [
            MachineStatusCard(id: '1', name: 'M1', status: 'running'),
            MachineStatusCard(id: '2', name: 'M2', status: 'stopped', stopReason: 'broke'),
            MachineStatusCard(id: '3', name: 'M3', status: 'maintenance'),
          ],
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
      expect(find.byIcon(Icons.error_outline), findsOneWidget);
      expect(find.byIcon(Icons.build_circle_outlined), findsOneWidget);
    });
  });
}
