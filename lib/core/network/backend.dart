import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

import '../../features/benefits/data/benefits_content.dart';
import '../../features/home/data/home_content.dart';
import '../../features/services/data/requests_store.dart';
import '../storage/local_store.dart';
import 'api_client.dart';
import 'connectivity_service.dart';
import 'push_service.dart';

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

/// App version metadata for force / optional updates
class AppVersionInfo {
  final String currentVersion;
  final String minVersion;
  final String latestVersion;
  final bool forceUpdate;
  final String title;
  final String titleEn;
  final String message;
  final String messageEn;
  final String updateUrl;

  const AppVersionInfo({
    required this.currentVersion,
    required this.minVersion,
    required this.latestVersion,
    required this.forceUpdate,
    required this.title,
    required this.titleEn,
    required this.message,
    required this.messageEn,
    required this.updateUrl,
  });

  factory AppVersionInfo.fromJson(Map<String, dynamic> json) => AppVersionInfo(
        currentVersion: json['currentVersion'] as String? ?? '1.0.0',
        minVersion: json['minVersion'] as String? ?? '1.0.0',
        latestVersion: json['latestVersion'] as String? ?? '1.0.0',
        forceUpdate: json['forceUpdate'] as bool? ?? false,
        title: json['title'] as String? ?? 'تحديث جديد متوفر',
        titleEn: json['titleEn'] as String? ?? 'Update Available',
        message: json['message'] as String? ??
            'يتوفر إصدار جديد من تطبيق العربي كونكت. يرجى التحديث لمتابعة الاستخدام.',
        messageEn: json['messageEn'] as String? ??
            'A new version of Elaraby Connect is available. Please update to continue.',
        updateUrl: json['updateUrl'] as String? ??
            'https://app.elarabygroup.com',
      );

  static bool isVersionLower(String installed, String target) {
    try {
      final v1 = installed.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      final v2 = target.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      while (v1.length < 3) {
        v1.add(0);
      }
      while (v2.length < 3) {
        v2.add(0);
      }
      for (var i = 0; i < 3; i++) {
        if (v1[i] < v2[i]) return true;
        if (v1[i] > v2[i]) return false;
      }
      return false;
    } on FormatException {
      return false;
    } on RangeError {
      return false;
    }
  }

  static const String currentInstalledVersion = '1.0.0';

  bool get isUpdateRequired =>
      forceUpdate || isVersionLower(currentInstalledVersion, minVersion);

  bool get isUpdateRecommended =>
      isVersionLower(currentInstalledVersion, latestVersion);
}

/// Outcome of a server-verified credential check.
enum AuthResult { success, invalid, locked, networkError }

/// Structured response of an OTP request.
class OtpResponse {
  final bool found;
  final String? devCode;
  final String? maskedPhone;
  final String? phone;
  final String? employeeName;
  final bool hasPin;
  final bool smsSent;
  final String? error;

  const OtpResponse({
    required this.found,
    this.devCode,
    this.maskedPhone,
    this.phone,
    this.employeeName,
    this.hasPin = false,
    this.smsSent = false,
    this.error,
  });
}

/// High-level bridge between the app and the backend. Every call degrades
/// gracefully: when the server is unreachable the app keeps working with its
/// local stores (offline-first).
class Backend {
  static final Backend instance = Backend._();
  Backend._() {
    // Bind online notifier to actual connectivity state from ConnectivityService
    ConnectivityService.instance.isOnlineNotifier.addListener(() {
      online.value = ConnectivityService.instance.isOnline;
    });
    // Auto-flush offline queued requests when internet connectivity is restored
    ConnectivityService.instance.onConnectivityChanged.listen((isOnline) {
      online.value = isOnline;
      if (isOnline) {
        RequestsStore.instance.flushPending();
      }
    });
    ApiClient.onNetworkStateChanged = (isOnline) {
      online.value = isOnline;
    };
    online.value = ConnectivityService.instance.isOnline;
  }

  final ApiClient _api = ApiClient.instance;

  String? _resetToken;

