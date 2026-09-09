import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elaraby_workforce/core/data_sources/local_storage_data_source.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/push_service.dart';
import 'package:elaraby_workforce/core/repositories/settings_repository.dart';
import 'package:elaraby_workforce/features/profile/presentation/controllers/settings_controller.dart';
import 'package:elaraby_workforce/l10n/generated/app_localizations.dart';

void main() {
  late SharedPreferences prefs;
  late LocalStorageDataSource storage;
  late SettingsRepository repo;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    storage = LocalStorageDataSource(prefs: prefs);
    repo = SettingsRepositoryImpl(storage: storage);
    ApiClient.offlineMockMode = false;
  });

  tearDown(() {
    PushService.instance.setMockPermissionStatus(null);
  });

  group('Phase 12: Notification Permission Deferral & Startup Audit', () {
    test(
        'PushService.init() initializes without requesting permission at startup',
        () async {
      PushService.instance.setMockPermissionStatus(null);
      // init() must complete without throwing and without triggering permission dialog
      await PushService.instance.init();
      // By default without contextual request, status remains unprompted/denied
      expect(PushService.instance.permissionStatus,
          equals(NotificationPermissionStatus.denied));
    });
  });

  group(
      'Phase 12: Contextual Permission Handling (Granted, Denied, PermanentlyDenied)',
      () {
    test(
        'Handles granted permission: updates state to enabled and returns granted',
        () async {
      PushService.instance
          .setMockPermissionStatus(NotificationPermissionStatus.granted);
      final notifier = SettingsNotifier(repo);

      final status = await notifier.setNotifications(true);

      expect(status, equals(NotificationPermissionStatus.granted));
      expect(notifier.state.notificationsEnabled, isTrue);
      expect(repo.notificationsEnabled, isTrue);
    });

    test('Handles denied permission: keeps state disabled and returns denied',
        () async {
      PushService.instance
          .setMockPermissionStatus(NotificationPermissionStatus.denied);
      final notifier = SettingsNotifier(repo);

      final status = await notifier.setNotifications(true);

      expect(status, equals(NotificationPermissionStatus.denied));
      expect(notifier.state.notificationsEnabled, isFalse);
      expect(repo.notificationsEnabled, isFalse);
    });

    test(
        'Handles permanentlyDenied permission: keeps state disabled and returns permanentlyDenied',
        () async {
      PushService.instance.setMockPermissionStatus(
          NotificationPermissionStatus.permanentlyDenied);
      final notifier = SettingsNotifier(repo);

      final status = await notifier.setNotifications(true);

      expect(status, equals(NotificationPermissionStatus.permanentlyDenied));
      expect(notifier.state.notificationsEnabled, isFalse);
      expect(repo.notificationsEnabled, isFalse);
    });

    test('Disabling notifications transitions state to false and unregisters',
        () async {
      final notifier = SettingsNotifier(repo);
      // First enable
      PushService.instance
          .setMockPermissionStatus(NotificationPermissionStatus.granted);
      await notifier.setNotifications(true);
      expect(notifier.state.notificationsEnabled, isTrue);

      // Now disable
      final status = await notifier.setNotifications(false);
      expect(status, equals(NotificationPermissionStatus.denied));
      expect(notifier.state.notificationsEnabled, isFalse);
      expect(repo.notificationsEnabled, isFalse);
    });
  });

  group('Phase 12: Contextual UI Feedback for Notification Permissions', () {
    testWidgets(
        'Shows success SnackBar when permission is granted from Settings UI',
        (tester) async {
      PushService.instance
          .setMockPermissionStatus(NotificationPermissionStatus.granted);
      AppLocale.instance.setLocale(const Locale('en'));

      late SettingsNotifier notifier;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: Builder(
              builder: (context) {
                notifier = SettingsNotifier(repo);
                return ElevatedButton(
                  onPressed: () =>
                      notifier.setNotifications(true, context: context),
                  child: const Text('Enable Notifications'),
                );
              },
            ),
          ),
        ),
      );

      await tester.tap(find.text('Enable Notifications'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Notifications enabled successfully'), findsOneWidget);
    });

    testWidgets(
        'Shows warning SnackBar when permission is denied from Settings UI',
        (tester) async {
      PushService.instance
          .setMockPermissionStatus(NotificationPermissionStatus.denied);
      AppLocale.instance.setLocale(const Locale('en'));

      late SettingsNotifier notifier;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: Builder(
              builder: (context) {
                notifier = SettingsNotifier(repo);
                return ElevatedButton(
                  onPressed: () =>
                      notifier.setNotifications(true, context: context),
                  child: const Text('Enable Notifications'),
                );
              },
            ),
          ),
        ),
      );

      await tester.tap(find.text('Enable Notifications'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Notification permission was denied'), findsOneWidget);
    });

    testWidgets(
        'Shows system settings warning SnackBar when permanently denied',
        (tester) async {
      PushService.instance.setMockPermissionStatus(
          NotificationPermissionStatus.permanentlyDenied);
      AppLocale.instance.setLocale(const Locale('en'));

      late SettingsNotifier notifier;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: Builder(
              builder: (context) {
                notifier = SettingsNotifier(repo);
                return ElevatedButton(
                  onPressed: () =>
                      notifier.setNotifications(true, context: context),
                  child: const Text('Enable Notifications'),
                );
              },
            ),
          ),
        ),
      );

      await tester.tap(find.text('Enable Notifications'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(
          find.textContaining('Notifications are blocked in system settings'),
          findsOneWidget);
    });
  });
}
