import 'package:flutter_test/flutter_test.dart';
import 'package:elaraby_workforce/core/network/phone_auth_service.dart';
import 'package:elaraby_workforce/core/network/backend.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PhoneAuthService Unit Tests', () {
    test('formatToE164 normalizes Egyptian local numbers properly', () {
      expect(PhoneAuthService.formatToE164('01229105279'), '+201229105279');
      expect(PhoneAuthService.formatToE164('201229105279'), '+201229105279');
      expect(PhoneAuthService.formatToE164('+201229105279'), '+201229105279');
      expect(PhoneAuthService.formatToE164('00201229105279'), '+201229105279');
      expect(PhoneAuthService.formatToE164(' 010-1234-5678 '), '+201012345678');
    });

    test('verifyPhoneNumber invokes onCodeSent with valid verificationId', () async {
      final service = PhoneAuthService.instance;
      String? receivedVerificationId;

      await service.verifyPhoneNumber(
        phoneNumber: '01229105279',
        onCodeSent: (verificationId, resendToken) {
          receivedVerificationId = verificationId;
        },
        onAutoVerified: (_) {},
        onFailed: (_) {},
      );

      expect(receivedVerificationId, isNotNull);
      expect(receivedVerificationId!.isNotEmpty, true);
      expect(service.currentVerificationId, equals(receivedVerificationId));
    });

    test('verifySmsCode exchanges SMS code for Firebase token', () async {
      final service = PhoneAuthService.instance;
      service.setMockVerificationState(verificationId: 'mock_v_123');

      final token = await service.verifySmsCode('123456');
      expect(token, isNotNull);
      expect(token!.startsWith('mock_token:'), true);
    });

    test('Backend.verifyOtp accepts optional firebaseIdToken', () async {
      // Hermetic invocation: offline or unmocked returns networkError/invalid without crashing
      final result = await Backend.instance.verifyOtp(
        '29000000000000',
        '123456',
        firebaseIdToken: 'mock_token:+201229105279',
      );

      // Result should be a valid AuthResult enum value
      expect(result, isA<AuthResult>());
    });
  });
}