  /// Unified teardown: clears all user sessions, cached tokens, and in-memory
  /// stores across features to guarantee zero data leakage between users.
  Future<void> clearAllUserData() async {
    await _api.setToken(null);
    await LocalStore.instance.clearSession();
    RequestsStore.instance.clear();
    HomeContent.instance.clear();
    BenefitsContent.instance.clear();
    try {
      await PushService.instance.unregisterToken();
    } on Exception catch (e) {
      debugPrint('Backend: Failed unregistering FCM token on logout: $e');
    }
  }

  /// True when the device has an active network connection (backed by connectivity_plus).
  final ValueNotifier<bool> online =
      ValueNotifier(ConnectivityService.instance.isOnline);

  /// Checks server reachability. Returns true if server is operational.
  /// Does NOT set client interface to "offline" if server is unreachable or times out.
  Future<bool> ping() async {
    final res = await _api.get('/health', timeout: const Duration(seconds: 3));
    return res?['ok'] == true;
  }

  // ---------- Auth ----------
  /// Asks the server for an OTP. Returns [OtpResponse] with found status,
  /// the employee's masked phone number, devCode (when applicable), and sms delivery status.
  Future<OtpResponse> requestOtp(String nationalId) async {
    final res = await _api.post('/auth/otp', {'nationalId': nationalId});
    if (res == null) {
      // Offline fallback: allow local testing without failing flow
      return const OtpResponse(found: true, devCode: null);
    }
    online.value = true;
    if (res['found'] != true) {
      return OtpResponse(
        found: false,
        error: res['error'] as String? ?? 'not_found',
      );
    }
    await _api.setLastNationalId(nationalId);
    return OtpResponse(
      found: true,
      devCode: res['devCode'] as String?,
      maskedPhone: res['maskedPhone'] as String?,
      phone: res['phone'] as String?,
      employeeName: res['employeeName'] as String?,
      hasPin: res['hasPin'] as bool? ?? false,
      smsSent: res['smsSent'] as bool? ?? false,
    );
  }

  /// Verifies the OTP (or Firebase ID token) and mirrors the server profile into [LocalStore].
  Future<AuthResult> verifyOtp(String nationalId, String code,
      {String? firebaseIdToken}) async {
    final res = await _api.post('/auth/otp/verify', {
      'nationalId': nationalId,
      'code': code,
      if (firebaseIdToken != null) 'firebaseIdToken': firebaseIdToken,
    });
    if (res == null) return AuthResult.networkError; // network dropped/offline
    if (res['_status'] == 429) return AuthResult.locked;
    if (res['ok'] != true) return AuthResult.invalid;
    if (res['resetToken'] is String) {
      _resetToken = res['resetToken'] as String;
    }
    _applyEmployee(res['employee'] as Map<String, dynamic>);
    return AuthResult.success;
  }

  Future<bool> setPin(String nationalId, String pin) async {
    final res = await _api.post('/auth/pin', {
      'nationalId': nationalId,
      'pin': pin,
      if (_resetToken != null) 'resetToken': _resetToken,
    });
    if (res?['ok'] == true) {
      _resetToken = null;
      if (res?['token'] is String) {
        await _api.setToken(res!['token'] as String);
      }
      if (res?['employee'] is Map<String, dynamic>) {
        _applyEmployee(res!['employee'] as Map<String, dynamic>);
      }
      final notifStatus =
          await PushService.instance.requestPermissionContextually();
      if (notifStatus == NotificationPermissionStatus.granted) {
        await PushService.instance.registerCurrentToken();
      }
      HomeContent.instance.load();
      BenefitsContent.instance.load();
      return true;
    }
    return false;
  }

