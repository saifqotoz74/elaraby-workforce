import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show IconData, Icons;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import '../storage/local_store.dart';

/// Supported biometric classification types.
enum BiometricKind {
  none,
  fingerprint,
  faceId,
  multiple,
}

/// Represents the hardware capability, enrollment state, and available
/// biometric modalities for the current device.
class BiometricCapability {
  final bool isSupported;
  final bool hasEnrolledBiometrics;
  final bool canAuthenticate;
  final List<BiometricType> availableBiometrics;
  final BiometricKind biometricKind;
  final String biometricName;

  const BiometricCapability({
    required this.isSupported,
    required this.hasEnrolledBiometrics,
    required this.canAuthenticate,
    required this.availableBiometrics,
    required this.biometricKind,
    required this.biometricName,
  });

  bool get isFaceId =>
      biometricKind == BiometricKind.faceId ||
      availableBiometrics.contains(BiometricType.face);

  bool get isFingerprint =>
      biometricKind == BiometricKind.fingerprint ||
      availableBiometrics.contains(BiometricType.fingerprint);

  String localizedName(bool isArabic) {
    if (isFaceId && !isFingerprint) {
      return isArabic ? 'بصمة الوجه' : 'Face ID';
    }
    if (isFingerprint && !isFaceId) {
      return isArabic ? 'بصمة الإصبع' : 'Fingerprint';
    }
    if (biometricKind == BiometricKind.multiple) {
      return isArabic ? 'بصمة الوجه / الإصبع' : 'Face ID / Fingerprint';
    }
    return isArabic ? 'لا يوجد' : 'none';
  }

  String buttonLabel(bool isArabic) {
    if (isFaceId && !isFingerprint) {
      return isArabic ? 'الدخول ببصمة الوجه' : 'Unlock with Face ID';
    }
    return isArabic ? 'الدخول بالبصمة' : 'Unlock with fingerprint';
  }

  IconData get icon {
    if (isFaceId && !isFingerprint) {
      return Icons.face_rounded;
    }
    return Icons.fingerprint_rounded;
  }

  static const BiometricCapability none = BiometricCapability(
    isSupported: false,
    hasEnrolledBiometrics: false,
    canAuthenticate: false,
    availableBiometrics: [],
    biometricKind: BiometricKind.none,
    biometricName: 'none',
  );
}

/// Native biometric service providing a robust abstraction over [LocalAuthentication].
/// Supports hardware checks, enrollment verification, Face ID vs Fingerprint differentiation,
/// smooth error handling, and seamless fallback to 4-digit PIN verification.
class BiometricService {
  static BiometricService instance = BiometricService();

  final LocalAuthentication _localAuth;

  // Test mode hooks for hermetic unit and widget testing
  bool isTestMode;
  bool? mockIsSupported;
  bool? mockCanCheckBiometrics;
  List<BiometricType>? mockAvailableBiometrics;
  bool? mockBiometricResult;
  Exception? mockAuthException;
  bool? mockPinResult;

  BiometricService({
    LocalAuthentication? localAuth,
    this.isTestMode = false,
    this.mockIsSupported,
    this.mockCanCheckBiometrics,
    this.mockAvailableBiometrics,
    this.mockBiometricResult,
    this.mockAuthException,
    this.mockPinResult,
  }) : _localAuth = localAuth ?? LocalAuthentication();

  /// Configures mock behavior for testing environments without physical hardware.
  void configureMock({
    bool? isSupported,
    bool? canCheckBiometrics,
    List<BiometricType>? availableBiometrics,
    bool? biometricResult,
    Exception? authException,
    bool? pinResult,
  }) {
    isTestMode = true;
    mockIsSupported = isSupported;
    mockCanCheckBiometrics = canCheckBiometrics;
    mockAvailableBiometrics = availableBiometrics;
    mockBiometricResult = biometricResult;
    mockAuthException = authException;
    mockPinResult = pinResult;
  }

