import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/backend.dart';
import '../network/connectivity_service.dart';
import '../storage/offline_database.dart';
import '../../features/services/data/requests_store.dart';

/// Structured result of a background synchronization cycle.
class SyncResult {
  final bool success;
  final int punchesSynced;
  final int punchesDuplicates;
  final int punchesFailed;
  final int requestsSynced;
  final int requestsFailed;
  final String? errorMessage;
  final DateTime timestamp;

  const SyncResult({
    required this.success,
    this.punchesSynced = 0,
    this.punchesDuplicates = 0,
    this.punchesFailed = 0,
    this.requestsSynced = 0,
    this.requestsFailed = 0,
    this.errorMessage,
    required this.timestamp,
  });

  factory SyncResult.offline() => SyncResult(
        success: false,
        errorMessage: 'Device is offline',
        timestamp: DateTime.now(),
      );

  factory SyncResult.inProgress() => SyncResult(
        success: false,
        errorMessage: 'Sync cycle already in progress',
        timestamp: DateTime.now(),
      );

  factory SyncResult.empty() => SyncResult(
        success: true,
        timestamp: DateTime.now(),
      );
}

/// Background synchronization engine managing offline-to-online queue draining,
/// exponential backoff with full jitter, and automated conflict resolution.
class BackgroundSyncService {
  static BackgroundSyncService _instance = BackgroundSyncService._();
  static BackgroundSyncService get instance => _instance;

  @visibleForTesting
  static void setInstanceForTesting(BackgroundSyncService testService) {
    _instance = testService;
  }

  @visibleForTesting
  static void resetInstanceForTesting() {
    _instance = BackgroundSyncService._();
  }

  final OfflineDatabase? _injectedDatabase;
  final ConnectivityService? _injectedConnectivity;
  final Backend? _injectedBackend;

  // Exponential Backoff Configuration
  static const double initialIntervalSeconds = 1.5;
  static const double backoffMultiplier = 2.0;
  static const double maxBackoffSeconds = 60.0;
  static const int maxRetryAttempts = 5;

  // State Notifiers & Streams
  final ValueNotifier<bool> isSyncingNotifier = ValueNotifier<bool>(false);
  final StreamController<SyncResult> _syncResultController =
      StreamController<SyncResult>.broadcast();

  bool get isSyncing => isSyncingNotifier.value;
  Stream<SyncResult> get onSyncCompleted => _syncResultController.stream;

  StreamSubscription<bool>? _connectivitySubscription;
  Timer? _retryTimer;
  int _retryAttempt = 0;
  bool _isRunning = false;
  bool _syncInProgress = false;
  bool _previousOnlineState = false;

  /// Custom random generator for deterministic testing
  math.Random? customRandomForTesting;

  BackgroundSyncService._({
    OfflineDatabase? database,
    ConnectivityService? connectivity,
    Backend? backend,
  })  : _injectedDatabase = database,
        _injectedConnectivity = connectivity,
        _injectedBackend = backend;

  factory BackgroundSyncService({
    OfflineDatabase? database,
    ConnectivityService? connectivity,
    Backend? backend,
  }) {
    return BackgroundSyncService._(
      database: database,
      connectivity: connectivity,
      backend: backend,
    );
  }

  factory BackgroundSyncService.forTesting({
    OfflineDatabase? database,
    ConnectivityService? connectivity,
    Backend? backend,
    math.Random? customRandom,
  }) {
    final svc = BackgroundSyncService._(
      database: database,
      connectivity: connectivity,
      backend: backend,
    );
    svc.customRandomForTesting = customRandom;
    return svc;
  }

  OfflineDatabase get _db => _injectedDatabase ?? OfflineDatabase.instance;
  ConnectivityService get _connectivity => _injectedConnectivity ?? ConnectivityService.instance;
  Backend get _backend => _injectedBackend ?? Backend.instance;

  /// Starts the background sync listener on connectivity changes.
  void start() {
    if (_isRunning) return;
    _isRunning = true;
    _previousOnlineState = _connectivity.isOnline;

    _connectivitySubscription =
        _connectivity.onConnectivityChanged.listen((isOnline) {
      if (!_previousOnlineState && isOnline) {
        debugPrint('BackgroundSyncService: Connectivity restored. Triggering immediate sync.');
        _retryAttempt = 0;
        triggerSync();
      }
      _previousOnlineState = isOnline;
    });

    // If currently online upon start, perform initial sync check
    if (_connectivity.isOnline) {
      triggerSync();
    }
  }