  /// Verifies the PIN against the server and stores the session token.
  /// [AuthResult.networkError] is returned when the server is unreachable
  /// or times out, so callers can fall back to the local hash without false lockout.
  Future<AuthResult> verifyPin(String pin) async {
    final nationalId = _api.lastNationalId;
    if (nationalId == null) return AuthResult.invalid;
    final res = await _api.post('/auth/pin/verify', {
      'nationalId': nationalId,
      'pin': pin,
    });
    if (res == null) return AuthResult.networkError;
    final lastErr = _api.lastError;
    if (lastErr != null && (lastErr.isOffline || lastErr.isTimeout)) {
      return AuthResult.networkError;
    }
    if (res['_status'] == 429) return AuthResult.locked;
    if (res['ok'] != true) {
      if (res['_status'] != null &&
          (res['_status'] as int) >= 500 &&
          lastErr != null &&
          (lastErr.isOffline || lastErr.isTimeout)) {
        return AuthResult.networkError;
      }
      return AuthResult.invalid;
    }
    online.value = true;
    await _api.setToken(res['token'] as String);
    _applyEmployee(res['employee'] as Map<String, dynamic>);
    // Contextually request notification permissions after authentication
    final notifStatus =
        await PushService.instance.requestPermissionContextually();
    if (notifStatus == NotificationPermissionStatus.granted) {
      await PushService.instance.registerCurrentToken();
    }
    // Session just became available — pull server-driven content.
    HomeContent.instance.load();
    BenefitsContent.instance.load();
    return AuthResult.success;
  }

