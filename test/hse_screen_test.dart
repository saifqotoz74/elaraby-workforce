import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/hse/presentation/screens/hse_home_screen.dart';
import 'package:elaraby_workforce/features/hse/presentation/screens/apply_permit_sheet.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    AppLocale.instance.setLocale(const Locale('ar'));
  });

  Widget createWidgetUnderTest() {
    return const MaterialApp(
      locale: Locale('ar'),
      home: HseHomeScreen(),
    );
  }

  testWidgets('Test 1: Renders HSE home screen title and LTI days counter', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3.0;

    await tester.pumpWidget(createWidgetUnderTest());
    await tester.pumpAndSettle();

    expect(find.text('إدارة السلامة والصحة المهنية'), findsOneWidget);
    expect(find.text('142 يوم بدون إصابات عمل'), findsOneWidget);
    expect(find.text('نسبة الالتزام بمهمات الوقاية'), findsOneWidget);
    expect(find.text('98%'), findsOneWidget);

    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  });

  testWidgets('Test 2: Renders quick action buttons', (WidgetTester tester) async {
    await tester.pumpWidget(createWidgetUnderTest());
    await tester.pumpAndSettle();

    expect(find.text('طلب تصريح عمل'), findsOneWidget);
    expect(find.text('إبلاغ عن خطر/حادث'), findsOneWidget);
  });

  testWidgets('Test 3: Renders active safety permits list', (WidgetTester tester) async {
    await tester.pumpWidget(createWidgetUnderTest());
    await tester.pumpAndSettle();

    expect(find.text('تصاريح العمل النشطة'), findsOneWidget);
    expect(find.text('عمل حار - خط الإنتاج 3'), findsOneWidget);
    expect(find.text('مقبول'), findsOneWidget);
    expect(find.text('أماكن مغلقة - خزان 2'), findsOneWidget);
    expect(find.text('قيد المراجعة'), findsOneWidget);
  });

  testWidgets('Test 4: Shows apply permit modal on button tap', (WidgetTester tester) async {
    await tester.pumpWidget(createWidgetUnderTest());
    await tester.pumpAndSettle();

    await tester.tap(find.text('طلب تصريح عمل'));
    await tester.pumpAndSettle();

    expect(find.byType(ApplyPermitSheet), findsOneWidget);
    expect(find.text('طلب تصريح عمل جديد'), findsOneWidget);
  });

  testWidgets('Test 5: Form validates permit type selection', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(
      locale: Locale('ar'),
      home: Scaffold(body: ApplyPermitSheet()),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('إرسال الطلب'));
    await tester.pumpAndSettle();

    expect(find.text('يرجى اختيار نوع التصريح'), findsOneWidget);
  });
}
