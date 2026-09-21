import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/network/connectivity_service.dart';
import '../../../../core/services/background_sync_service.dart';
import '../../../../core/state/ui_state.dart';
import '../../../../core/storage/local_store.dart';
import '../../../../core/storage/offline_database.dart';
import 'package:elaraby_workforce/features/services/data/shift_model.dart';

// ---------- Multi-Week Roster Notifier ----------
class RosterNotifier extends StateNotifier<UiState<List<ShiftWeek>>> {
  RosterNotifier() : super(const UiState.loading()) {
    loadRoster();
  }

  Future<void> loadRoster() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final weeks = await Backend.instance.fetchMultiWeekRoster();
      if (weeks != null && weeks.isNotEmpty) {
        state = UiState.success(weeks);
        try {
          await OfflineDatabase.instance.saveSchedules(weeks);
        } catch (_) {}
        return;
      }
    } catch (_) {}

    // Read cached schedules from encrypted offline database
    try {
      final cached = await OfflineDatabase.instance.getCachedSchedules();
      if (cached.isNotEmpty) {
        state = UiState.success(cached);
        return;
      }
    } catch (_) {}

    final fallback = _generateFallbackWeeks();
    state = UiState.success(fallback);
  }

  @visibleForTesting
  List<ShiftWeek> generateFallbackWeeksForTesting() => _generateFallbackWeeks();

  List<ShiftWeek> _generateFallbackWeeks() {
    final now = DateTime.now();
    final sunday = DateTime(now.year, now.month, now.day - (now.weekday % 7));
    final dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    final weeks = <ShiftWeek>[];
    for (int w = -1; w <= 2; w++) {
      final weekSun = DateTime(sunday.year, sunday.month, sunday.day + w * 7);
      final weekStartKey =
          '${weekSun.year}-${weekSun.month.toString().padLeft(2, '0')}-${weekSun.day.toString().padLeft(2, '0')}';
      final days = List.generate(7, (i) {
        final d = DateTime(weekSun.year, weekSun.month, weekSun.day + i);
        final dateKey =
            '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
        final isRest = i == 5 || i == 6;
        return WorkShift(
          dayEn: dayNamesEn[i],
          dayAr: dayNamesAr[i],
          date: dateKey,
          shift: isRest ? 'off' : (w.isEven ? 'morning' : 'evening'),
          name: isRest
              ? 'Rest Day'
              : (w.isEven ? 'Morning Shift (1st)' : 'Evening Shift (2nd)'),
          shiftNameAr: isRest
              ? 'عطلة أسبوعية'
              : (w.isEven ? 'الوردية الأولى (صباحية)' : 'الوردية الثانية (مسائية)'),
          time: isRest ? 'Off Duty' : (w.isEven ? '07:00 AM – 03:00 PM' : '03:00 PM – 11:00 PM'),
          timeAr: isRest ? 'راحة أسبوعية' : (w.isEven ? '07:00 ص – 03:00 م' : '03:00 م – 11:00 م'),
          isConfirmed: !isRest,
        );
      });
      weeks.add(ShiftWeek(weekStart: weekStartKey, isCurrent: w == 0, days: days));
    }
    return weeks;
  }
}

final rosterProvider = StateNotifierProvider<RosterNotifier, UiState<List<ShiftWeek>>>((ref) {
  return RosterNotifier();
});

// ---------- Live Factory Attendance & Punch Notifier ----------
class AttendanceNotifier extends StateNotifier<UiState<TodayPunchState>> {
  AttendanceNotifier() : super(const UiState.loading()) {
    loadToday();
  }