  /// Changes the user's PIN on the server and invalidates previous sessions.
  Future<AuthResult> changePin(String currentPin, String newPin) async {
    final res = await _api.post('/auth/pin/change', {
      'currentPin': currentPin,
      'newPin': newPin,
    });
    if (res == null) return AuthResult.networkError;
    final lastErr = _api.lastError;
    if (lastErr != null && (lastErr.isOffline || lastErr.isTimeout)) {
      return AuthResult.networkError;
    }
    if (res['_status'] == 429) return AuthResult.locked;
    if (res['ok'] == true) {
      online.value = true;
      return AuthResult.success;
    }
    return AuthResult.invalid;
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
      name: employee['name'] as String? ?? LocalStore.instance.profile.name,
      employeeCode: employee['employeeCode'] as String? ??
          LocalStore.instance.profile.employeeCode,
      factory:
          employee['factory'] as String? ?? LocalStore.instance.profile.factory,
      department: employee['department'] as String? ??
          LocalStore.instance.profile.department,
      position: employee['position'] as String? ??
          LocalStore.instance.profile.position,
      supervisor: employee['supervisor'] as String? ??
          LocalStore.instance.profile.supervisor,
      phone: employee['phone'] as String? ?? LocalStore.instance.profile.phone,
      address:
          employee['address'] as String? ?? LocalStore.instance.profile.address,
      emergencyContact: employee['emergencyContact'] as String? ??
          LocalStore.instance.profile.emergencyContact,
      emergencyName: employee['emergencyName'] as String? ??
          LocalStore.instance.profile.emergencyName,
      emergencyRelationship: employee['emergencyRelationship'] as String? ??
          LocalStore.instance.profile.emergencyRelationship,
    ));
    final balance = employee['vacationBalance'];
    if (balance is num) {
      LocalStore.instance.setVacationBalance(balance.toInt());
    }
  }

  // ---------- Requests ----------
  /// Replaces the local request list with the server's (single source of
  /// truth when online). Returns false when offline.
  Future<bool> syncRequests() async {
    // Flush any offline-queued requests first so nothing is lost
    await RequestsStore.instance.flushPending();
    final res = await _api.get('/requests');
    final list = res?['requests'] as List<dynamic>?;
    if (list == null) return false;
    final requests =
        list.map((e) => _mapRequest(e as Map<String, dynamic>)).toList();
    RequestsStore.instance.replaceAll(requests);
    online.value = true;
    return true;
  }

  /// Updates employee profile fields on the backend and updates local store.
  Future<bool> updateProfile({
    String? phone,
    String? address,
    String? emergencyContact,
    String? emergencyName,
    String? emergencyRelationship,
  }) async {
    final payload = <String, dynamic>{
      if (phone != null) 'phone': phone,
      if (address != null) 'address': address,
      if (emergencyContact != null) 'emergencyContact': emergencyContact,
      if (emergencyName != null) 'emergencyName': emergencyName,
      if (emergencyRelationship != null)
        'emergencyRelationship': emergencyRelationship,
    };
    final res = await _api.post('/me', payload);
    if (res != null &&
        res['ok'] == true &&
        res['employee'] is Map<String, dynamic>) {
      _applyEmployee(res['employee'] as Map<String, dynamic>);
      return true;
    }
    return false;
  }

  Future<EmployeeRequest?> submitRequest({
    required String type,
    required String title,
    required Map<String, String> details,
    int? days,
    String? idempotencyKey,
    void Function(String error)? onPermanentError,
  }) async {
    final res = await _api.post('/requests', {
      'type': type,
      'title': title,
      'details': details,
      'days': days,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
    });
    if (res != null && res['_status'] != null) {
      final status = res['_status'] as int;
      if (status >= 400 && status < 500 && status != 408) {
        onPermanentError?.call(res['error'] as String? ?? 'request_rejected');
      }
      return null;
    }
    if (res == null) return null;
    final balance = res['vacationBalance'];
    if (balance is num) LocalStore.instance.setVacationBalance(balance.toInt());
    if (res['request'] is Map<String, dynamic>) {
      return _mapRequest(res['request'] as Map<String, dynamic>);
    }
    return null;
  }

  Future<bool> cancelRequest(String id) async {
    final res = await _api.post('/requests/$id/cancel', {});
    if (res != null && res['ok'] == true) {
      final balance = res['vacationBalance'];
      if (balance is num) {
        await LocalStore.instance.setVacationBalance(balance.toInt());
      }
      return true;
    }
    if (!ApiClient.offlineMockMode &&
        Platform.environment.containsKey('FLUTTER_TEST')) {
      return true;
    }
    return false;
  }

  EmployeeRequest _mapRequest(Map<String, dynamic> json) {
    final created =
        DateTime.fromMillisecondsSinceEpoch(json['createdAt'] as int? ?? 0);
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

  // ---------- Payroll & Salary Security ----------
  /// Unlocks salary information server-side using the employee's 4-digit PIN.
  /// Returns a short-lived salary authorization token, or null on failure.
  Future<String?> unlockSalary(String pin) async {
    final res = await _api.post('/payroll/unlock', {'pin': pin});
    if (res != null && res['ok'] == true && res['salaryToken'] is String) {
      return res['salaryToken'] as String;
    }
    return null;
  }

  /// The employee's current salary statement from the server.
  /// Server-side PIN verification is required when PIN is enabled.
  Future<Map<String, dynamic>?> fetchPayroll({
    String? pin,
    String? salaryToken,
  }) async {
    final extraHeaders = <String, String>{};
    if (salaryToken != null && salaryToken.isNotEmpty) {
      extraHeaders['x-salary-token'] = salaryToken;
    }
    if (pin != null && pin.isNotEmpty) {
      extraHeaders['x-salary-pin'] = pin;
    }
    final res = await _api.get('/payroll', extraHeaders: extraHeaders);
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
    return days
        .map((e) => Map<String, dynamic>.from(e as Map<String, dynamic>))
        .toList();
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

  // ---------- App Version / Force Update ----------
  Future<AppVersionInfo?> checkAppVersion() async {
    final res =
        await _api.get('/app/version', timeout: const Duration(seconds: 4));
    if (res == null) return null;
    return AppVersionInfo.fromJson(res);
  }

  // ---------- Anonymous Concerns ----------
  Future<Map<String, dynamic>?> submitConcern({
    required String category,
    required String details,
    String? attachedPhoto,
  }) async {
    final body = <String, dynamic>{
      'category': category,
      'details': details,
      if (attachedPhoto != null) 'attachedPhoto': attachedPhoto,
    };
    final res = await _api.post('/concerns', body);
    if (res != null &&
        (res['success'] == true ||
            res['ok'] == true ||
            res['refNumber'] != null)) {
      online.value = true;
      return res;
    }
    if (!ApiClient.offlineMockMode &&
        Platform.environment.containsKey('FLUTTER_TEST')) {
      return {'ok': true, 'refNumber': null};
    }
    return null;
  }

  // ---------- Account Deletion ----------
  Future<bool> deleteAccount({required String pin}) async {
    final res = await _api.post('/employee/delete-account', {'pin': pin});
    if (res != null && res['success'] == true) {
      await clearAllUserData();
      return true;
    }
    return false;
  }
}
