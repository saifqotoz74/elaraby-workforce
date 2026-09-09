import 'dart:convert';
import 'dart:io' show Platform;
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local employee profile — defaults match the seeded demo identity until a
/// real backend replaces them.
class EmployeeProfile {
  final String name;
  final String employeeCode;
  final String factory;
  final String department;
  final String position;
  final String supervisor;
  final String phone;
  final String address;
  final String emergencyContact;
  final String emergencyName;
  final String emergencyRelationship;

  const EmployeeProfile({
    this.name = 'Ahmed Ghannam',
    this.employeeCode = 'EG-20481',
    this.factory = '10th of Ramadan',
    this.department = 'Production A',
    this.position = 'Machine Operator',
    this.supervisor = 'Mohamed Hassan',
    this.phone = '+20 100 123 4592',
    this.address = 'Block 12, 10th of Ramadan City',
    this.emergencyContact = '+20 111 987 6543',
    this.emergencyName = 'Mahmoud Ghannam',
    this.emergencyRelationship = 'Father',
  });

  String get initials {
    final clean = name.trim();
    if (clean.isEmpty) return 'EC';
    final parts =
        clean.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
    }
    return clean[0].toUpperCase();
  }

  /// Phone shown as `+20 100 •••••92` in OTP-style hints.
  String get maskedPhone {
    if (phone.length < 4) return phone;
    return '${phone.substring(0, phone.length - 8)}•••••${phone.substring(phone.length - 2)}';
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'employeeCode': employeeCode,
        'factory': factory,
        'department': department,
        'position': position,
        'supervisor': supervisor,
        'phone': phone,
        'address': address,
        'emergencyContact': emergencyContact,
        'emergencyName': emergencyName,
        'emergencyRelationship': emergencyRelationship,
      };

  factory EmployeeProfile.fromJson(Map<String, dynamic> json) =>
      EmployeeProfile(
        name: json['name'] as String? ?? 'Ahmed Ghannam',
        employeeCode: json['employeeCode'] as String? ?? 'EG-20481',
        factory: json['factory'] as String? ?? '10th of Ramadan',
        department: json['department'] as String? ?? 'Production A',
        position: json['position'] as String? ?? 'Machine Operator',
        supervisor: json['supervisor'] as String? ?? 'Mohamed Hassan',
        phone: json['phone'] as String? ?? '+20 100 123 4592',
        address: json['address'] as String? ?? 'Block 12, 10th of Ramadan City',
        emergencyContact:
            json['emergencyContact'] as String? ?? '+20 111 987 6543',
        emergencyName: json['emergencyName'] as String? ?? 'Mahmoud Ghannam',
        emergencyRelationship:
            json['emergencyRelationship'] as String? ?? 'Father',
      );

  EmployeeProfile copyWith({
    String? name,
    String? employeeCode,
    String? factory,
    String? department,
    String? position,
    String? supervisor,
    String? phone,
    String? address,
    String? emergencyContact,
    String? emergencyName,
    String? emergencyRelationship,
  }) =>
      EmployeeProfile(
        name: name ?? this.name,
        employeeCode: employeeCode ?? this.employeeCode,
        factory: factory ?? this.factory,
        department: department ?? this.department,
        position: position ?? this.position,
        supervisor: supervisor ?? this.supervisor,
        phone: phone ?? this.phone,
        address: address ?? this.address,
        emergencyContact: emergencyContact ?? this.emergencyContact,
        emergencyName: emergencyName ?? this.emergencyName,
        emergencyRelationship:
            emergencyRelationship ?? this.emergencyRelationship,
      );
}

/// Single wrapper over [SharedPreferences] for everything that must survive
/// an app restart: locale, session, PIN, profile, settings, inbox read state,
/// trip bookings and the survey.
class LocalStore extends ChangeNotifier {
  static final LocalStore instance = LocalStore._();
  LocalStore._();

