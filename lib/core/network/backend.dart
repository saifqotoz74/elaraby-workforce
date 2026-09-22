import 'package:flutter/foundation.dart';

import '../../features/benefits/data/benefits_content.dart';
import '../../features/home/data/home_content.dart';
import '../../features/services/data/requests_store.dart';
import '../../features/services/data/shift_model.dart';
import '../../features/services/data/transport_model.dart';
import '../storage/local_store.dart';
import 'api_client.dart';
import 'connectivity_service.dart';
import 'push_service.dart';
import 'services/auth_network_service.dart';
import 'services/inbox_network_service.dart';
import 'services/payroll_network_service.dart';
import 'services/requests_network_service.dart';
import 'services/shifts_network_service.dart';
import 'services/transport_network_service.dart';

export 'services/auth_network_service.dart';
export 'services/inbox_network_service.dart';
export 'services/payroll_network_service.dart';
export 'services/requests_network_service.dart';
export 'services/shifts_network_service.dart';
export 'services/transport_network_service.dart';

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

/// Architectural Facade coordinating modular domain services:
/// - [AuthNetworkService] for auth, OTP, PIN, and profile lifecycle
/// - [RequestsNetworkService] for employee requests and file attachments
/// - [PayrollNetworkService] for salary statements, unlocking, and loans
/// - [ShiftsNetworkService] for roster, shift swaps, punches, and overtime
/// - [TransportNetworkService] for commute, fleet routes, and driver manifest
/// - [InboxNetworkService] for notifications, app versioning, and concerns
///
/// Every call degrades gracefully: when the server is unreachable the app keeps
/// working with its local stores (offline-first).
class Backend {
  static final Backend instance = Backend._();

  final ApiClient _api = ApiClient.instance;

  /// True when the device has an active network connection (backed by connectivity_plus).
  final ValueNotifier<bool> online =
      ValueNotifier(ConnectivityService.instance.isOnline);

  // Modular Domain Services
  late final AuthNetworkService auth;
  late final RequestsNetworkService requests;
  late final PayrollNetworkService payroll;
  late final ShiftsNetworkService shifts;
  late final TransportNetworkService transport;
  late final InboxNetworkService inbox;

