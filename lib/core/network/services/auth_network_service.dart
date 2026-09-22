import 'package:flutter/foundation.dart';

import '../../../features/benefits/data/benefits_content.dart';
import '../../../features/home/data/home_content.dart';
import '../../storage/local_store.dart';
import '../api_client.dart';
import '../backend.dart';
import '../push_service.dart';

/// Network operations dedicated to Authentication, PIN Security, and Profile lifecycle.
class AuthNetworkService {
  final ApiClient _api;
  final ValueNotifier<bool> _online;

  String? _resetToken;

  AuthNetworkService(this._api, this._online);

  String? get resetToken => _resetToken;

  /// Asks the server for an OTP. Returns [OtpResponse] with found status,
  /// the employee's masked phone number, devCode (when applicable), and sms delivery status.
  Future<OtpResponse> requestOtp(String nationalId) async {
    final res = await _api.post('/auth/otp', {'nationalId': nationalId});
    if (res == null) {
      // Offline fallback: allow local testing without failing flow
      return const OtpResponse(found: true, devCode: null);
    }
    _online.value = true;
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
  Future<AuthResult> verifyOtp(
    String nationalId,
    String code, {
    String? firebaseIdToken,
  }) async {
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
    applyEmployee(res['employee'] as Map<String, dynamic>);
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
        applyEmployee(res!['employee'] as Map<String, dynamic>);
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
    _online.value = true;
    await _api.setToken(res['token'] as String);
    applyEmployee(res['employee'] as Map<String, dynamic>);
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
      _online.value = true;
      return AuthResult.success;
    }
    return AuthResult.invalid;
  }

  /// Refreshes the profile (e.g. vacation balance) from the server.
  Future<void> syncProfile() async {
    if (_api.token == null) return;
    final res = await _api.get('/me');
    if (res?['employee'] != null) {
      applyEmployee(res!['employee'] as Map<String, dynamic>);
      _online.value = true;
    }
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
      applyEmployee(res['employee'] as Map<String, dynamic>);
      return true;
    }
    return false;
  }

  /// Permanently deletes the employee's account on the backend.
  Future<bool> deleteAccount({
    required String pin,
    required Future<void> Function() onCleared,
  }) async {
    final res = await _api.post('/employee/delete-account', {'pin': pin});
    if (res != null && res['success'] == true) {
      await onCleared();
      return true;
    }
    return false;
  }

  void applyEmployee(Map<String, dynamic> employee) {
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
    final tenantId =
        (employee['tenantId'] as String? ?? 'elaraby').toLowerCase();
    if (tenantId.isNotEmpty &&
        tenantId != LocalStore.instance.activeTenantSlug) {
      LocalStore.instance.setActiveTenantSlug(tenantId);
    }
  }
}