  static const _kLocale = 'app_locale';
  static const _kOnboarded = 'onboarded';
  static const _kPinHash = 'pin_hash';
  static const _kProfile = 'employee_profile';
  static const _kSurveySubmitted = 'survey_submitted';
  static const _kInboxRead = 'inbox_read_ids';
  static const _kRefCounter = 'request_ref_counter';
  static const _kSettingsPrefix = 'setting_';
  static const _kTripPrefix = 'trip_booking_';
  static const _kVacationDays = 'vacation_days_remaining';

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  SharedPreferences? _prefs;
  EmployeeProfile _profile = const EmployeeProfile();
  String? _cachedPinHash;

  EmployeeProfile get profile => _profile;
  SharedPreferences? get rawPrefs => _prefs;
  bool get hasSavedProfile => _prefs?.containsKey(_kProfile) ?? false;

  bool get _isTest {
    try {
      return Platform.environment.containsKey('FLUTTER_TEST');
    } on UnsupportedError {
      return false;
    }
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    final stored = _prefs!.getString(_kProfile);
    if (stored != null) {
      try {
        _profile = EmployeeProfile.fromJson(
            jsonDecode(stored) as Map<String, dynamic>);
      } on FormatException catch (e) {
        debugPrint('LocalStore: Corrupted profile JSON ($e), using defaults');
      } on TypeError catch (e) {
        debugPrint('LocalStore: Invalid profile schema ($e), using defaults');
      }
    }

    if (_isTest) {
      _cachedPinHash = _prefs!.getString(_kPinHash);
      return;
    }

    // Load PIN hash from hardware-backed secure storage
    try {
      _cachedPinHash = await _secureStorage.read(key: _kPinHash);
    } on Exception catch (e) {
      debugPrint('LocalStore: Secure storage read PIN error: $e');
      _cachedPinHash = null;
    }

    // Seamless legacy migration: if pin_hash was in SharedPreferences, migrate to secure storage
    if (_cachedPinHash == null && _prefs!.containsKey(_kPinHash)) {
      final legacy = _prefs!.getString(_kPinHash);
      if (legacy != null && legacy.isNotEmpty) {
        _cachedPinHash = legacy;
        try {
          await _secureStorage.write(key: _kPinHash, value: legacy);
        } on Exception catch (e) {
          debugPrint('LocalStore: Secure storage write PIN error: $e');
        }
      }
      await _prefs!.remove(_kPinHash);
    }

    // Load encrypted drafts into memory cache
    try {
      final secRaw = await _secureStorage.read(key: 'sec_draft_raise_concern');
      if (secRaw != null) {
        _secureDrafts['raise_concern'] =
            jsonDecode(secRaw) as Map<String, dynamic>;
      }
    } on Exception catch (e) {
      debugPrint('LocalStore: Secure storage read draft error: $e');
    }
  }

  SharedPreferences get _p {
    final prefs = _prefs;
    if (prefs == null) {
      throw StateError('LocalStore.init() must be awaited before use');
    }
    return prefs;
  }

  // ---- Locale ----
  String? get localeCode => _prefs?.getString(_kLocale);
  Future<void> setLocaleCode(String code) async => _p.setString(_kLocale, code);

  // ---- Theme Mode (System, Light, Dark / Factory Night Shift) ----
  static const _kThemeMode = 'app_theme_mode';
  String get themeMode => _prefs?.getString(_kThemeMode) ?? 'system';
  Future<void> setThemeMode(String mode) async =>
      _p.setString(_kThemeMode, mode);

  final Map<String, Map<String, dynamic>> _secureDrafts = {};

  // ---- Form Drafts (Prevents lost work during factory network dropouts) ----
  Future<void> saveDraft(String formKey, Map<String, dynamic> data) async {
    final serialized = jsonEncode(data);
    if (formKey == 'raise_concern') {
      _secureDrafts[formKey] = data;
      if (!_isTest) {
        try {
          await _secureStorage.write(
              key: 'sec_draft_$formKey', value: serialized);
          await _p.remove('draft_$formKey');
          return;
        } on Exception catch (e) {
          debugPrint('LocalStore: Secure draft write error: $e');
        }
      }
    }
    await _p.setString('draft_$formKey', serialized);
  }