  /// Resets mock test configuration to default un-mocked state.
  void resetMock() {
    isTestMode = false;
    mockIsSupported = null;
    mockCanCheckBiometrics = null;
    mockAvailableBiometrics = null;
    mockBiometricResult = null;
    mockAuthException = null;
    mockPinResult = null;
  }

  /// Checks device hardware capability, biometric enrollment, and returns
  /// the detected biometric modality (Face ID, Fingerprint, or none).
  Future<BiometricCapability> checkCapability() async {
    if (isTestMode) {
      final supported = mockIsSupported ?? true;
      final canCheck = mockCanCheckBiometrics ?? true;
      final biometrics =
          mockAvailableBiometrics ?? const [BiometricType.fingerprint];
      final hasEnrolled = canCheck && biometrics.isNotEmpty;
      final canAuth = supported && hasEnrolled;

      BiometricKind kind = BiometricKind.none;
      String name = 'none';
      if (biometrics.contains(BiometricType.face) &&
          biometrics.contains(BiometricType.fingerprint)) {
        kind = BiometricKind.multiple;
        name = 'Face ID / Fingerprint';
      } else if (biometrics.contains(BiometricType.face)) {
        kind = BiometricKind.faceId;
        name = 'Face ID';
      } else if (biometrics.contains(BiometricType.fingerprint)) {
        kind = BiometricKind.fingerprint;
        name = 'Fingerprint';
      }

      return BiometricCapability(
        isSupported: supported,
        hasEnrolledBiometrics: hasEnrolled,
        canAuthenticate: canAuth,
        availableBiometrics: biometrics,
        biometricKind: kind,
        biometricName: name,
      );
    }

    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return BiometricCapability.none;
    }

    try {
      final supported = await _localAuth.isDeviceSupported();
      final canCheck = await _localAuth.canCheckBiometrics;
      final biometrics = await _localAuth.getAvailableBiometrics();
      final hasEnrolled = canCheck && biometrics.isNotEmpty;
      final canAuth = supported && hasEnrolled;

      BiometricKind kind = BiometricKind.none;
      String name = 'none';
      if (biometrics.contains(BiometricType.face) &&
          biometrics.contains(BiometricType.fingerprint)) {
        kind = BiometricKind.multiple;
        name = 'Face ID / Fingerprint';
      } else if (biometrics.contains(BiometricType.face)) {
        kind = BiometricKind.faceId;
        name = 'Face ID';
      } else if (biometrics.contains(BiometricType.fingerprint)) {
        kind = BiometricKind.fingerprint;
        name = 'Fingerprint';
      }

      return BiometricCapability(
        isSupported: supported,
        hasEnrolledBiometrics: hasEnrolled,
        canAuthenticate: canAuth,
        availableBiometrics: biometrics,
        biometricKind: kind,
        biometricName: name,
      );
    } catch (e) {
      debugPrint('BiometricService: Error checking capability: $e');
      return BiometricCapability.none;
    }
  }

  /// Prompts user with native biometric dialog. Returns true on success,
  /// false on user cancellation, rejection, or unsupported hardware.
  Future<bool> authenticate({
    required String reason,
    bool biometricOnly = true,
    bool stickyAuth = true,
  }) async {
    if (isTestMode) {
      if (mockAuthException != null) {
        throw mockAuthException!;
      }
      return mockBiometricResult ?? true;
    }

    if (Platform.environment.containsKey('FLUTTER_TEST')) {
      return false;
    }

    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          biometricOnly: biometricOnly,
          stickyAuth: stickyAuth,
          useErrorDialogs: false,
        ),
      );
    } catch (e) {
      debugPrint('BiometricService: Biometric authentication failed: $e');
      return false;
    }
  }

  /// Seamless fallback to 4-digit PBKDF2/HMAC PIN verification.
  Future<bool> verifyPinFallback(String pin) async {
    if (isTestMode && mockPinResult != null) {
      return mockPinResult!;
    }
    return LocalStore.instance.verifyPin(pin);
  }
}

/// Riverpod provider for injecting [BiometricService].
final biometricServiceProvider = Provider<BiometricService>((ref) {
  return BiometricService.instance;
});
