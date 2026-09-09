import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/utils/debouncer.dart';
import 'package:elaraby_workforce/core/data_sources/local_storage_data_source.dart';
import 'package:elaraby_workforce/core/repositories/drafts_repository.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/features/services/presentation/screens/request_leave_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 8 - Debouncer Unit Tests', () {
    test('Debouncer delays action execution until delay duration passes',
        () async {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 50));
      int callCount = 0;

      debouncer.run(() {
        callCount++;
      });

      expect(debouncer.hasPending, isTrue);
      expect(callCount, 0);

      // Wait half the delay
      await Future.delayed(const Duration(milliseconds: 25));
      expect(callCount, 0);

      // Wait past the delay
      await Future.delayed(const Duration(milliseconds: 35));
      expect(callCount, 1);
      expect(debouncer.hasPending, isFalse);
    });

    test('Debouncer debounces multiple rapid calls to execute only the last',
        () async {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 60));
      String lastExecuted = '';
      int totalCalls = 0;

      for (int i = 1; i <= 5; i++) {
        debouncer.run(() {
          totalCalls++;
          lastExecuted = 'call_$i';
        });
        await Future.delayed(const Duration(milliseconds: 10));
      }

      expect(totalCalls, 0);
      expect(debouncer.hasPending, isTrue);

      // Let the final timer finish
      await Future.delayed(const Duration(milliseconds: 80));
      expect(totalCalls, 1);
      expect(lastExecuted, 'call_5');
      expect(debouncer.hasPending, isFalse);
    });

    test('Debouncer.flush() runs pending action immediately and cancels timer',
        () async {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 200));
      bool executed = false;

      debouncer.run(() {
        executed = true;
      });

      expect(debouncer.hasPending, isTrue);
      expect(executed, isFalse);

      debouncer.flush();
      expect(executed, isTrue);
      expect(debouncer.hasPending, isFalse);

      // Ensure timer doesn't fire a second time later
      await Future.delayed(const Duration(milliseconds: 250));
      expect(executed, isTrue);
    });

    test('Debouncer.cancel() cancels pending action without executing',
        () async {
      final debouncer = Debouncer(delay: const Duration(milliseconds: 50));
      bool executed = false;

      debouncer.run(() {
        executed = true;
      });

      expect(debouncer.hasPending, isTrue);
      debouncer.cancel();
      expect(debouncer.hasPending, isFalse);

      await Future.delayed(const Duration(milliseconds: 60));
      expect(executed, isFalse);
    });
  });

  group('Phase 8 - Drafts Performance & Local Storage Tests', () {
    late SharedPreferences prefs;
    late LocalStorageDataSource storage;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
      storage = LocalStorageDataSource(prefs: prefs);
    });

    test(
        'DraftsRepository uses normal local storage and fast in-memory caching',
        () async {
      final draftsRepo = DraftsRepositoryImpl(storage: storage);

      // Saving draft
      final draftData = {
        'category': 'Equipment',
        'details': 'Assembly line conveyor noise',
        'urgency': 'medium',
      };

      await draftsRepo.saveDraft('raise_concern', draftData);

      // Verification: Stored in standard storage, not requiring secure storage
      expect(prefs.getString('draft_raise_concern'), isNotNull);

      // Fast synchronous retrieval through memory cache
      final retrieved = draftsRepo.getDraft('raise_concern');
      expect(retrieved, isNotNull);
      expect(retrieved!['details'], 'Assembly line conveyor noise');

      // Clear draft removes from both cache and prefs
      await draftsRepo.clearDraft('raise_concern');
      expect(draftsRepo.getDraft('raise_concern'), isNull);
      expect(prefs.getString('draft_raise_concern'), isNull);
    });

    test('LocalStore saves drafts without secure storage and clears cleanly',
        () async {
      await LocalStore.instance.init();

      final draft = {
        'leaveType': 'Sick Leave',
        'notes': 'Flu symptoms',
      };

      await LocalStore.instance.saveDraft('leave_request', draft);

      final read = LocalStore.instance.getDraft('leave_request');
      expect(read, isNotNull);
      expect(read!['leaveType'], 'Sick Leave');
      expect(read['notes'], 'Flu symptoms');

      await LocalStore.instance.clearDraft('leave_request');
      expect(LocalStore.instance.getDraft('leave_request'), isNull);
    });
  });

  group('Phase 8 - Widget Debounce & Draft Autosave Integration Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await LocalStore.instance.init();
      AppLocale.instance.setLocale(const Locale('en'));
    });

    testWidgets(
        'RequestLeaveScreen debounces draft saves and flushes on dispose',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          home: const RequestLeaveScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Enter notes in text field
      final textFieldFinder = find.byType(TextField).last;
      await tester.enterText(textFieldFinder, 'Emergency personal matter');
      await tester.pump();

      // Right after typing, debouncer has not fired yet (delay is 600ms)
      // Draft should not be immediately saved
      expect(LocalStore.instance.getDraft('leave_request'), isNull);

      // Advance by 700ms to allow debounce timer to execute
      await tester.pump(const Duration(milliseconds: 700));

      final savedDraft = LocalStore.instance.getDraft('leave_request');
      expect(savedDraft, isNotNull);
      expect(savedDraft!['notes'], 'Emergency personal matter');

      // Now test flush on dispose: type more and dispose before debounce fires
      await tester.enterText(textFieldFinder, 'Updated emergency notes');
      await tester.pump();

      // Replace widget tree to trigger dispose()
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: Text('Disposed'))),
      );
      await tester.pumpAndSettle();

      // On dispose, flush() executes immediately so latest notes are preserved
      final flushedDraft = LocalStore.instance.getDraft('leave_request');
      expect(flushedDraft, isNotNull);
      expect(flushedDraft!['notes'], 'Updated emergency notes');
    });
  });
}
