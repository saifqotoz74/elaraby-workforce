import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:elaraby_workforce/core/services/biometric_service.dart';
import 'package:elaraby_workforce/features/profile/presentation/controllers/settings_controller.dart';
import 'package:elaraby_workforce/core/repositories/settings_repository.dart';

class MockSettingsRepository implements SettingsRepository {
  bool _biometric = false;
  bool _salaryProtection = false;
  bool _notifications = false;
  String _theme = 'system';
  String? _locale;

  @override
  bool getSetting(String key, {bool defaultValue = false}) {
    if (key == 'fingerprint') return _biometric;
    if (key == 'salary_protection') return _salaryProtection;
    if (key == 'notifications') return _notifications;
    return defaultValue;
  }

  @override
  bool get biometricEnabled => _biometric;

  @override
  bool get salaryProtectionEnabled => _salaryProtection;

  @override
  bool get notificationsEnabled => _notifications;

  @override
  String get themeMode => _theme;

  @override
  Future<void> setSetting(String key, bool value) async {
    if (key == 'fingerprint') _biometric = value;
    if (key == 'salary_protection') _salaryProtection = value;
    if (key == 'notifications') _notifications = value;
  }

  @override
  Future<void> setThemeMode(String mode) async {
    _theme = mode;
  }

  @override
  String? get localeCode => _locale;

