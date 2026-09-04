import 'package:flutter/foundation.dart';

import '../../features/benefits/data/benefits_content.dart';
import '../../features/home/data/home_content.dart';
import '../../features/services/data/requests_store.dart';
import '../storage/local_store.dart';
import 'api_client.dart';

/// One server inbox notification.
class ServerNotification {
  final String id;
  final String title;
  final String body;
  final bool read;
  final DateTime createdAt;
  final String? imageUrl;

  const ServerNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    required this.createdAt,
    this.imageUrl,
  });

  factory ServerNotification.fromJson(Map<String, dynamic> json) =>
      ServerNotification(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        read: json['read'] as bool? ?? false,
        createdAt:
            DateTime.fromMillisecondsSinceEpoch(json['createdAt'] as int? ?? 0),
        imageUrl: json['imageUrl'] as String?,
      );
}

/// Outcome of a server-verified credential check.
enum AuthResult { success, invalid, locked }

/// High-level bridge between the app and the backend. Every call degrades
/// gracefully: when the server is unreachable the app keeps working with its
/// local stores (offline-first).
class Backend {
  static final Backend instance = Backend._();
  Backend._();

  final ApiClient _api = ApiClient.instance;

  /// True when the last health check / API call succeeded.
  final ValueNotifier<bool> online = ValueNotifier(false);

  Future<bool> ping() async {
    final res = await _api.get('/health', timeout: const Duration(seconds: 3));
    online.value = res?['ok'] == true;
    return online.value;
  }

  // ---------- Auth ----------
  /// Asks the server for an OTP. Returns the dev code when the server runs in
  /// development mode (no SMS gateway), otherwise null.
  Future<String?> requestOtp(String nationalId) async {
    final res = await _api.post('/auth/otp', {'nationalId': nationalId});
    if (res == null) return null;
    online.value = true;
    if (res['found'] != true) return null;
    await _api.setLastNationalId(nationalId);
    return res['devCode'] as String?;
  }

  /// Verifies the OTP and mirrors the server profile into [LocalStore].
  Future<AuthResult> verifyOtp(String nationalId, String code) async {
    final res = await _api.post('/auth/otp/verify', {
      'nationalId': nationalId,
      'code': code,
    });
    if (res == null) return AuthResult.invalid; // offline: caller falls back
    if (res['_status'] == 429) return AuthResult.locked;
    if (res['ok'] != true) return AuthResult.invalid;
    _applyEmployee(res['employee'] as Map<String, dynamic>);
    return AuthResult.success;
  }

  Future<bool> setPin(String nationalId, String pin) async {
    final res = await _api.post('/auth/pin', {'nationalId': nationalId, 'pin': pin});
    return res?['ok'] == true;
  }

  /// Verifies the PIN against the server and stores the session token.
  /// [AuthResult.invalid] is returned (not `locked`) when the server is
  /// unreachable, so callers can fall back to the local hash.
  Future<AuthResult> verifyPin(String pin) async {
    final nationalId = _api.lastNationalId;
    if (nationalId == null) return AuthResult.invalid;
    final res = await _api.post('/auth/pin/verify', {
      'nationalId': nationalId,
      'pin': pin,
    });
    if (res == null) return AuthResult.invalid; // unreachable
    online.value = true;
    if (res['_status'] == 429) return AuthResult.locked;
    if (res['ok'] != true) return AuthResult.invalid;
    await _api.setToken(res['token'] as String);
    _applyEmployee(res['employee'] as Map<String, dynamic>);
    // Session just became available — pull server-driven content.
    HomeContent.instance.load();
    BenefitsContent.instance.load();
    return AuthResult.success;
  }

  Future<AuthResult> changePin(String currentPin, String newPin) async {
    final res = await _api.post('/auth/pin/change', {
      'currentPin': currentPin,
      'newPin': newPin,
    });
    if (res == null) return AuthResult.invalid;
    if (res['_status'] == 429) return AuthResult.locked;
    return res['ok'] == true ? AuthResult.success : AuthResult.invalid;
  }

