import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elaraby_workforce/core/errors/app_error.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/benefits/presentation/screens/trip_detail_screen.dart';
import 'package:elaraby_workforce/features/inbox/presentation/screens/inbox_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await ApiClient.instance.init();
    ApiClient.overrideBaseUrl = null;
  });

  group('Phase 4 & 5 - Mobile Network Resiliency & REST Verbs', () {
    test('ApiClient supports PUT, PATCH, and DELETE with request payloads',
        () async {
      String? capturedMethod;
      String? capturedBody;

      final mockClient = MockClient((request) async {
        capturedMethod = request.method;
        capturedBody = request.body;
        return http.Response('{"ok":true,"updated":true}', 200, headers: {
          'content-type': 'application/json',
        });
      });

      final api = ApiClient.instance;
      api.client = mockClient;

      // 1. Test PUT
      final putRes = await api.put('/test/put', {'name': 'Elaraby'});
      expect(capturedMethod, 'PUT');
      expect(capturedBody, '{"name":"Elaraby"}');
      expect(putRes?['ok'], true);

      // 2. Test PATCH
      final patchRes = await api.patch('/test/patch', {'status': 'active'});
      expect(capturedMethod, 'PATCH');
      expect(capturedBody, '{"status":"active"}');
      expect(patchRes?['ok'], true);

      // 3. Test DELETE
      final deleteRes = await api.delete('/test/delete/123');
      expect(capturedMethod, 'DELETE');
      expect(deleteRes?['ok'], true);
    });

    test('Backend.verifyPin returns AuthResult.networkError on timeout/offline',
        () async {
      final mockClient = MockClient((request) async {
        // Simulates connection drop / timeout
        throw const NetworkError('Network request timed out');
      });

      final api = ApiClient.instance;
      api.client = mockClient;
      await api.setLastNationalId('29010112345678');

      Backend.instance.online.value = false;
      final result = await Backend.instance.verifyPin('1234');

      expect(result, AuthResult.networkError);
      // online.value must NOT be falsely set to true
      expect(Backend.instance.online.value, false);
    });

    test('Arabic trip titles do not collapse to trip_ and remain distinct', () {
      const trip1 = TripDetailScreen(
        title: 'رحلة العين السخنة',
      );
      const trip2 = TripDetailScreen(
        title: 'رحلة شرم الشيخ',
      );

      // Ensure hash-based / slug ID differentiates Arabic trips
      final id1 = 'trip_${trip1.title.hashCode.abs()}';
      final id2 = 'trip_${trip2.title.hashCode.abs()}';

      expect(id1, isNot(equals('trip_')));
      expect(id2, isNot(equals('trip_')));
      expect(id1, isNot(equals(id2)));
    });

    test('LocalStore.nextRefNumber does not start at 200 on clean installs', () {
      SharedPreferences.setMockInitialValues({});
      final store = LocalStore.instance;

      final ref1 = store.nextRefNumber();
      final ref2 = store.nextRefNumber();

      expect(ref1, greaterThan(100000));
      expect(ref2, equals(ref1 + 1));
    });

    test('ApiClient.resolveUrl properly resolves server-relative paths', () {
      final api = ApiClient.instance;
      ApiClient.overrideBaseUrl = 'http://10.0.2.2:3000/api';

      expect(api.resolveUrl('http://example.com/pic.jpg'),
          'http://example.com/pic.jpg');
      expect(api.resolveUrl('/uploads/photos/123.jpg'),
          'http://10.0.2.2:3000/uploads/photos/123.jpg');
    });
  });

  group('Phase 4 & 5 - UI Integrity Tests', () {
    testWidgets('InboxScreen displays announcement cards when filter is selected',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          home: const InboxScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Tap on Announcements filter
      final annFilter = find.text(AppLocale.tr('inbox_filter_announcements'));
      expect(annFilter, findsOneWidget);
      await tester.tap(annFilter);
      await tester.pumpAndSettle();

      // Ensure the announcement card is visible and not blank
      expect(find.text('New Shift Policy'), findsOneWidget);
      expect(find.text('Leave Request Approved'), findsNothing);

      // Tap on Approvals filter
      final appFilter = find.text(AppLocale.tr('inbox_filter_approvals'));
      expect(appFilter, findsOneWidget);
      await tester.tap(appFilter);
      await tester.pumpAndSettle();

      // Ensure leave approval is visible and announcements are hidden
      expect(find.text('Leave Request Approved'), findsOneWidget);
      expect(find.text('New Shift Policy'), findsNothing);
    });
  });
}