  Backend._() {
    auth = AuthNetworkService(_api, online);
    requests = RequestsNetworkService(_api, online);
    payroll = PayrollNetworkService(_api, online);
    shifts = ShiftsNetworkService(_api, online);
    transport = TransportNetworkService(_api);
    inbox = InboxNetworkService(_api, online);

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

  /// Checks server reachability. Returns true if server is operational.
  /// Does NOT set client interface to "offline" if server is unreachable or times out.
  Future<bool> ping() async {
    final res = await _api.get('/health', timeout: const Duration(seconds: 3));
    return res?['ok'] == true;
  }

  // ---------- Auth & Profile Delegation ----------
  Future<OtpResponse> requestOtp(String nationalId) =>
      auth.requestOtp(nationalId);

  Future<AuthResult> verifyOtp(
    String nationalId,
    String code, {
    String? firebaseIdToken,
  }) =>
      auth.verifyOtp(nationalId, code, firebaseIdToken: firebaseIdToken);

  Future<bool> setPin(String nationalId, String pin) =>
      auth.setPin(nationalId, pin);

  Future<AuthResult> verifyPin(String pin) => auth.verifyPin(pin);

  Future<AuthResult> changePin(String currentPin, String newPin) =>
      auth.changePin(currentPin, newPin);

  Future<void> syncProfile() => auth.syncProfile();

  Future<bool> updateProfile({
    String? phone,
    String? address,
    String? emergencyContact,
    String? emergencyName,
    String? emergencyRelationship,
  }) =>
      auth.updateProfile(
        phone: phone,
        address: address,
        emergencyContact: emergencyContact,
        emergencyName: emergencyName,
        emergencyRelationship: emergencyRelationship,
      );

  Future<bool> deleteAccount({required String pin}) =>
      auth.deleteAccount(pin: pin, onCleared: clearAllUserData);

  // ---------- Requests Delegation ----------
  Future<bool> syncRequests() => requests.syncRequests();

  Future<EmployeeRequest?> submitRequest({
    required String type,
    required String title,
    required Map<String, String> details,
    int? days,
    String? attachmentUrl,
    String? attachmentName,
    String? idempotencyKey,
    void Function(String error)? onPermanentError,
  }) =>
      requests.submitRequest(
        type: type,
        title: title,
        details: details,
        days: days,
        attachmentUrl: attachmentUrl,
        attachmentName: attachmentName,
        idempotencyKey: idempotencyKey,
        onPermanentError: onPermanentError,
      );

  Future<Map<String, dynamic>?> uploadAttachment({
    required String name,
    required String base64Data,
  }) =>
      requests.uploadAttachment(name: name, base64Data: base64Data);

  Future<bool> cancelRequest(String id) => requests.cancelRequest(id);

  // ---------- Payroll & Loans Delegation ----------
  Future<String?> unlockSalary(String pin) => payroll.unlockSalary(pin);

  Future<Map<String, dynamic>?> fetchPayroll({
    String? pin,
    String? salaryToken,
    String? period,
  }) =>
      payroll.fetchPayroll(
        pin: pin,
        salaryToken: salaryToken,
        period: period,
      );

  Future<List<String>?> fetchPayrollHistoryPeriods({
    String? pin,
    String? salaryToken,
  }) =>
      payroll.fetchPayrollHistoryPeriods(
        pin: pin,
        salaryToken: salaryToken,
      );

  Future<Map<String, dynamic>?> fetchLoanEligibility() =>
      payroll.fetchLoanEligibility();

  Future<List<Map<String, dynamic>>?> fetchLoans() => payroll.fetchLoans();

  Future<Map<String, dynamic>?> applyLoan(
    Map<String, dynamic> data, {
    String? pin,
    String? salaryToken,
  }) =>
      payroll.applyLoan(data, pin: pin, salaryToken: salaryToken);

  // ---------- Shifts & Attendance Delegation ----------
  Future<List<Map<String, dynamic>>?> fetchRoster() => shifts.fetchRoster();

  Future<List<ShiftWeek>?> fetchMultiWeekRoster() =>
      shifts.fetchMultiWeekRoster();

  Future<List<ShiftSwapColleague>?> fetchSwapColleagues(String date) =>
      shifts.fetchSwapColleagues(date);

  Future<ShiftSwapRequest?> submitShiftSwap({
    required String targetEmployeeId,
    required String date,
    String? reason,
  }) =>
      shifts.submitShiftSwap(
        targetEmployeeId: targetEmployeeId,
        date: date,
        reason: reason,
      );

  Future<bool> respondShiftSwap(String swapId, String decision) =>
      shifts.respondShiftSwap(swapId, decision);

  Future<List<ShiftSwapRequest>?> fetchShiftSwaps() =>
      shifts.fetchShiftSwaps();

  Future<OvertimeClaim?> submitOvertimeClaim({
    required String date,
    required double hours,
    required String timePeriod,
    String? reason,
  }) =>
      shifts.submitOvertimeClaim(
        date: date,
        hours: hours,
        timePeriod: timePeriod,
        reason: reason,
      );

  Future<List<OvertimeClaim>?> fetchOvertimeClaims() =>
      shifts.fetchOvertimeClaims();

  Future<TodayPunchState?> fetchTodayPunchState([String? date]) =>
      shifts.fetchTodayPunchState(date);

  Future<Map<String, dynamic>?> submitAttendancePunch({
    required String type,
    double? lat,
    double? lng,
    String? qrToken,
  }) =>
      shifts.submitAttendancePunch(
        type: type,
        lat: lat,
        lng: lng,
        qrToken: qrToken,
      );

  Future<Map<String, dynamic>?> bulkSyncPunches(
    List<Map<String, dynamic>> punches,
  ) =>
      shifts.bulkSyncPunches(punches);

  // ---------- Transport Delegation ----------
  Future<MyCommuteState?> fetchMyCommute() => transport.fetchMyCommute();

  Future<List<BusRoute>?> fetchBusRoutes({String? factory, String? shift}) =>
      transport.fetchBusRoutes(factory: factory, shift: shift);

  Future<bool> selectPickupStop({
    required String routeId,
    required String stopId,
  }) =>
      transport.selectPickupStop(routeId: routeId, stopId: stopId);

  Future<bool> requestRouteTransfer({
    required String targetRouteId,
    String? targetStopId,
    String? date,
    String? reason,
  }) =>
      transport.requestRouteTransfer(
        targetRouteId: targetRouteId,
        targetStopId: targetStopId,
        date: date,
        reason: reason,
      );

  Future<BoardingPassData?> fetchBoardingPass() =>
      transport.fetchBoardingPass();

  Future<bool> reportRouteIncident({
    required String routeId,
    required String type,
    required String message,
    int delayMinutes = 15,
  }) =>
      transport.reportRouteIncident(
        routeId: routeId,
        type: type,
        message: message,
        delayMinutes: delayMinutes,
      );

  Future<List<RouteAlert>?> fetchRouteAlerts({String? routeId}) =>
      transport.fetchRouteAlerts(routeId: routeId);

  Future<bool> toggleCommuteOptOut({required bool optOut}) =>
      transport.toggleCommuteOptOut(optOut: optOut);

  Future<RouteManifestData?> fetchRouteManifest({required String routeId}) =>
      transport.fetchRouteManifest(routeId: routeId);

  Future<Map<String, dynamic>?> manualBoardPassenger({
    required String employeeId,
    required String routeId,
  }) =>
      transport.manualBoardPassenger(
        employeeId: employeeId,
        routeId: routeId,
      );

  Future<Map<String, dynamic>?> advanceStopDeparture({
    required String routeId,
    required String stopId,
  }) =>
      transport.advanceStopDeparture(routeId: routeId, stopId: stopId);

  Future<Map<String, dynamic>?> completeRouteRun({required String routeId}) =>
      transport.completeRouteRun(routeId: routeId);

  // ---------- Inbox & App System Delegation ----------
  Future<List<ServerNotification>?> fetchInbox() => inbox.fetchInbox();

  Future<void> markInboxRead() => inbox.markInboxRead();

  Future<AppVersionInfo?> checkAppVersion() => inbox.checkAppVersion();

  Future<Map<String, dynamic>?> submitConcern({
    required String category,
    required String details,
    String? attachedPhoto,
  }) =>
      inbox.submitConcern(
        category: category,
        details: details,
        attachedPhoto: attachedPhoto,
      );
}

/// Alias for backward compatibility and architectural design parity.
typedef AppBackend = Backend;