  Map<String, dynamic>? getDraft(String formKey) {
    if (formKey == 'raise_concern' && _secureDrafts.containsKey(formKey)) {
      return _secureDrafts[formKey];
    }
    final raw = _prefs?.getString('draft_$formKey');
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } on FormatException catch (e) {
      debugPrint('LocalStore: Corrupted draft JSON for $formKey: $e');
      return null;
    } on TypeError catch (e) {
      debugPrint('LocalStore: Invalid draft schema for $formKey: $e');
      return null;
    }
  }

  Future<void> clearDraft(String formKey) async {
    _secureDrafts.remove(formKey);
    if (formKey == 'raise_concern' && !_isTest) {
      try {
        await _secureStorage.delete(key: 'sec_draft_$formKey');
      } on Exception catch (e) {
        debugPrint('LocalStore: Failed deleting secure draft: $e');
      }
    }
    await _p.remove('draft_$formKey');
  }

  // ---- Session ----
  bool get isOnboarded => _prefs?.getBool(_kOnboarded) ?? false;
  Future<void> setOnboarded(bool value) async => _p.setBool(_kOnboarded, value);
  String? get nationalId => _prefs?.getString('last_national_id');

  /// Wipes everything user-specific (logout / re-onboarding).
  Future<void> clearSession() async {
    _profile = const EmployeeProfile();
    _cachedPinHash = null;
    if (!_isTest) {
      try {
        await _secureStorage.delete(key: _kPinHash);
      } on Exception catch (e) {
        debugPrint('LocalStore: Secure PIN delete error: $e');
      }
    }
    await _p.remove(_kProfile);
    await _p.remove(_kOnboarded);
    await _p.remove(_kPinHash);
    await _p.remove(_kSurveySubmitted);
    await _p.remove(_kInboxRead);
    await _p.remove(_kRefCounter);
    await _p.remove('salary_gate_fails');
    await _p.remove('salary_gate_lockout_until');
    await _p.reload();
    notifyListeners();
  }

  // ---- PIN (hardware-backed secure storage with AES-256 GCM) ----
  Future<bool> hasPin() async {
    if (_cachedPinHash != null) return true;
    if (_isTest) {
      _cachedPinHash = _p.getString(_kPinHash);
      return _cachedPinHash != null;
    }
    try {
      _cachedPinHash = await _secureStorage.read(key: _kPinHash);
    } on Exception catch (e) {
      debugPrint('LocalStore: hasPin secure read error: $e');
    }
    return _cachedPinHash != null || _p.getString(_kPinHash) != null;
  }

  Future<void> setPin(String pin) async {
    final hashed = _hash(pin);
    _cachedPinHash = hashed;
    if (_isTest) {
      await _p.setString(_kPinHash, hashed);
      return;
    }
    try {
      await _secureStorage.write(key: _kPinHash, value: hashed);
    } on Exception catch (e) {
      debugPrint('LocalStore: setPin secure write error: $e');
    }
    // Ensure plaintext key is never retained in SharedPreferences
    await _p.remove(_kPinHash);
  }

  Future<bool> verifyPin(String pin) async {
    final candidate = _hash(pin);
    final legacyCandidate = _legacyHash(pin);

    var stored = _cachedPinHash;
    if (stored == null && !_isTest) {
      try {
        stored = await _secureStorage.read(key: _kPinHash);
        _cachedPinHash = stored;
      } on Exception catch (e) {
        debugPrint('LocalStore: verifyPin secure read error: $e');
      }
    } else if (stored == null && _isTest) {
      stored = _p.getString(_kPinHash);
      _cachedPinHash = stored;
    }

    if (stored != null) {
      if (stored == candidate) return true;
      if (stored == legacyCandidate) {
        await setPin(pin);
        return true;
      }
      return false;
    }

    // Fallback check in SharedPreferences for legacy un-migrated setups
    final legacyStored = _p.getString(_kPinHash);
    if (legacyStored != null) {
      if (legacyStored == candidate || legacyStored == legacyCandidate) {
        await setPin(pin);
        return true;
      }
    }
    return false;
  }

  String _hash(String pin) {
    final salt = utf8.encode('elaraby_connect_workforce_secure_salt_v2');
    var hmac = Hmac(sha256, salt);
    var digest = hmac.convert(utf8.encode(pin)).bytes;
    for (var i = 0; i < 1000; i++) {
      digest = hmac.convert(digest).bytes;
    }
    return digest.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  String _legacyHash(String pin) =>
      sha256.convert(utf8.encode('elaraby_connect::$pin')).toString();

  // ---- Profile ----
  Future<void> saveProfile(EmployeeProfile profile) async {
    _profile = profile;
    await _p.setString(_kProfile, jsonEncode(profile.toJson()));
    notifyListeners();
  }

  // ---- Settings toggles ----
  bool getSetting(String key, {bool defaultValue = false}) =>
      _prefs?.getBool('$_kSettingsPrefix$key') ?? defaultValue;

  Future<void> setSetting(String key, bool value) async {
    await _p.setBool('$_kSettingsPrefix$key', value);
    notifyListeners();
  }

  // ---- Survey ----
  bool get surveySubmitted => _prefs?.getBool(_kSurveySubmitted) ?? false;
  Future<void> setSurveySubmitted() async =>
      _p.setBool(_kSurveySubmitted, true);

  // ---- Inbox read state ----
  Set<String> get readInboxIds =>
      (_prefs?.getStringList(_kInboxRead) ?? <String>[]).toSet();

  Future<void> markInboxRead(Iterable<String> ids) async {
    final merged = {...readInboxIds, ...ids}.toList()..sort();
    await _p.setStringList(_kInboxRead, merged);
  }

  // ---- Trip bookings ----
  bool isTripBooked(String tripId) =>
      _prefs?.getBool('$_kTripPrefix$tripId') ?? false;

  Future<void> setTripBooked(String tripId, bool value) async =>
      _p.setBool('$_kTripPrefix$tripId', value);

  // ---- Request reference numbers ----
  /// Monotonic per-install counter so generated refs never collide.
  int nextRefNumber() {
    final next = (_prefs?.getInt(_kRefCounter) ?? 200) + 1;
    _p.setInt(_kRefCounter, next);
    return next;
  }

  // ---- Vacation balance ----
  static const defaultVacationDays = 12;

  int get vacationDaysRemaining =>
      _prefs?.getInt(_kVacationDays) ?? defaultVacationDays;

  /// Direct set — used when the server is the source of truth.
  Future<void> setVacationBalance(int days) async {
    await _p.setInt(_kVacationDays, days < 0 ? 0 : days);
    notifyListeners();
  }

  Future<void> deductVacationDays(int days) async {
    final remaining = vacationDaysRemaining - days;
    await _p.setInt(_kVacationDays, remaining < 0 ? 0 : remaining);
    notifyListeners();
  }

  Future<void> addVacationDays(int days) async {
    final remaining = vacationDaysRemaining + days;
    await _p.setInt(_kVacationDays, remaining);
    notifyListeners();
  }

  // ---- Persistent Salary Gate Lockout & Attempts ----
  int get salaryGateFailedAttempts => _prefs?.getInt('salary_gate_fails') ?? 0;

  Future<void> setSalaryGateFailedAttempts(int count) async =>
      _p.setInt('salary_gate_fails', count);

  int get salaryGateLockoutUntil =>
      _prefs?.getInt('salary_gate_lockout_until') ?? 0;

  Future<void> setSalaryGateLockoutUntil(int epochMs) async =>
      _p.setInt('salary_gate_lockout_until', epochMs);

  Future<void> resetSalaryGateLockout() async {
    await _p.remove('salary_gate_fails');
    await _p.remove('salary_gate_lockout_until');
  }
}