  /// Stops the background sync listener and cancels pending retry timers.
  void stop() {
    _isRunning = false;
    _retryTimer?.cancel();
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
  }

  /// Calculates un-jittered base backoff delay according to:
  /// delay = min(maxBackoffSeconds, initialIntervalSeconds * (2 ^ attempt))
  Duration calculateBackoffDelay(int attempt) {
    final clampedSec = math.min(
      maxBackoffSeconds,
      initialIntervalSeconds * math.pow(backoffMultiplier, attempt),
    );
    return Duration(milliseconds: (clampedSec * 1000).round());
  }

  /// Calculates backoff duration using the Full Jitter formula:
  /// sleep = Random().nextDouble() * min(maxBackoff, initial * (2 ^ attempt))
  Duration calculateBackoffWithFullJitter(int attempt) {
    final rng = customRandomForTesting ?? math.Random();
    final baseDelay = calculateBackoffDelay(attempt);
    final sleepMs = (rng.nextDouble() * baseDelay.inMilliseconds).round();
    return Duration(milliseconds: sleepMs);
  }

  /// Triggers an immediate synchronization cycle across punches, requests, and schedules.
  Future<SyncResult> triggerSync({bool force = false}) async {
    if (_syncInProgress) {
      return SyncResult.inProgress();
    }
    if (!force && !_connectivity.isOnline) {
      return SyncResult.offline();
    }

    _syncInProgress = true;
    isSyncingNotifier.value = true;

    int punchesSynced = 0;
    int punchesDuplicates = 0;
    int punchesFailed = 0;
    int requestsSynced = 0;
    int requestsFailed = 0;
    bool hadNetworkError = false;

    try {
      // Step 1: Bulk Sync Attendance Punches (Client-Wins)
      final punchStats = await _drainPunchQueue();
      punchesSynced = punchStats['synced'] ?? 0;
      punchesDuplicates = punchStats['duplicates'] ?? 0;
      punchesFailed = punchStats['failed'] ?? 0;
      if (punchStats['networkError'] == true) {
        hadNetworkError = true;
      }

      // Step 2: Flush Pending HR Requests (Last-Write-Wins with Idempotency)
      try {
        await RequestsStore.instance.flushPending();
      } catch (e) {
        debugPrint('BackgroundSyncService: RequestStore flush error: $e');
        requestsFailed++;
      }

      try {
        final pendingDbReqs = await _db.getPendingRequests();
        for (final req in pendingDbReqs) {
          try {
            final days = int.tryParse(req.payload['days']?.toString() ?? '');
            final res = await _backend.submitRequest(
              type: req.type,
              title: req.payload['title']?.toString() ?? req.type,
              details: (req.payload['details'] as Map<String, dynamic>?)?.map((k, v) => MapEntry(k, '$v')) ?? {},
              days: days,
              idempotencyKey: req.idempotencyKey,
            );
            if (res != null) {
              await _db.markRequestSynced(req.idempotencyKey);
              requestsSynced++;
            }
          } catch (err) {
            debugPrint('BackgroundSyncService: DB request flush error: $err');
            requestsFailed++;
          }
        }
      } catch (e) {
        debugPrint('BackgroundSyncService: DB request loop error: $e');
      }

      // Step 3: Refresh Shift Schedules & Rosters (Server-Wins)
      try {
        final serverWeeks = await _backend.fetchMultiWeekRoster();
        if (serverWeeks != null && serverWeeks.isNotEmpty) {
          await _db.saveSchedules(serverWeeks);
        }
      } catch (e) {
        debugPrint('BackgroundSyncService: Schedule refresh error: $e');
      }

      // Step 4: Refresh Employee Profile (Server-Wins)
      try {
        await _backend.syncProfile();
      } catch (e) {
        debugPrint('BackgroundSyncService: Profile refresh error: $e');
      }

      final success = !hadNetworkError && punchesFailed == 0;
      if (success) {
        _retryAttempt = 0;
        _retryTimer?.cancel();
      } else if (hadNetworkError) {
        _scheduleRetry();
      }

      final result = SyncResult(
        success: success,
        punchesSynced: punchesSynced,
        punchesDuplicates: punchesDuplicates,
        punchesFailed: punchesFailed,
        requestsSynced: requestsSynced,
        requestsFailed: requestsFailed,
        timestamp: DateTime.now(),
      );

      _syncResultController.add(result);
      return result;
    } catch (e, st) {
      debugPrint('BackgroundSyncService: Unexpected sync failure: $e\n$st');
      _scheduleRetry();
      final result = SyncResult(
        success: false,
        punchesSynced: punchesSynced,
        punchesDuplicates: punchesDuplicates,
        punchesFailed: punchesFailed,
        errorMessage: e.toString(),
        timestamp: DateTime.now(),
      );
      _syncResultController.add(result);
      return result;
    } finally {
      _syncInProgress = false;
      isSyncingNotifier.value = false;
    }
  }

