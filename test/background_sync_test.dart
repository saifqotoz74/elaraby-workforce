import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/network/connectivity_service.dart';
import 'package:elaraby_workforce/core/services/background_sync_service.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/storage/offline_database.dart';
import 'package:elaraby_workforce/features/services/data/shift_model.dart';
import 'package:elaraby_workforce/features/services/presentation/controllers/shifts_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory testDir;
  late OfflineDatabase db;
  late BackgroundSyncService syncService;

  void setOnline(bool online) {
    ConnectivityService.instance.setMockOnline(online);
    Backend.instance.online.value = online;
  }

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();

    testDir = Directory('${Directory.systemTemp.path}/bg_sync_test_${DateTime.now().microsecondsSinceEpoch}');
    if (!testDir.existsSync()) {
      testDir.createSync(recursive: true);
    }

    db = OfflineDatabase.forTesting(
      baseDirectory: testDir,
      overrideKey: 'TEST_MASTER_KEY_0123456789012345',
    );
    await db.initialize();
    OfflineDatabase.setInstanceForTesting(db);

    setOnline(false);

    syncService = BackgroundSyncService.forTesting(
      database: db,
      connectivity: ConnectivityService.instance,
      backend: Backend.instance,
    );
    BackgroundSyncService.setInstanceForTesting(syncService);

    // Default mock HTTP client that returns empty ok
    ApiClient.instance.client = MockClient((request) async {
      return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
    });
  });

  tearDown(() async {
    syncService.stop();
    syncService.resetForTesting();
    ConnectivityService.instance.setMockOnline(null);
    Backend.instance.online.value = true;
    ApiClient.instance.client = http.Client();

    OfflineDatabase.resetInstanceForTesting();
    BackgroundSyncService.resetInstanceForTesting();

    await db.closeAndPurge();
    if (testDir.existsSync()) {
      try {
        testDir.deleteSync(recursive: true);
      } catch (_) {}
    }
  });

  // ============================================================================
  // GROUP 1: REACTIVE CONNECTIVITY AUTO-TRIGGER (OFFLINE -> ONLINE)
  // ============================================================================

  group('Group 1: Reactive Connectivity Auto-Trigger (Offline -> Online)', () {
    test('1.1 Automatic Sync Trigger upon Reconnection', () async {
      // 1. Start in offline state with a pending punch
      setOnline(false);

      const punch = OfflinePunch(
        clientPunchId: 'reconnect-punch-101',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: '2026-09-21T07:15:00.000Z',
        latitude: 30.5852,
        longitude: 31.5034,
        offlineToken: 'OFFLINE-EG-20481-QUESNA-1726938000000',
      );
      await db.enqueuePunch(punch);

      expect((await db.getPendingPunches()).length, equals(1));

      // 2. Set up MockClient returning accepted bulk sync
      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/attendance/bulk-sync')) {
          return http.Response(
            jsonEncode({
              'ok': true,
              'totalProcessed': 1,
              'acceptedCount': 1,
              'duplicateCount': 0,
              'results': [
                {
                  'clientPunchId': 'reconnect-punch-101',
                  'status': 'accepted',
                  'punchId': 'att_rec_101',
                }
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      // 3. Start sync service listener
      syncService.start();

      // Punch must still be pending before reconnection
      expect((await db.getPendingPunches()).length, equals(1));

      // 4. Reconnect network: false -> true
      final syncFuture = syncService.onSyncCompleted.first;
      setOnline(true);

      // Wait for auto-triggered sync completion
      final result = await syncFuture.timeout(const Duration(seconds: 3));

      expect(result.success, isTrue);
      expect(result.punchesSynced, equals(1));

      // 5. Verify punch queue is completely drained
      final pendingPunches = await db.getPendingPunches();
      expect(pendingPunches.isEmpty, isTrue);

      final allPunches = await db.getAllPunches();
      expect(allPunches.length, equals(1));
      expect(allPunches.first.status, equals('synced'));
    });

    test('1.2 No-op When Connection State Remains Unchanged', () async {
      setOnline(true);
      syncService.start();

      // Waiting briefly
      await Future.delayed(const Duration(milliseconds: 50));

      // Emitting same online status (true -> true)
      setOnline(true);

      // Verify no duplicate cycle triggered
      expect(syncService.isSyncing, isFalse);
    });
  });

  // ============================================================================
  // GROUP 2: EXPONENTIAL BACKOFF & FULL JITTER CALCULATION
  // ============================================================================

  group('Group 2: Exponential Backoff & Full Jitter Calculation', () {
    test('2.1 Mathematical Scaling of Exponential Backoff (1.5s to 60s)', () {
      expect(BackgroundSyncService.initialIntervalSeconds, equals(1.5));
      expect(BackgroundSyncService.backoffMultiplier, equals(2.0));
      expect(BackgroundSyncService.maxBackoffSeconds, equals(60.0));

      // Attempt 0: 1.5 * 2^0 = 1.5s (1500ms)
      expect(syncService.calculateBackoffDelay(0), equals(const Duration(milliseconds: 1500)));

      // Attempt 1: 1.5 * 2^1 = 3.0s (3000ms)
      expect(syncService.calculateBackoffDelay(1), equals(const Duration(milliseconds: 3000)));

      // Attempt 2: 1.5 * 2^2 = 6.0s (6000ms)
      expect(syncService.calculateBackoffDelay(2), equals(const Duration(milliseconds: 6000)));

      // Attempt 3: 1.5 * 2^3 = 12.0s (12000ms)
      expect(syncService.calculateBackoffDelay(3), equals(const Duration(milliseconds: 12000)));

      // Attempt 4: 1.5 * 2^4 = 24.0s (24000ms)
      expect(syncService.calculateBackoffDelay(4), equals(const Duration(milliseconds: 24000)));

      // Attempt 5: 1.5 * 2^5 = 48.0s (48000ms)
      expect(syncService.calculateBackoffDelay(5), equals(const Duration(milliseconds: 48000)));

      // Attempt 6: 1.5 * 2^6 = 96.0s -> Clamped to max 60.0s (60000ms)
      expect(syncService.calculateBackoffDelay(6), equals(const Duration(milliseconds: 60000)));

      // Attempt 10: Clamped strictly to max 60.0s (60000ms)
      expect(syncService.calculateBackoffDelay(10), equals(const Duration(milliseconds: 60000)));
    });

    test('2.2 Full Jitter Distribution Bounds and Spread', () {
      // At attempt 3, base cap is 12000ms. Full jitter sleep must be in [0, 12000]ms.
      final samples = List.generate(100, (_) {
        return syncService.calculateBackoffWithFullJitter(3).inMilliseconds;
      });

      for (final sample in samples) {
        expect(sample, greaterThanOrEqualTo(0));
        expect(sample, lessThanOrEqualTo(12000));
      }

      // Verify non-deterministic distribution across factory workers
      final distinctSamples = samples.toSet();
      expect(distinctSamples.length, greaterThan(15));
    });

    test('2.3 Deterministic Random Injection for Testing', () {
      final deterministicRng = math.Random(12345);
      final testSvc = BackgroundSyncService.forTesting(
        database: db,
        connectivity: ConnectivityService.instance,
        backend: Backend.instance,
        customRandom: deterministicRng,
      );

      final delay0 = testSvc.calculateBackoffWithFullJitter(0);
      expect(delay0.inMilliseconds, greaterThanOrEqualTo(0));
      expect(delay0.inMilliseconds, lessThanOrEqualTo(1500));
    });

    test('2.4 Circuit Breaker & Max Retry Cap at 5 Attempts', () {
      expect(BackgroundSyncService.maxRetryAttempts, equals(5));
      expect(syncService.currentRetryAttempt, equals(0));
    });
  });

  // ============================================================================
  // GROUP 3: BULK PUNCH WIRE DISPATCH & SERVER RECONCILIATION
  // ============================================================================

  group('Group 3: Bulk Punch Wire Dispatch & Server Reconciliation', () {
    test('3.1 Bulk Punch Serialization to POST /api/attendance/bulk-sync', () async {
      // 1. Enqueue 2 punches
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'bulk-punch-1',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: 1726902900000,
        latitude: 30.5852,
        longitude: 31.5034,
        offlineToken: 'OFFLINE-TOKEN-1',
      ));

      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'bulk-punch-2',
        employeeId: 'EG-20481',
        type: 'check-out',
        timestamp: 1726938900000,
        latitude: 30.5853,
        longitude: 31.5035,
        offlineToken: 'OFFLINE-TOKEN-2',
      ));

      bool intercepted = false;
      List<dynamic>? interceptedPunches;

      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/attendance/bulk-sync')) {
          intercepted = true;
          expect(request.method, equals('POST'));
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          interceptedPunches = body['punches'] as List<dynamic>;

          return http.Response(
            jsonEncode({
              'ok': true,
              'totalProcessed': 2,
              'acceptedCount': 2,
              'duplicateCount': 0,
              'results': [
                {'clientPunchId': 'bulk-punch-1', 'status': 'accepted', 'punchId': 'att_101'},
                {'clientPunchId': 'bulk-punch-2', 'status': 'accepted', 'punchId': 'att_102'},
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      // 2. Set online and trigger sync
      setOnline(true);
      final result = await syncService.triggerSync();

      expect(intercepted, isTrue);
      expect(result.success, isTrue);
      expect(result.punchesSynced, equals(2));
      expect(result.punchesDuplicates, equals(0));
      expect(result.punchesFailed, equals(0));

      // 3. Inspect serialized wire payload
      expect(interceptedPunches, isNotNull);
      expect(interceptedPunches!.length, equals(2));

      final first = interceptedPunches![0] as Map<String, dynamic>;
      expect(first['clientPunchId'], equals('bulk-punch-1'));
      expect(first['employeeId'], equals('EG-20481'));
      expect(first['type'], equals('in'));
      expect(first['timestamp'], equals(1726902900000));
      expect(first['latitude'], equals(30.5852));
      expect(first['longitude'], equals(31.5034));
      expect(first['offlineToken'], equals('OFFLINE-TOKEN-1'));

      final second = interceptedPunches![1] as Map<String, dynamic>;
      expect(second['clientPunchId'], equals('bulk-punch-2'));
      expect(second['type'], equals('out'));
      expect(second['timestamp'], equals(1726938900000));

      // 4. Verify database state
      expect((await db.getPendingPunches()).isEmpty, isTrue);
      expect((await db.getAllPunches()).length, equals(2));
    });

    test('3.2 Reconciliation of Accepted vs Duplicate Server Responses (120s Deduplication Window)', () async {
      // 3 punches: punch_A (accepted), punch_B (duplicate from prior upload), punch_C (accepted)
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'punch_A',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: 1726902900000,
      ));
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'punch_B',
        employeeId: 'EG-20481',
        type: 'check-out',
        timestamp: 1726938900000,
      ));
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'punch_C',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: 1726980000000,
      ));

      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/attendance/bulk-sync')) {
          return http.Response(
            jsonEncode({
              'ok': true,
              'totalProcessed': 3,
              'acceptedCount': 2,
              'duplicateCount': 1,
              'results': [
                {'clientPunchId': 'punch_A', 'status': 'accepted', 'punchId': 'att_201'},
                {'clientPunchId': 'punch_B', 'status': 'duplicate', 'punchId': 'att_200'},
                {'clientPunchId': 'punch_C', 'status': 'accepted', 'punchId': 'att_202'},
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      setOnline(true);
      final result = await syncService.triggerSync();

      expect(result.success, isTrue);
      expect(result.punchesSynced, equals(2));
      expect(result.punchesDuplicates, equals(1));
      expect(result.punchesFailed, equals(0));

      // Both accepted and duplicate punches MUST be marked synced in OfflineDatabase
      final pending = await db.getPendingPunches();
      expect(pending.isEmpty, isTrue);

      final all = await db.getAllPunches();
      expect(all.length, equals(3));
      for (final p in all) {
        expect(p.status, equals('synced'));
      }
    });

    test('3.3 Server 500 Error Leaves Punches Pending and Increments Retry Count', () async {
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'punch_fail_server_err',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: 1726902900000,
        retryCount: 0,
      ));

      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/attendance/bulk-sync')) {
          return http.Response(
            jsonEncode({'ok': false, 'error': 'Internal Server Error'}),
            500,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      setOnline(true);
      final result = await syncService.triggerSync();

      expect(result.success, isFalse);
      expect(result.punchesFailed, equals(1));

      // Punch must remain pending in queue with retryCount incremented
      final pending = await db.getPendingPunches();
      expect(pending.length, equals(1));
      expect(pending.first.clientPunchId, equals('punch_fail_server_err'));
      expect(pending.first.status, equals('pending'));
      expect(pending.first.retryCount, equals(1));
      expect(pending.first.errorMessage, isNotNull);
    });
  });

  // ============================================================================
  // GROUP 4: AUTOMATED DATA CONFLICT RESOLUTION
  // ============================================================================

  group('Group 4: Automated Data Conflict Resolution', () {
    test('4.1 Shift Schedules: Server-Wins Authority Overrides Local Cache', () async {
      // 1. Seed local cache with local supervisor and morning shift
      final localWeek = [
        ShiftWeek(
          weekStart: '2026-09-20',
          isCurrent: true,
          days: [
            const WorkShift(
              dayEn: 'Sun',
              dayAr: 'الأحد',
              date: '2026-09-20',
              shift: 'morning',
              name: 'Morning Shift',
              shiftNameAr: 'صباحي',
              time: '07:00 - 15:00',
              timeAr: '07:00 - 15:00',
              supervisor: 'Supervisor Local Old',
            ),
          ],
        ),
      ];
      await db.saveSchedules(localWeek);

      // Verify local state
      var cached = await db.getCachedSchedules();
      expect(cached.first.days.first.supervisor, equals('Supervisor Local Old'));
      expect(cached.first.days.first.shift, equals('morning'));

      // 2. Server provides updated schedule with evening shift and new supervisor
      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/shifts/roster')) {
          return http.Response(
            jsonEncode({
              'weeks': [
                {
                  'weekStart': '2026-09-20',
                  'isCurrent': true,
                  'days': [
                    {
                      'dayEn': 'Sun',
                      'dayAr': 'الأحد',
                      'date': '2026-09-20',
                      'shift': 'evening',
                      'name': 'Evening Shift',
                      'shiftNameAr': 'مسائي',
                      'time': '15:00 - 23:00',
                      'timeAr': '15:00 - 23:00',
                      'supervisor': 'Supervisor Server Master',
                    }
                  ],
                }
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      // 3. Set online and trigger sync cycle
      setOnline(true);
      await syncService.triggerSync();

      // 4. Server-Wins: Local cached schedule must unconditionally match server
      cached = await db.getCachedSchedules();
      expect(cached.length, equals(1));
      expect(cached.first.days.first.supervisor, equals('Supervisor Server Master'));
      expect(cached.first.days.first.shift, equals('evening'));
    });

    test('4.2 Attendance Punch: Client-Wins Authority Preserves Physical Device Timestamp', () async {
      const recordedClientTimeMs = 1726902915000; // 07:15:15 AM
      const punch = OfflinePunch(
        clientPunchId: 'client-wins-punch-77',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: recordedClientTimeMs,
        latitude: 30.5852,
        longitude: 31.5034,
        offlineToken: 'OFFLINE-HMAC-VERIFIED-TOKEN',
      );
      await db.enqueuePunch(punch);

      int? wireTimestamp;
      String? wireToken;

      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/attendance/bulk-sync')) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          final punchesList = body['punches'] as List<dynamic>;
          wireTimestamp = punchesList.first['timestamp'] as int?;
          wireToken = punchesList.first['offlineToken'] as String?;

          return http.Response(
            jsonEncode({
              'ok': true,
              'totalProcessed': 1,
              'acceptedCount': 1,
              'duplicateCount': 0,
              'results': [
                {'clientPunchId': 'client-wins-punch-77', 'status': 'accepted', 'punchId': 'att_client_wins'}
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      setOnline(true);
      await syncService.triggerSync();

      // Verify exact physical client timestamp and token were dispatched to server
      expect(wireTimestamp, equals(recordedClientTimeMs));
      expect(wireToken, equals('OFFLINE-HMAC-VERIFIED-TOKEN'));
      expect((await db.getPendingPunches()).isEmpty, isTrue);
    });

    test('4.3 HR Requests: Last-Write-Wins with Idempotency Key Deduping', () async {
      const hrReq = PendingHrRequest(
        idempotencyKey: 'idemp-leave-dedupe-key-99',
        id: 'req_local_99',
        type: 'Leave',
        payload: {
          'title': 'Emergency Leave',
          'days': 2,
        },
        createdAt: '2026-09-21T08:00:00.000Z',
      );
      await db.enqueueRequest(hrReq);

      String? sentIdempotencyKey;
      ApiClient.instance.client = MockClient((request) async {
        if (request.url.path.contains('/requests')) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          sentIdempotencyKey = body['idempotencyKey'] as String?;

          return http.Response(
            jsonEncode({
              'ok': true,
              'request': {
                'id': 'srv_req_99',
                'title': 'Emergency Leave',
                'type': 'Leave',
                'refNumber': 'LEV-2026-99',
                'status': 'inReview',
                'date': 'Today',
                'summary': 'Submitted',
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{"ok": true}', 200, headers: {'content-type': 'application/json'});
      });

      setOnline(true);
      await syncService.triggerSync();

      // Verified idempotency key was forwarded to server
      expect(sentIdempotencyKey, equals('idemp-leave-dedupe-key-99'));

      // Verified request is marked synced in database
      final pending = await db.getPendingRequests();
      expect(pending.isEmpty, isTrue);
    });
  });

  // ============================================================================
  // GROUP 5: SHIFTS CONTROLLER INTEGRATION & OPTIMISTIC OFFLINE OPERATION
  // ============================================================================

  group('Group 5: Shifts Controller Integration & Optimistic Offline Operation', () {
    test('5.1 AttendanceNotifier.punch() Enqueues Offline Punch Optimistically When Offline', () async {
      setOnline(false);

      final notifier = AttendanceNotifier();

      // Punch check-in while offline
      final success = await notifier.punch('in', lat: 30.5852, lng: 31.5034);

      expect(success, isTrue);

      // Optimistic UI state update must reflect checked_in immediately
      expect(notifier.state.hasData, isTrue);
      expect(notifier.state.data?.status, equals('checked_in'));
      expect(notifier.state.data?.punchInTime, isNotEmpty);

      // Verify punch record is securely persisted in OfflineDatabase
      final pendingPunches = await db.getPendingPunches();
      expect(pendingPunches.length, equals(1));
      expect(pendingPunches.first.type, equals('check-in'));
      expect(pendingPunches.first.latitude, equals(30.5852));
      expect(pendingPunches.first.longitude, equals(31.5034));
      expect(pendingPunches.first.status, equals('pending'));
    });

    test('5.2 AttendanceNotifier.loadToday() Recovers Pending Offline Punch State', () async {
      // 1. Enqueue offline check-in punch in OfflineDatabase
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'today-recovery-punch-1',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: '2026-09-21T07:30:00.000Z',
        latitude: 30.5852,
        longitude: 31.5034,
        qrToken: 'OFFLINE-RECOVERED-QR',
        offlineToken: 'OFFLINE-RECOVERED-HMAC',
      ));

      setOnline(false);

      // 2. Load today state while offline
      final notifier = AttendanceNotifier();
      await notifier.loadToday();

      expect(notifier.state.hasData, isTrue);
      expect(notifier.state.data?.status, equals('checked_in'));
      expect(notifier.state.data?.qrToken, equals('OFFLINE-RECOVERED-QR'));
      expect(notifier.state.data?.offlineToken, equals('OFFLINE-RECOVERED-HMAC'));
    });

    test('5.3 RosterNotifier.loadRoster() Loads Cached Schedules When Offline', () async {
      // 1. Seed OfflineDatabase with custom cached schedules
      final customWeeks = [
        ShiftWeek(
          weekStart: '2026-09-20',
          isCurrent: true,
          days: [
            const WorkShift(
              dayEn: 'Sun',
              dayAr: 'الأحد',
              date: '2026-09-20',
              shift: 'morning',
              name: 'Quesna Plant Shift A',
              shiftNameAr: 'وردية مصنع قويسنا أ',
              time: '07:00 AM – 03:00 PM',
              timeAr: '07:00 ص – 03:00 م',
              supervisor: 'Eng. Tareq Elaraby',
            ),
          ],
        ),
      ];
      await db.saveSchedules(customWeeks);

      setOnline(false);

      // 2. Call loadRoster while offline
      final rosterNotifier = RosterNotifier();
      await rosterNotifier.loadRoster();

      expect(rosterNotifier.state.hasData, isTrue);
      final loadedWeeks = rosterNotifier.state.data!;
      expect(loadedWeeks.length, equals(1));
      expect(loadedWeeks.first.days.first.name, equals('Quesna Plant Shift A'));
      expect(loadedWeeks.first.days.first.supervisor, equals('Eng. Tareq Elaraby'));
    });
  });
}
