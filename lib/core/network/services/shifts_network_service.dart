import 'package:flutter/foundation.dart';

import '../../../features/services/data/shift_model.dart';
import '../api_client.dart';

/// Network operations dedicated to Shifts, Rotations, Swaps, Attendance Punches, and Overtime.
class ShiftsNetworkService {
  final ApiClient _api;
  final ValueNotifier<bool> _online;

  ShiftsNetworkService(this._api, this._online);

  /// The current week's shifts (7 entries with resolved `time`/`offDuty`).
  /// Returns null when nothing was published — app falls back to its pattern.
  Future<List<Map<String, dynamic>>?> fetchRoster() async {
    final res = await _api.get('/roster');
    final days = res?['days'] as List<dynamic>?;
    if (days == null) return null;
    _online.value = true;
    return days
        .map((e) => Map<String, dynamic>.from(e as Map<String, dynamic>))
        .toList();
  }

  /// Extended 4-week factory rotation schedule
  Future<List<ShiftWeek>?> fetchMultiWeekRoster() async {
    final res = await _api.get('/shifts/roster');
    final rawWeeks = res?['weeks'] as List<dynamic>?;
    if (rawWeeks == null) return null;
    _online.value = true;
    return rawWeeks
        .map((w) => ShiftWeek.fromJson(w as Map<String, dynamic>))
        .toList();
  }

  /// Discover colleagues in same factory/department for shift swap
  Future<List<ShiftSwapColleague>?> fetchSwapColleagues(String date) async {
    final res = await _api.get('/shifts/colleagues?date=$date');
    final raw = res?['colleagues'] as List<dynamic>?;
    if (raw == null) return null;
    _online.value = true;
    return raw
        .map((c) => ShiftSwapColleague.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  /// Submit a two-tier peer shift swap request
  Future<ShiftSwapRequest?> submitShiftSwap({
    required String targetEmployeeId,
    required String date,
    String? reason,
  }) async {
    final res = await _api.post('/shifts/swap', {
      'targetEmployeeId': targetEmployeeId,
      'date': date,
      'reason': reason,
    });
    final raw = res?['swap'] as Map<String, dynamic>?;
    if (raw == null) return null;
    _online.value = true;
    return ShiftSwapRequest.fromJson(raw);
  }

  /// Respond to incoming peer shift swap request (accept or decline)
  Future<bool> respondShiftSwap(String swapId, String decision) async {
    final res = await _api.post('/shifts/swap/$swapId/respond', {
      'decision': decision,
    });
    return res != null && res['ok'] == true;
  }

  /// Fetch incoming and outgoing swap requests
  Future<List<ShiftSwapRequest>?> fetchShiftSwaps() async {
    final res = await _api.get('/shifts/swaps');
    final raw = res?['swaps'] as List<dynamic>?;
    if (raw == null) return null;
    _online.value = true;
    return raw
        .map((s) => ShiftSwapRequest.fromJson(s as Map<String, dynamic>))
        .toList();
  }

  /// Submit an overtime hours claim
  Future<OvertimeClaim?> submitOvertimeClaim({
    required String date,
    required double hours,
    required String timePeriod,
    String? reason,
  }) async {
    final res = await _api.post('/overtime/claim', {
      'date': date,
      'hours': hours,
      'timePeriod': timePeriod,
      'reason': reason,
    });
    final raw = res?['claim'] as Map<String, dynamic>?;
    if (raw == null) return null;
    _online.value = true;
    return OvertimeClaim.fromJson(raw);
  }

  /// Fetch all overtime claims
  Future<List<OvertimeClaim>?> fetchOvertimeClaims() async {
    final res = await _api.get('/overtime/claims');
    final raw = res?['claims'] as List<dynamic>?;
    if (raw == null) return null;
    _online.value = true;
    return raw
        .map((c) => OvertimeClaim.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  /// Fetch today's live punch and attendance status
  Future<TodayPunchState?> fetchTodayPunchState([String? date]) async {
    final path = date != null ? '/attendance/today?date=$date' : '/attendance/today';
    final res = await _api.get(path);
    if (res == null) return null;
    _online.value = true;
    return TodayPunchState.fromJson(res);
  }

  /// Record punch-in or punch-out
  Future<Map<String, dynamic>?> submitAttendancePunch({
    required String type,
    double? lat,
    double? lng,
    String? qrToken,
  }) async {
    final res = await _api.post('/attendance/punch', {
      'type': type,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
      if (qrToken != null) 'qrToken': qrToken,
    });
    return res;
  }

  /// Bulk sync offline attendance punches to POST /api/attendance/bulk-sync.
  /// Deduplicates via clientPunchId and 120-second sliding window on the server.
  Future<Map<String, dynamic>?> bulkSyncPunches(
    List<Map<String, dynamic>> punches,
  ) async {
    if (punches.isEmpty) {
      return {
        'ok': true,
        'totalProcessed': 0,
        'acceptedCount': 0,
        'duplicateCount': 0,
        'results': <dynamic>[],
      };
    }
    final res = await _api.post('/attendance/bulk-sync', {
      'punches': punches,
    });
    if (res != null && res['ok'] == true) {
      _online.value = true;
    }
    return res;
  }
}
