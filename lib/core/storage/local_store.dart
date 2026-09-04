import 'dart:convert';

import 'package:crypto/crypto.dart';
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
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isEmpty ? 'AG' : name[0].toUpperCase();
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
class LocalStore {
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

  SharedPreferences? _prefs;
  EmployeeProfile _profile = const EmployeeProfile();

  EmployeeProfile get profile => _profile;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    final stored = _prefs!.getString(_kProfile);
    if (stored != null) {
      try {
        _profile =
            EmployeeProfile.fromJson(jsonDecode(stored) as Map<String, dynamic>);
      } catch (_) {
        // Corrupted profile falls back to defaults on next save.
      }
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
  Future<void> setLocaleCode(String code) async =>
      _p.setString(_kLocale, code);

  // ---- Session ----
  bool get isOnboarded => _prefs?.getBool(_kOnboarded) ?? false;
  Future<void> setOnboarded(bool value) async => _p.setBool(_kOnboarded, value);
  String? get nationalId => _prefs?.getString('last_national_id');

  /// Wipes everything user-specific (logout / re-onboarding).
  Future<void> clearSession() async {
    _profile = const EmployeeProfile();
    await _p.remove(_kProfile);
    await _p.remove(_kOnboarded);
    await _p.remove(_kPinHash);
    await _p.remove(_kSurveySubmitted);
    await _p.remove(_kInboxRead);
    await _p.remove(_kRefCounter);
    await _p.reload();
  }

  // ---- PIN (hashed; swap for secure storage / server check in production) ----
  Future<bool> hasPin() async => _p.getString(_kPinHash) != null;

  Future<void> setPin(String pin) async =>
      _p.setString(_kPinHash, _hash(pin));

  Future<bool> verifyPin(String pin) async =>
      _p.getString(_kPinHash) == _hash(pin);

  String _hash(String pin) =>
      sha256.convert(utf8.encode('elaraby_connect::$pin')).toString();

  // ---- Profile ----
  Future<void> saveProfile(EmployeeProfile profile) async {
    _profile = profile;
    await _p.setString(_kProfile, jsonEncode(profile.toJson()));
  }

  // ---- Settings toggles ----
  bool getSetting(String key, {bool defaultValue = false}) =>
      _prefs?.getBool('$_kSettingsPrefix$key') ?? defaultValue;

  Future<void> setSetting(String key, bool value) async =>
      _p.setBool('$_kSettingsPrefix$key', value);

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
  Future<void> setVacationBalance(int days) async =>
      _p.setInt(_kVacationDays, days < 0 ? 0 : days);

  Future<void> deductVacationDays(int days) async {
    final remaining = vacationDaysRemaining - days;
    await _p.setInt(
        _kVacationDays, remaining < 0 ? 0 : remaining);
  }
}