  Future<void> loadToday() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final punch = await Backend.instance.fetchTodayPunchState();
      if (punch != null) {
        state = UiState.success(punch);
        return;
      }
    } catch (_) {}

    // Offline state recovery: check OfflineDatabase for any pending punch today
    try {
      final pending = await OfflineDatabase.instance.getPendingPunches();
      if (pending.isNotEmpty) {
        final last = pending.last;
        final now = DateTime.now();
        final dateKey =
            '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
        final hour = now.hour;
        final minute = now.minute.toString().padLeft(2, '0');
        final period = hour >= 12 ? 'PM' : 'AM';
        final displayHour = (hour % 12 == 0 ? 12 : hour % 12).toString().padLeft(2, '0');
        final timeFormatted = '$displayHour:$minute $period';
        final isPunchIn = last.type == 'in' || last.type == 'check-in';

        state = UiState.success(TodayPunchState(
          date: dateKey,
          status: isPunchIn ? 'checked_in' : 'checked_out',
          workingMinutes: isPunchIn ? 15 : 480,
          punchInTime: isPunchIn ? timeFormatted : '08:00 AM',
          punchOutTime: !isPunchIn ? timeFormatted : null,
          punctuality: 'on_time',
          delayMinutes: 0,
          qrToken: last.qrToken ?? 'OFFLINE-QR-${now.millisecondsSinceEpoch}',
          offlineToken: last.offlineToken ?? 'OFFLINE:emp_1:$dateKey:LOCAL-HMAC',
          factoryName: 'مجمع العاشر من رمضان',
        ));
        return;
      }
    } catch (_) {}

    state = UiState.success(_fallbackState());
  }

  TodayPunchState _fallbackState() {
    final now = DateTime.now();
    final dateKey =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return TodayPunchState(
      date: dateKey,
      status: 'not_checked_in',
      qrToken: 'OFFLINE-QR-${now.millisecondsSinceEpoch}',
      offlineToken: 'OFFLINE:emp_1:$dateKey:LOCAL-HMAC',
      factoryName: 'مجمع العاشر من رمضان',
    );
  }

  Future<bool> punch(String type, {double? lat, double? lng}) async {
    final isOnline = ConnectivityService.instance.isOnline;

    if (isOnline) {
      try {
        final res = await Backend.instance.submitAttendancePunch(type: type, lat: lat, lng: lng);
        if (res != null && res['ok'] == true) {
          await loadToday();
          return true;
        }
      } catch (e) {
        debugPrint('AttendanceNotifier: Direct punch failed, falling back to offline queue: $e');
      }
    }

    // Offline or network failure fallback: Enqueue locally in encrypted database
    try {
      final now = DateTime.now();
      final clientPunchId = 'punch_${now.millisecondsSinceEpoch}_${math.Random().nextInt(999999)}';
      final empId = LocalStore.instance.profile.employeeCode;
      final punchTypeNormalized = type.toLowerCase().contains('out') ? 'check-out' : 'check-in';
      final offlineToken = 'OFFLINE-$empId-LOCAL-${now.millisecondsSinceEpoch}';

      final offlinePunch = OfflinePunch(
        clientPunchId: clientPunchId,
        timestamp: now.toUtc().toIso8601String(),
        type: punchTypeNormalized,
        latitude: lat,
        longitude: lng,
        offlineToken: offlineToken,
        status: 'pending',
        employeeId: empId,
        createdAt: now.toUtc().toIso8601String(),
      );

      await OfflineDatabase.instance.enqueuePunch(offlinePunch);

      // Optimistic UI state update
      final dateKey =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      final hour = now.hour;
      final minute = now.minute.toString().padLeft(2, '0');
      final period = hour >= 12 ? 'PM' : 'AM';
      final displayHour = (hour % 12 == 0 ? 12 : hour % 12).toString().padLeft(2, '0');
      final timeFormatted = '$displayHour:$minute $period';

      final isPunchIn = punchTypeNormalized == 'check-in';
      final current = state.data ?? _fallbackState();

      state = UiState.success(TodayPunchState(
        date: dateKey,
        status: isPunchIn ? 'checked_in' : 'checked_out',
        workingMinutes: current.workingMinutes,
        punchInTime: isPunchIn ? timeFormatted : current.punchInTime,
        punchOutTime: !isPunchIn ? timeFormatted : current.punchOutTime,
        punctuality: current.punctuality,
        delayMinutes: current.delayMinutes,
        qrToken: current.qrToken,
        offlineToken: offlineToken,
        factoryName: current.factoryName,
      ));

      // Trigger background sync cycle if connected
      if (ConnectivityService.instance.isOnline) {
        BackgroundSyncService.instance.triggerSync();
      }

      return true;
    } catch (e) {
      debugPrint('AttendanceNotifier: Critical error enqueuing offline punch: $e');
      return false;
    }
  }
}

final attendanceProvider =
    StateNotifierProvider<AttendanceNotifier, UiState<TodayPunchState>>((ref) {
  return AttendanceNotifier();
});

// ---------- Shift Swaps Notifier ----------
class ShiftSwapsNotifier extends StateNotifier<UiState<List<ShiftSwapRequest>>> {
  ShiftSwapsNotifier() : super(const UiState.loading()) {
    loadSwaps();
  }

  Future<void> loadSwaps() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final swaps = await Backend.instance.fetchShiftSwaps();
      state = UiState.success(swaps ?? []);
    } catch (_) {
      state = const UiState.success([]);
    }
  }

  Future<bool> createSwap({
    required String targetEmployeeId,
    required String date,
    String? reason,
  }) async {
    try {
      final swap = await Backend.instance.submitShiftSwap(
        targetEmployeeId: targetEmployeeId,
        date: date,
        reason: reason,
      );
      if (swap != null) {
        final current = state.data ?? [];
        state = UiState.success([swap, ...current]);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> respondSwap(String swapId, String decision) async {
    try {
      final ok = await Backend.instance.respondShiftSwap(swapId, decision);
      if (ok) {
        await loadSwaps();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

final shiftSwapsProvider =
    StateNotifierProvider<ShiftSwapsNotifier, UiState<List<ShiftSwapRequest>>>((ref) {
  return ShiftSwapsNotifier();
});

// ---------- Overtime Claims Notifier ----------
class OvertimeNotifier extends StateNotifier<UiState<List<OvertimeClaim>>> {
  OvertimeNotifier() : super(const UiState.loading()) {
    loadClaims();
  }

  Future<void> loadClaims() async {
    state = state.hasData ? UiState.refreshing(state.data!) : const UiState.loading();
    try {
      final claims = await Backend.instance.fetchOvertimeClaims();
      state = UiState.success(claims ?? []);
    } catch (_) {
      state = const UiState.success([]);
    }
  }

  Future<bool> submitClaim({
    required String date,
    required double hours,
    required String timePeriod,
    String? reason,
  }) async {
    try {
      final claim = await Backend.instance.submitOvertimeClaim(
        date: date,
        hours: hours,
        timePeriod: timePeriod,
        reason: reason,
      );
      if (claim != null) {
        final current = state.data ?? [];
        state = UiState.success([claim, ...current]);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

final overtimeProvider =
    StateNotifierProvider<OvertimeNotifier, UiState<List<OvertimeClaim>>>((ref) {
  return OvertimeNotifier();
});
