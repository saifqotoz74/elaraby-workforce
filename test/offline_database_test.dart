import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/storage/offline_database.dart';
import 'package:elaraby_workforce/features/services/data/shift_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory testDir;
  late OfflineDatabase db;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    testDir = Directory('${Directory.systemTemp.path}/offline_db_test_${DateTime.now().microsecondsSinceEpoch}');
    if (!testDir.existsSync()) {
      testDir.createSync(recursive: true);
    }
    db = OfflineDatabase.forTesting(
      baseDirectory: testDir,
      overrideKey: 'TEST_MASTER_KEY_0123456789012345', // 32 bytes padded
    );
    await db.initialize();
  });

  tearDown(() async {
    await db.closeAndPurge();
    if (testDir.existsSync()) {
      try {
        testDir.deleteSync(recursive: true);
      } catch (_) {}
    }
  });

  group('Group 1: Master Key Management & AES-256 Authenticated Cipher Roundtrip', () {
    test('1.1 Automatic Master Cipher Key Generation & Test Fallback', () async {
      expect(db.isInitialized, isTrue);
      expect(db.cipher, isNotNull);
      expect(OfflineDatabase.isTestEnvironment(), isTrue);
    });

    test('1.2 AES-256 Authenticated Encryption & Decryption Roundtrip', () {
      const plaintext = '{"nationalId":"29801011234567","salary":15500,"name":"Ahmed Ghannam"}';
      final encryptedBase64 = db.encryptString(plaintext);

      expect(encryptedBase64, isNotEmpty);
      // Ensure ciphertext does not contain plaintext sensitive string
      expect(encryptedBase64.contains('29801011234567'), isFalse);
      expect(encryptedBase64.contains('Ahmed Ghannam'), isFalse);

      final rawCipher = base64Decode(encryptedBase64);
      // Container layout: Version (1) + IV (16) + HMAC-SHA256 (32) + Ciphertext (>= 16)
      expect(rawCipher.length, greaterThanOrEqualTo(1 + 16 + 32 + 16));
      expect(rawCipher[0], equals(1)); // Version 1

      final decrypted = db.decryptString(encryptedBase64);
      expect(decrypted, equals(plaintext));
    });

    test('1.3 Tamper Resistance & Cryptographic HMAC Verification', () {
      const plaintext = '{"sensitiveAccount":"EG99000100020003"}';
      final encryptedBase64 = db.encryptString(plaintext);
      final rawBytes = Uint8List.fromList(base64Decode(encryptedBase64));

      // Tamper with a single byte in the ciphertext payload
      rawBytes[rawBytes.length - 2] ^= 0xFF;
      final tamperedBase64 = base64Encode(rawBytes);

      // Attempting to decrypt tampered data must throw DatabaseTamperedException
      expect(
        () => db.decryptString(tamperedBase64),
        throwsA(isA<DatabaseTamperedException>()),
      );

      // Tamper with HMAC MAC tag
      final macTamperedBytes = Uint8List.fromList(base64Decode(encryptedBase64));
      macTamperedBytes[20] ^= 0xAA;
      expect(
        () => db.decryptString(base64Encode(macTamperedBytes)),
        throwsA(isA<DatabaseTamperedException>()),
      );
    });
  });

  group('Group 2: ACID Transaction Isolation & Rollback', () {
    test('2.1 Multi-Table Atomic Commit', () async {
      await db.transaction((txn) async {
        await txn.enqueuePunch(const OfflinePunch(
          clientPunchId: 'txn-punch-1',
          timestamp: '2026-09-21T07:30:00.000Z',
          type: 'check-in',
          latitude: 30.5852,
          longitude: 31.5034,
        ));

        await txn.enqueueRequest(const PendingHrRequest(
          idempotencyKey: 'txn-req-key-1',
          id: 'req-1',
          type: 'Leave',
          payload: {'days': 2, 'type': 'Annual Leave'},
          createdAt: '2026-09-21T07:30:00.000Z',
        ));

        await txn.saveEmployeeProfile(
          const EmployeeProfile(name: 'Txn Worker', employeeCode: 'EMP-TXN-01'),
          vacationBalance: 19,
        );
      });

      final punches = await db.getPendingPunches();
      final requests = await db.getPendingRequests();
      final profile = await db.getCachedEmployeeProfile();
      final balance = await db.getCachedVacationBalance();

      expect(punches.length, equals(1));
      expect(punches.first.clientPunchId, equals('txn-punch-1'));
      expect(requests.length, equals(1));
      expect(requests.first.idempotencyKey, equals('txn-req-key-1'));
      expect(profile?.name, equals('Txn Worker'));
      expect(balance, equals(19));
    });

    test('2.2 Transaction Rollback on Unexpected Failure (Atomicity Guarantee)', () async {
      // Seed pre-existing state
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'initial-punch',
        timestamp: '2026-09-21T06:00:00.000Z',
        type: 'check-in',
      ));
      await db.saveEmployeeProfile(
        const EmployeeProfile(name: 'Pre Worker', employeeCode: 'EMP-PRE'),
        vacationBalance: 21,
      );

      bool didThrow = false;
      try {
        await db.transaction((txn) async {
          await txn.enqueuePunch(const OfflinePunch(
            clientPunchId: 'aborted-punch',
            timestamp: '2026-09-21T08:00:00.000Z',
            type: 'check-out',
          ));
          await txn.enqueueRequest(const PendingHrRequest(
            idempotencyKey: 'aborted-req-key',
            id: 'req-aborted',
            type: 'Loan',
            payload: {'amount': 5000},
            createdAt: '2026-09-21T08:00:00.000Z',
          ));
          await txn.saveEmployeeProfile(
            const EmployeeProfile(name: 'Mutated Worker'),
            vacationBalance: 5,
          );

          throw Exception('Simulated power termination midway through transaction');
        });
      } catch (e) {
        didThrow = true;
      }

      expect(didThrow, isTrue);

      // Verify all mutations were completely rolled back
      final punches = await db.getAllPunches();
      expect(punches.length, equals(1));
      expect(punches.first.clientPunchId, equals('initial-punch'));

      final requests = await db.getPendingRequests();
      expect(requests.isEmpty, isTrue);

      final profile = await db.getCachedEmployeeProfile();
      expect(profile?.name, equals('Pre Worker'));
      final balance = await db.getCachedVacationBalance();
      expect(balance, equals(21));
    });

    test('2.3 Serialized Concurrency Isolation via AsyncMutex', () async {
      // Fire 20 parallel async operations concurrently
      final futures = List.generate(20, (i) {
        return db.enqueuePunch(OfflinePunch(
          clientPunchId: 'concurrent-punch-$i',
          timestamp: '2026-09-21T07:${i.toString().padLeft(2, '0')}:00.000Z',
          type: i.isEven ? 'check-in' : 'check-out',
          latitude: 30.0 + i * 0.01,
          longitude: 31.0 + i * 0.01,
        ));
      });

      await Future.wait(futures);

      final punches = await db.getAllPunches();
      expect(punches.length, equals(20));

      final ids = punches.map((p) => p.clientPunchId).toSet();
      expect(ids.length, equals(20));
    });
  });

  group('Group 3: Schedule Caching & Server-Wins Updates', () {
    test('3.1 Weekly Shift Roster Persistence & Day Structure Match', () async {
      final daysWeek1 = [
        const WorkShift(
          dayEn: 'Sun',
          dayAr: 'الأحد',
          date: '2026-09-20',
          shift: 'morning',
          name: 'Morning Shift (1st)',
          shiftNameAr: 'الوردية الأولى (صباحية)',
          time: '07:00 AM – 03:00 PM',
          timeAr: '07:00 ص – 03:00 م',
          supervisor: 'Mohamed Hassan',
        ),
        const WorkShift(
          dayEn: 'Mon',
          dayAr: 'الاثنين',
          date: '2026-09-21',
          shift: 'morning',
          name: 'Morning Shift (1st)',
          shiftNameAr: 'الوردية الأولى (صباحية)',
          time: '07:00 AM – 03:00 PM',
          timeAr: '07:00 ص – 03:00 م',
          supervisor: 'Mohamed Hassan',
        ),
        const WorkShift(
          dayEn: 'Tue',
          dayAr: 'الثلاثاء',
          date: '2026-09-22',
          shift: 'morning',
          name: 'Morning Shift (1st)',
          shiftNameAr: 'الوردية الأولى (صباحية)',
          time: '07:00 AM – 03:00 PM',
          timeAr: '07:00 ص – 03:00 م',
          supervisor: 'Mohamed Hassan',
        ),
        const WorkShift(
          dayEn: 'Wed',
          dayAr: 'الأربعاء',
          date: '2026-09-23',
          shift: 'morning',
          name: 'Morning Shift (1st)',
          shiftNameAr: 'الوردية الأولى (صباحية)',
          time: '07:00 AM – 03:00 PM',
          timeAr: '07:00 ص – 03:00 م',
          supervisor: 'Mohamed Hassan',
        ),
        const WorkShift(
          dayEn: 'Thu',
          dayAr: 'الخميس',
          date: '2026-09-24',
          shift: 'morning',
          name: 'Morning Shift (1st)',
          shiftNameAr: 'الوردية الأولى (صباحية)',
          time: '07:00 AM – 03:00 PM',
          timeAr: '07:00 ص – 03:00 م',
          supervisor: 'Mohamed Hassan',
        ),
        const WorkShift(
          dayEn: 'Fri',
          dayAr: 'الجمعة',
          date: '2026-09-25',
          shift: 'off',
          name: 'Rest Day',
          shiftNameAr: 'عطلة أسبوعية',
          time: 'Off Duty',
          timeAr: 'راحة أسبوعية',
          isConfirmed: false,
        ),
        const WorkShift(
          dayEn: 'Sat',
          dayAr: 'السبت',
          date: '2026-09-26',
          shift: 'off',
          name: 'Rest Day',
          shiftNameAr: 'عطلة أسبوعية',
          time: 'Off Duty',
          timeAr: 'راحة أسبوعية',
          isConfirmed: false,
        ),
      ];

      final weeks = [
        ShiftWeek(weekStart: '2026-09-20', isCurrent: true, days: daysWeek1),
      ];

      await db.saveSchedules(weeks, activeWeekStart: '2026-09-20', tenantId: 'elaraby');

      final cached = await db.getCachedSchedules();
      expect(cached.length, equals(1));
      expect(cached.first.weekStart, equals('2026-09-20'));
      expect(cached.first.days.length, equals(7));
      expect(cached.first.days[0].shift, equals('morning'));
      expect(cached.first.days[0].supervisor, equals('Mohamed Hassan'));
      expect(cached.first.days[5].shift, equals('off'));
      expect(cached.first.days[5].isRestDay, isTrue);
    });

    test('3.2 Cache Overwrite on Server Update (Server-Wins)', () async {
      final weekInitial = [
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
              supervisor: 'Mohamed Hassan',
            ),
          ],
        ),
      ];
      await db.saveSchedules(weekInitial);

      // Server update replaces roster with new supervisor and evening shift
      final weekUpdated = [
        ShiftWeek(
          weekStart: '2026-09-20',
          isCurrent: true,
          days: [
            const WorkShift(
              dayEn: 'Sun',
              dayAr: 'الأحد',
              date: '2026-09-20',
              shift: 'evening',
              name: 'Evening Shift',
              shiftNameAr: 'مسائي',
              time: '15:00 - 23:00',
              timeAr: '15:00 - 23:00',
              supervisor: 'Ahmed Mansour',
            ),
          ],
        ),
      ];
      await db.saveSchedules(weekUpdated);

      final cached = await db.getCachedSchedules();
      expect(cached.length, equals(1));
      expect(cached.first.days.first.shift, equals('evening'));
      expect(cached.first.days.first.supervisor, equals('Ahmed Mansour'));
    });
  });

  group('Group 4: Offline Attendance Punch Queue & Durability', () {
    test('4.1 Enqueue Offline Punch Record with Valid Status and Coordinates', () async {
      const punch = OfflinePunch(
        clientPunchId: 'punch-uuid-101',
        employeeId: 'EG-20481',
        type: 'check-in',
        timestamp: '2026-09-21T07:15:00.000Z',
        latitude: 30.5852,
        longitude: 31.5034,
        offlineToken: 'OFFLINE-EG-20481-QUESNA-1726938000000',
      );

      await db.enqueuePunch(punch);

      final pending = await db.getPendingPunches();
      expect(pending.length, equals(1));
      expect(pending.first.clientPunchId, equals('punch-uuid-101'));
      expect(pending.first.type, equals('check-in'));
      expect(pending.first.status, equals('pending'));
      expect(pending.first.latitude, equals(30.5852));
      expect(pending.first.offlineToken, contains('QUESNA'));
    });

    test('4.2 Durability & Persistence Across Simulated App Restarts', () async {
      // 1. Enqueue punch in db
      const punch = OfflinePunch(
        clientPunchId: 'survive-app-kill-punch',
        employeeId: 'EG-20481',
        type: 'check-out',
        timestamp: '2026-09-21T16:05:00.000Z',
        latitude: 30.5852,
        longitude: 31.5034,
        offlineToken: 'OFFLINE-PERSIST-TOKEN',
      );
      await db.enqueuePunch(punch);

      // 2. Simulate app kill: Instantiate a brand new OfflineDatabase instance pointing to same folder
      final restartedDb = OfflineDatabase.forTesting(
        baseDirectory: testDir,
        overrideKey: 'TEST_MASTER_KEY_0123456789012345',
      );
      await restartedDb.initialize();

      // 3. Verify recovered data matches completely
      final recoveredPunches = await restartedDb.getPendingPunches();
      expect(recoveredPunches.length, equals(1));
      expect(recoveredPunches.first.clientPunchId, equals('survive-app-kill-punch'));
      expect(recoveredPunches.first.type, equals('check-out'));
      expect(recoveredPunches.first.offlineToken, equals('OFFLINE-PERSIST-TOKEN'));
      expect(recoveredPunches.first.latitude, equals(30.5852));
    });

    test('4.3 Status Transitions & Synced Purge', () async {
      await db.enqueuePunch(const OfflinePunch(
        clientPunchId: 'punch-to-sync',
        timestamp: '2026-09-21T08:00:00.000Z',
        type: 'check-in',
      ));

      expect((await db.getPendingPunches()).length, equals(1));

      // Mark synced
      await db.markPunchSynced('punch-to-sync');
      expect((await db.getPendingPunches()).isEmpty, isTrue);

      final all = await db.getAllPunches();
      expect(all.length, equals(1));
      expect(all.first.status, equals('synced'));

      // Purge synced
      await db.purgeSyncedPunches();
      expect((await db.getAllPunches()).isEmpty, isTrue);
    });
  });

  group('Group 5: Pending HR Requests & Idempotency Key Deduping', () {
    test('5.1 Enqueue Pending HR Leave Application', () async {
      const req = PendingHrRequest(
        idempotencyKey: 'idemp-leave-annual-001',
        id: 'local_req_101',
        type: 'Leave',
        payload: {
          'leaveType': 'Annual Leave',
          'startDate': '2026-10-01',
          'days': 3,
        },
        createdAt: '2026-09-21T10:00:00.000Z',
      );

      await db.enqueueRequest(req);

      final pending = await db.getPendingRequests();
      expect(pending.length, equals(1));
      expect(pending.first.idempotencyKey, equals('idemp-leave-annual-001'));
      expect(pending.first.type, equals('Leave'));
      expect(pending.first.payload['days'], equals(3));
    });

    test('5.2 Rejection / Deduping of Duplicate Idempotency Keys', () async {
      const req1 = PendingHrRequest(
        idempotencyKey: 'idemp-loan-duplicate-test',
        id: 'req_1',
        type: 'Loan',
        payload: {'amount': 3000},
        createdAt: '2026-09-21T10:00:00.000Z',
      );

      const req2DuplicateKey = PendingHrRequest(
        idempotencyKey: 'idemp-loan-duplicate-test', // identical key
        id: 'req_2_different_local_id',
        type: 'Loan',
        payload: {'amount': 3000, 'note': 'duplicate attempt'},
        createdAt: '2026-09-21T10:01:00.000Z',
      );

      await db.enqueueRequest(req1);
      await db.enqueueRequest(req2DuplicateKey);

      final allRequests = await db.getAllRequests();
      // Idempotent write: must NOT create a duplicate row
      expect(allRequests.length, equals(1));
      expect(allRequests.first.idempotencyKey, equals('idemp-loan-duplicate-test'));
    });
  });

  group('Group 6: Crash Resilience & WAL Recovery', () {
    test('6.1 Recovers Uncommitted WAL on Startup', () async {
      // Create an uncommitted .wal file for cached_schedules
      final walFile = File('${testDir.path}/cached_schedules.wal');
      final targetFile = File('${testDir.path}/cached_schedules.enc');

      final sampleSchedules = jsonEncode({
        'tenantId': 'elaraby',
        'activeWeekStart': '2026-09-20',
        'weeks': [
          {
            'weekStart': '2026-09-20',
            'isCurrent': true,
            'days': [
              {
                'dayEn': 'Sun',
                'dayAr': 'الأحد',
                'date': '2026-09-20',
                'shift': 'morning',
                'name': 'Morning Shift',
                'shiftNameAr': 'صباحي',
                'time': '07:00 - 15:00',
                'timeAr': '07:00 - 15:00',
              }
            ]
          }
        ]
      });

      final encryptedWal = db.cipher!.encrypt(Uint8List.fromList(utf8.encode(sampleSchedules)));
      await walFile.writeAsBytes(encryptedWal, flush: true);

      // Simulate re-initialization after power drop
      final freshDb = OfflineDatabase.forTesting(
        baseDirectory: testDir,
        overrideKey: 'TEST_MASTER_KEY_0123456789012345',
      );
      await freshDb.initialize();

      // Verify target file was restored from WAL and WAL file was cleaned up
      expect(targetFile.existsSync(), isTrue);
      expect(walFile.existsSync(), isFalse);

      final schedules = await freshDb.getCachedSchedules();
      expect(schedules.length, equals(1));
      expect(schedules.first.weekStart, equals('2026-09-20'));
    });
  });
}