  Future<Map<String, dynamic>> _drainPunchQueue() async {
    final pending = await _db.getPendingPunches();
    if (pending.isEmpty) {
      return {'synced': 0, 'duplicates': 0, 'failed': 0, 'networkError': false};
    }

    final wirePayload = pending.map((p) => p.toWirePayload()).toList();
    try {
      final response = await _backend.bulkSyncPunches(wirePayload);
      if (response == null || response['ok'] != true) {
        for (final p in pending) {
          await _db.updatePunchStatus(
            p.clientPunchId,
            'pending',
            retryCount: p.retryCount + 1,
            errorMessage: 'Network or server error during bulk sync',
          );
        }
        return {'synced': 0, 'duplicates': 0, 'failed': pending.length, 'networkError': true};
      }

      int synced = 0;
      int duplicates = 0;
      int failed = 0;

      final results = response['results'] as List<dynamic>? ?? [];
      for (final r in results) {
        if (r is Map<String, dynamic>) {
          final id = r['clientPunchId'] as String?;
          final status = r['status'] as String?;
          if (id != null) {
            if (status == 'accepted') {
              await _db.markPunchSynced(id);
              synced++;
            } else if (status == 'duplicate') {
              // Server 120-second deduplication: already ingested -> reconcile as synced
              await _db.markPunchSynced(id);
              duplicates++;
            } else {
              failed++;
              final error = r['error']?.toString() ?? 'Validation or server error';
              final original = pending.firstWhere((p) => p.clientPunchId == id, orElse: () => pending.first);
              await _db.updatePunchStatus(
                id,
                'pending',
                retryCount: original.retryCount + 1,
                errorMessage: error,
              );
            }
          }
        }
      }

      return {'synced': synced, 'duplicates': duplicates, 'failed': failed, 'networkError': false};
    } catch (e) {
      debugPrint('BackgroundSyncService: Error during bulkSyncPunches: $e');
      for (final p in pending) {
        await _db.updatePunchStatus(
          p.clientPunchId,
          'pending',
          retryCount: p.retryCount + 1,
          errorMessage: e.toString(),
        );
      }
      return {'synced': 0, 'duplicates': 0, 'failed': pending.length, 'networkError': true};
    }
  }

  void _scheduleRetry() {
    _retryTimer?.cancel();
    if (_retryAttempt >= maxRetryAttempts) {
      debugPrint('BackgroundSyncService: Max retries reached ($maxRetryAttempts). Awaiting next network event.');
      return;
    }

    final delay = calculateBackoffWithFullJitter(_retryAttempt);
    _retryAttempt++;
    debugPrint('BackgroundSyncService: Scheduling retry attempt $_retryAttempt in ${delay.inMilliseconds}ms');

    _retryTimer = Timer(delay, () async {
      if (_connectivity.isOnline) {
        await triggerSync();
      }
    });
  }

  @visibleForTesting
  int get currentRetryAttempt => _retryAttempt;

  @visibleForTesting
  void resetForTesting() {
    _retryAttempt = 0;
    _retryTimer?.cancel();
    _syncInProgress = false;
    isSyncingNotifier.value = false;
  }

  void dispose() {
    stop();
    _syncResultController.close();
    isSyncingNotifier.dispose();
  }
}

// ============================================================================
// RIVERPOD PROVIDER REGISTRATION
// ============================================================================

final backgroundSyncServiceProvider = Provider<BackgroundSyncService>((ref) {
  return BackgroundSyncService.instance;
});