  @override
  Future<void> setLocaleCode(String code) async {
    _locale = code;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late BiometricService biometricService;

  setUp(() {
    biometricService = BiometricService();
  });

  tearDown(() {
    biometricService.resetMock();
  });

  group('BiometricService - Hardware & Enrollment Capability Checks', () {
    test('reports none when device does not support biometric hardware', () async {
      biometricService.configureMock(
        isSupported: false,
        canCheckBiometrics: false,
        availableBiometrics: [],
      );

      final capability = await biometricService.checkCapability();

      expect(capability.isSupported, isFalse);
      expect(capability.hasEnrolledBiometrics, isFalse);
      expect(capability.canAuthenticate, isFalse);
      expect(capability.biometricKind, equals(BiometricKind.none));
      expect(capability.biometricName, equals('none'));
    });

    test('reports unsupported when hardware exists but zero biometrics enrolled', () async {
      biometricService.configureMock(
        isSupported: true,
        canCheckBiometrics: false,
        availableBiometrics: [],
      );

      final capability = await biometricService.checkCapability();

      expect(capability.isSupported, isTrue);
      expect(capability.hasEnrolledBiometrics, isFalse);
      expect(capability.canAuthenticate, isFalse);
      expect(capability.biometricKind, equals(BiometricKind.none));
    });

    test('reports ready when hardware is supported and biometrics are enrolled', () async {
      biometricService.configureMock(
        isSupported: true,
        canCheckBiometrics: true,
        availableBiometrics: [BiometricType.fingerprint],
      );

      final capability = await biometricService.checkCapability();

      expect(capability.isSupported, isTrue);
      expect(capability.hasEnrolledBiometrics, isTrue);
      expect(capability.canAuthenticate, isTrue);
      expect(capability.isFingerprint, isTrue);
    });
  });

  group('BiometricService - Face ID vs Fingerprint Modality Detection', () {
    test('correctly identifies Face ID modality with localized strings and icon', () async {
      biometricService.configureMock(
        isSupported: true,
        canCheckBiometrics: true,
        availableBiometrics: [BiometricType.face],
      );

      final capability = await biometricService.checkCapability();

      expect(capability.isFaceId, isTrue);
      expect(capability.isFingerprint, isFalse);
      expect(capability.biometricKind, equals(BiometricKind.faceId));
      expect(capability.biometricName, equals('Face ID'));
      expect(capability.localizedName(false), equals('Face ID'));
      expect(capability.localizedName(true), equals('بصمة الوجه'));
      expect(capability.buttonLabel(false), equals('Unlock with Face ID'));
      expect(capability.buttonLabel(true), equals('الدخول ببصمة الوجه'));
      expect(capability.icon, equals(Icons.face_rounded));
    });

    test('correctly identifies Fingerprint modality with localized strings and icon', () async {
      biometricService.configureMock(
        isSupported: true,
        canCheckBiometrics: true,
        availableBiometrics: [BiometricType.fingerprint],
      );

      final capability = await biometricService.checkCapability();

      expect(capability.isFaceId, isFalse);
      expect(capability.isFingerprint, isTrue);
      expect(capability.biometricKind, equals(BiometricKind.fingerprint));
      expect(capability.biometricName, equals('Fingerprint'));
      expect(capability.localizedName(false), equals('Fingerprint'));
      expect(capability.localizedName(true), equals('بصمة الإصبع'));
      expect(capability.buttonLabel(false), equals('Unlock with fingerprint'));
      expect(capability.buttonLabel(true), equals('الدخول بالبصمة'));
      expect(capability.icon, equals(Icons.fingerprint_rounded));
    });

    test('correctly identifies multiple modalities (Face ID and Fingerprint)', () async {
      biometricService.configureMock(
        isSupported: true,
        canCheckBiometrics: true,
        availableBiometrics: [BiometricType.face, BiometricType.fingerprint],
      );

      final capability = await biometricService.checkCapability();

      expect(capability.biometricKind, equals(BiometricKind.multiple));
      expect(capability.biometricName, equals('Face ID / Fingerprint'));
      expect(capability.isFaceId, isTrue);
      expect(capability.isFingerprint, isTrue);
      expect(capability.localizedName(true), equals('بصمة الوجه / الإصبع'));
    });
  });

  group('BiometricService - Authentication Execution & Result Handling', () {
    test('authenticate returns true when biometric recognition succeeds', () async {
      biometricService.configureMock(
        biometricResult: true,
      );

      final result = await biometricService.authenticate(
        reason: 'Test biometric authentication',
      );

      expect(result, isTrue);
    });

    test('authenticate returns false when user cancels or recognition fails', () async {
      biometricService.configureMock(
        biometricResult: false,
      );

      final result = await biometricService.authenticate(
        reason: 'Test biometric cancellation',
      );

      expect(result, isFalse);
    });

    test('authenticate propagates exception when mock exception configured', () async {
      biometricService.configureMock(
        authException: Exception('Hardware sensor locked'),
      );

      expect(
        () => biometricService.authenticate(reason: 'Test exception'),
        throwsA(isA<Exception>()),
      );
    });
  });

  group('BiometricService - Smooth Fallback to 4-Digit PIN', () {
    test('verifyPinFallback returns true on valid PIN', () async {
      biometricService.configureMock(pinResult: true);

      final ok = await biometricService.verifyPinFallback('1234');
      expect(ok, isTrue);
    });

    test('verifyPinFallback returns false on invalid PIN', () async {
      biometricService.configureMock(pinResult: false);

      final ok = await biometricService.verifyPinFallback('0000');
      expect(ok, isFalse);
    });

    test('SettingsNotifier prevents enabling biometrics if device lacks capability', () async {
      biometricService.configureMock(
        isSupported: false,
        canCheckBiometrics: false,
        availableBiometrics: [],
      );

      final repo = MockSettingsRepository();
      final notifier = SettingsNotifier(repo, biometricService);

      final success = await notifier.setBiometric(true);

      expect(success, isFalse);
      expect(notifier.state.biometricEnabled, isFalse);
      expect(repo.biometricEnabled, isFalse);
    });

    test('SettingsNotifier allows enabling biometrics if device has enrolled hardware', () async {
      biometricService.configureMock(
        isSupported: true,
        canCheckBiometrics: true,
        availableBiometrics: [BiometricType.fingerprint],
      );

      final repo = MockSettingsRepository();
      final notifier = SettingsNotifier(repo, biometricService);

      final success = await notifier.setBiometric(true);

      expect(success, isTrue);
      expect(notifier.state.biometricEnabled, isTrue);
      expect(repo.biometricEnabled, isTrue);
    });

    test('SettingsNotifier cleanly disables biometrics without checking hardware', () async {
      final repo = MockSettingsRepository();
      final notifier = SettingsNotifier(repo, biometricService);

      final success = await notifier.setBiometric(false);

      expect(success, isTrue);
      expect(notifier.state.biometricEnabled, isFalse);
      expect(repo.biometricEnabled, isFalse);
    });
  });
}