  /// Refreshes the profile (e.g. vacation balance) from the server.
  Future<void> syncProfile() async {
    if (_api.token == null) return;
    final res = await _api.get('/me');
    if (res?['employee'] != null) {
      _applyEmployee(res!['employee'] as Map<String, dynamic>);
      online.value = true;
    }
  }

  void _applyEmployee(Map<String, dynamic> employee) {
    LocalStore.instance.saveProfile(EmployeeProfile(
      name: employee['name'] as String? ?? 'Ahmed Ghannam',
      employeeCode: employee['employeeCode'] as String? ?? 'EG-20481',
      factory: employee['factory'] as String? ?? '10th of Ramadan',
      department: employee['department'] as String? ?? 'Production A',
      position: employee['position'] as String? ?? '',
      supervisor: employee['supervisor'] as String? ?? '',
      phone: employee['phone'] as String? ?? '',
      address: LocalStore.instance.profile.address,
      emergencyContact: LocalStore.instance.profile.emergencyContact,
    ));
    final balance = employee['vacationBalance'];
    if (balance is int) {
      LocalStore.instance.setVacationBalance(balance);
    }
  }

  // ---------- Requests ----------
  /// Replaces the local request list with the server's (single source of
  /// truth when online). Returns false when offline.
  Future<bool> syncRequests() async {
    final res = await _api.get('/requests');
    final list = res?['requests'] as List<dynamic>?;
    if (list == null) return false;
    final requests = list
        .map((e) => _mapRequest(e as Map<String, dynamic>))
        .toList();
    RequestsStore.instance.replaceAll(requests);
    online.value = true;
    return true;
  }

  Future<void> submitRequest({
    required String type,
    required String title,
    required Map<String, String> details,
    int? days,
  }) async {
    final res = await _api.post('/requests', {
      'type': type,
      'title': title,
      'details': details,
      'days': days,
    });
    final balance = res?['vacationBalance'];
    if (balance is int) LocalStore.instance.setVacationBalance(balance);
  }

  Future<void> cancelRequest(String id) async {
    await _api.post('/requests/$id/cancel', {});
  }

  EmployeeRequest _mapRequest(Map<String, dynamic> json) {
    final created = DateTime.fromMillisecondsSinceEpoch(
        json['createdAt'] as int? ?? 0);
    RequestStatus status;
    switch (json['status']) {
      case 'approved':
        status = RequestStatus.approved;
        break;
      case 'rejected':
        status = RequestStatus.rejected;
        break;
      default:
        status = RequestStatus.inReview;
    }
    return EmployeeRequest(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      type: json['type'] as String? ?? '',
      refNumber: json['refNumber'] as String? ?? '',
      status: status,
      date: _relativeDate(created),
      summary: json['summary'] as String? ?? '',
      reviewer: json['decidedBy'] as String?,
      rejectionReason: json['decisionReason'] as String?,
      details: (json['details'] as Map<String, dynamic>? ?? const {})
          .map((k, v) => MapEntry(k, '$v')),
    );
  }

  String _relativeDate(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  // ---------- Payroll ----------
  /// The employee's current salary statement from the server, or null when
  /// offline (the app then shows its bundled statement).
  Future<Map<String, dynamic>?> fetchPayroll() async {
    final res = await _api.get('/payroll');
    if (res?['payroll'] == null) return null;
    online.value = true;
    return res!['payroll'] as Map<String, dynamic>;
  }

  // ---------- Roster ----------
  /// The current week's shifts (7 entries with resolved `time`/`offDuty`).
  /// Returns null when nothing was published — app falls back to its pattern.
  Future<List<Map<String, dynamic>>?> fetchRoster() async {
    final res = await _api.get('/roster');
    final days = res?['days'] as List<dynamic>?;
    if (days == null) return null;
    online.value = true;
    return days.map((e) => Map<String, dynamic>.from(e as Map<String, dynamic>)).toList();
  }

  // ---------- Inbox ----------
  Future<List<ServerNotification>?> fetchInbox() async {
    final res = await _api.get('/inbox');
    final list = res?['notifications'] as List<dynamic>?;
    if (list == null) return null;
    online.value = true;
    return list
        .map((e) => ServerNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markInboxRead() async {
    await _api.post('/inbox/read', {});
  }
}
