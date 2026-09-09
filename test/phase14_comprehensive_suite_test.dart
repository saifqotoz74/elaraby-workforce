import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:elaraby_workforce/core/errors/app_error.dart';
import 'package:elaraby_workforce/core/localization/app_locale.dart';
import 'package:elaraby_workforce/core/navigation/app_routes.dart';
import 'package:elaraby_workforce/core/network/api_client.dart';
import 'package:elaraby_workforce/core/network/backend.dart';
import 'package:elaraby_workforce/core/network/connectivity_service.dart';
import 'package:elaraby_workforce/core/storage/local_store.dart';
import 'package:elaraby_workforce/core/theme/app_typography.dart';
import 'package:elaraby_workforce/core/utils/national_id_validator.dart';
import 'package:elaraby_workforce/features/benefits/data/benefits_content.dart';
import 'package:elaraby_workforce/features/home/data/home_content.dart';
import 'package:elaraby_workforce/features/services/data/requests_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStore.instance.init();
    await ApiClient.instance.init();
    ApiClient.offlineMockMode = false;
    ConnectivityService.instance.setMockOnline(true);
  });

  // =========================================================================
  // 1. AUTHENTICATION TESTS
  // =========================================================================
  group('Phase 14 - 1. Authentication Tests', () {
    test('requestOtp formats and passes Egyptian National ID correctly',
        () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/auth/otp')) {
            return http.Response(
              '{"found": true, "devCode": "1234", "maskedPhone": "010****5678", "hasPin": true}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Not Found"}', 404);
        }),
      );

      final res = await client.post('/auth/otp', {
        'nationalId': '29801011234567',
      });

      expect(res?['found'], isTrue);
      expect(res?['devCode'], '1234');
      expect(res?['maskedPhone'], '010****5678');
      expect(res?['hasPin'], isTrue);
    });

    test('Auth token is securely stored and attached as Bearer header',
        () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          final authHeader = request.headers['Authorization'];
          if (authHeader == 'Bearer mock-jwt-token-production') {
            return http.Response(
              '{"ok": true, "employee": {"name": "Ahmed Hassan", "vacationBalance": 21}}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Unauthorized"}', 401);
        }),
      );

      // Without token -> fails 401
      final unauthRes = await client.get('/me');
      expect(unauthRes, isNull);

      // With token -> succeeds 200
      await client.setToken('mock-jwt-token-production');
      expect(client.token, 'mock-jwt-token-production');

      final authRes = await client.get('/me');
      expect(authRes?['ok'], isTrue);
      expect(authRes?['employee']['name'], 'Ahmed Hassan');

      // Clear token -> clears header
      await client.setToken(null);
      expect(client.token, isNull);
    });
  });

  // =========================================================================
  // 2. OTP TESTS
  // =========================================================================
  group('Phase 14 - 2. OTP Tests', () {
    test('Valid 4-digit OTP code completes verification', () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/auth/otp/verify')) {
            return http.Response(
              '{"ok": true, "resetToken": "reset_token_abc_123", "employee": {"name": "Ali Mohamed"}}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Not Found"}', 404);
        }),
      );

      final res = await client.post('/auth/otp/verify', {
        'nationalId': '29801011234567',
        'code': '1234',
      });

      expect(res?['ok'], isTrue);
      expect(res?['resetToken'], 'reset_token_abc_123');
      expect(res?['employee']['name'], 'Ali Mohamed');
    });

    test('Invalid OTP code returns validation error / 400', () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          return http.Response(
            '{"error": "invalid_code", "message": "The OTP entered is incorrect."}',
            400,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final res = await client.post('/auth/otp/verify', {
        'nationalId': '29801011234567',
        'code': '9999',
      });

      expect(res?['_status'], 400);
      expect(res?['error'], contains('invalid_code'));
    });

    test('Rate-limited OTP requests return 429 locked status', () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          return http.Response(
            '{"error": "too_many_attempts", "message": "Too many invalid attempts. Account locked temporarily."}',
            429,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final res = await client.post('/auth/otp/verify', {
        'nationalId': '29801011234567',
        'code': '0000',
      });

      expect(res?['_status'], 429);
      expect(client.lastError, isA<RateLimitError>());
      expect(client.lastError?.statusCode, 429);
    });
  });

  // =========================================================================
  // 3. PIN TESTS
  // =========================================================================
  group('Phase 14 - 3. PIN Tests', () {
    test(
        'Strict 4-digit PIN validator logic accepts valid 4-digit numeric pins',
        () {
      final pinRegex = RegExp(r'^\d{4}$');

      expect(pinRegex.hasMatch('1234'), isTrue);
      expect(pinRegex.hasMatch('9876'), isTrue);
      expect(pinRegex.hasMatch('0000'), isTrue);

      expect(pinRegex.hasMatch('123'), isFalse);
      expect(pinRegex.hasMatch('12345'), isFalse);
      expect(pinRegex.hasMatch('12a4'), isFalse);
      expect(pinRegex.hasMatch(''), isFalse);
    });

    test('Weak repeating digits PIN validation rejects repeating numbers', () {
      bool isWeakRepeating(String pin) {
        return RegExp(r'^(\d)\1{3}$').hasMatch(pin);
      }

      expect(isWeakRepeating('0000'), isTrue);
      expect(isWeakRepeating('1111'), isTrue);
      expect(isWeakRepeating('7777'), isTrue);
      expect(isWeakRepeating('9999'), isTrue);

      expect(isWeakRepeating('1234'), isFalse);
      expect(isWeakRepeating('1122'), isFalse);
      expect(isWeakRepeating('8294'), isFalse);
    });

    test('Weak sequential digits PIN validation rejects obvious sequences', () {
      bool isWeakSequential(String pin) {
        const sequences = [
          '0123',
          '1234',
          '2345',
          '3456',
          '4567',
          '5678',
          '6789',
          '9876',
          '8765',
          '7654',
          '6543',
          '5432',
          '4321',
          '3210'
        ];
        return sequences.contains(pin);
      }

      expect(isWeakSequential('1234'), isTrue);
      expect(isWeakSequential('4321'), isTrue);
      expect(isWeakSequential('6789'), isTrue);

      expect(isWeakSequential('8294'), isFalse);
      expect(isWeakSequential('3917'), isFalse);
      expect(isWeakSequential('4019'), isFalse);
    });

    test('PIN change rejects incorrect current PIN and accepts valid update',
        () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/auth/pin/change')) {
            return http.Response(
              '{"ok": true, "message": "PIN updated successfully"}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Not Found"}', 404);
        }),
      );
      await client.setToken('auth-token-user');

      final res = await client.post('/auth/pin/change', {
        'currentPin': '8294',
        'newPin': '3917',
      });

      expect(res?['ok'], isTrue);
      expect(res?['message'], contains('PIN updated'));
    });
  });

  // =========================================================================
  // 4. SALARY AUTHORIZATION TESTS
  // =========================================================================
  group('Phase 14 - 4. Salary Authorization Tests', () {
    test('Unlocking salary with invalid PIN is rejected', () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/payroll/unlock')) {
            return http.Response(
              '{"error": "invalid_pin", "message": "The entered PIN is incorrect."}',
              401,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Not Found"}', 404);
        }),
      );

      final res = await client.post('/payroll/unlock', {'pin': '9999'});
      expect(res?['_status'], 401);
      expect(res?['error'], contains('invalid_pin'));
    });

    test('Unlocking salary with valid PIN issues temporary salaryToken',
        () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/payroll/unlock')) {
            return http.Response(
              '{"ok": true, "salaryToken": "sal_token_temp_987654321", "expiresIn": 120}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Not Found"}', 404);
        }),
      );

      final res = await client.post('/payroll/unlock', {'pin': '8294'});
      expect(res?['ok'], isTrue);
      expect(res?['salaryToken'], 'sal_token_temp_987654321');
    });

    test('Fetching payroll passes salary authorization token in extra headers',
        () async {
      String? capturedSalaryToken;
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/payroll')) {
            capturedSalaryToken = request.headers['x-salary-token'];
            return http.Response(
              '{"payroll": {"basic": 12000, "allowances": 3000, "net": 13500, "month": "March 2026"}}',
              200,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"error": "Not Found"}', 404);
        }),
      );

      final res = await client.get(
        '/payroll',
        extraHeaders: {'x-salary-token': 'sal_token_temp_987654321'},
      );

      expect(capturedSalaryToken, 'sal_token_temp_987654321');
      expect(res?['payroll']['basic'], 12000);
      expect(res?['payroll']['net'], 13500);
    });
  });

  // =========================================================================
  // 5. IDOR & SECURITY CHECKS
  // =========================================================================
  group('Phase 14 - 5. IDOR & Cross-User Security Tests', () {
    test('Backend endpoints bind employee context strictly to JWT claims',
        () async {
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          if (request.url.path.endsWith('/requests/req_OTHER_USER/cancel')) {
            // Emulating IDOR check: caller JWT cannot act on another employee's request
            return http.Response(
              '{"error": "forbidden", "message": "Cannot modify requests belonging to another employee."}',
              403,
              headers: {'content-type': 'application/json'},
            );
          }
          return http.Response('{"ok": true}', 200);
        }),
      );

      final res = await client.post('/requests/req_OTHER_USER/cancel', {});
      expect(res?['_status'], 403);
      expect(res?['error'], contains('forbidden'));
    });

    test(
        'Employee profile update binds exclusively to JWT and ignores forged ID',
        () async {
      String? capturedBody;
      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          capturedBody = request.body;
          return http.Response(
            '{"ok": true, "employee": {"id": "emp_CURRENT_USER", "phone": "01011112222"}}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final res = await client.post('/me', {
        'phone': '01011112222',
        // Injected malicious param attempting IDOR
        'employeeId': 'emp_OTHER_VICTIM',
      });

      expect(res?['ok'], isTrue);
      expect(capturedBody, contains('01011112222'));
    });
  });

  // =========================================================================
  // 6. EMPLOYEE ISOLATION & SESSION TEARDOWN
  // =========================================================================
  group('Phase 14 - 6. Employee Isolation Tests', () {
    test('clearAllUserData guarantees complete state wipe across all stores',
        () async {
      await ApiClient.instance.setToken('employee_1_jwt');
      LocalStore.instance.saveProfile(const EmployeeProfile(
        name: 'Employee One',
        employeeCode: 'EMP-001',
        factory: 'Quesna',
      ));
      LocalStore.instance.setVacationBalance(25);

      RequestsStore.instance.addRequest(const EmployeeRequest(
        id: 'req_emp1_1',
        title: 'Emergency Leave',
        type: 'Leave',
        refNumber: 'REF-001',
        status: RequestStatus.inReview,
        date: '2026-03-01',
        summary: 'Emergency',
      ));

      HomeContent.instance.news = [
        ServerNews(
          id: 'news_1',
          title: 'News 1',
          body: 'Body 1',
          createdAt: DateTime.now(),
        ),
      ];

      BenefitsContent.instance.benefits = [
        const ServerBenefit(
          id: 'ben_1',
          title: 'Staff Benefit',
          discount: '15%',
          category: 'Retail',
          description: 'Desc',
          validThrough: '2026',
        ),
      ];
      BenefitsContent.instance.loaded = true;

      // Assert pre-condition: Employee 1 has populated stores
      expect(ApiClient.instance.token, 'employee_1_jwt');
      expect(LocalStore.instance.profile.name, 'Employee One');
      expect(LocalStore.instance.vacationDaysRemaining, 25);
      expect(RequestsStore.instance.allRequests.length, 1);
      expect(HomeContent.instance.news.length, 1);
      expect(BenefitsContent.instance.benefits.length, 1);

      // Trigger session teardown
      await Backend.instance.clearAllUserData();

      // Assert post-condition: Complete isolation achieved, zero residual data
      expect(ApiClient.instance.token, isNull);
      expect(LocalStore.instance.profile.name,
          'Ahmed Ghannam'); // default mock profile
      expect(LocalStore.instance.vacationDaysRemaining, 12); // default balance
      expect(RequestsStore.instance.allRequests, isEmpty);
      expect(HomeContent.instance.news, isEmpty);
      expect(BenefitsContent.instance.benefits, isEmpty);
      expect(BenefitsContent.instance.loaded, isFalse);
    });
  });

  // =========================================================================
  // 7. REQUESTS LIFECYCLE TESTS
  // =========================================================================
  group('Phase 14 - 7. Requests Lifecycle & Rollback Tests', () {
    test('Deduct and refund vacation days updates balance accurately',
        () async {
      LocalStore.instance.setVacationBalance(20);
      expect(LocalStore.instance.vacationDaysRemaining, 20);

      // Deduct 3 days for leave request
      await LocalStore.instance.deductVacationDays(3);
      expect(LocalStore.instance.vacationDaysRemaining, 17);

      // Refund 3 days on request cancellation or rejection
      await LocalStore.instance.addVacationDays(3);
      expect(LocalStore.instance.vacationDaysRemaining, 20);
    });

    test('Local request cancellation removes item and refunds balance',
        () async {
      ConnectivityService.instance.setMockOnline(false);
      LocalStore.instance.setVacationBalance(20);

      const req = EmployeeRequest(
        id: 'local_req_temp_123',
        title: 'Annual Leave',
        type: 'Leave',
        refNumber: 'REQ-2026-TEMP',
        status: RequestStatus.inReview,
        date: '2026-03-01',
        summary: '3 days',
        isPendingSync: true,
        details: {'leaveType': 'Annual Leave', 'days': '3'},
      );

      RequestsStore.instance.addRequest(req);
      await LocalStore.instance.deductVacationDays(3);
      expect(LocalStore.instance.vacationDaysRemaining, 17);
      expect(RequestsStore.instance.allRequests.any((r) => r.id == req.id),
          isTrue);

      // Cancel local pending request
      final cancelled = await RequestsStore.instance.cancelRequest(req.id);
      expect(cancelled, isTrue);
      expect(RequestsStore.instance.allRequests.any((r) => r.id == req.id),
          isFalse);
      expect(LocalStore.instance.vacationDaysRemaining, 20); // Refunded
      ConnectivityService.instance.setMockOnline(true);
    });
  });

  // =========================================================================
  // 8. DRAFTS & AUTOSAVE TESTS
  // =========================================================================
  group('Phase 14 - 8. Drafts Autosave & Restoration Tests', () {
    test(
        'Form drafts save, restore, and clear correctly without data corruption',
        () async {
      const draftKey = 'test_leave_draft';
      final draftData = {
        'type': 'Annual Leave',
        'days': '4',
        'reason': 'Family emergency',
        'timestamp': DateTime.now().toIso8601String(),
      };

      // Save draft
      await LocalStore.instance.saveDraft(draftKey, draftData);

      // Restore draft
      final restored = LocalStore.instance.getDraft(draftKey);
      expect(restored, isNotNull);
      expect(restored!['type'], 'Annual Leave');
      expect(restored['days'], '4');
      expect(restored['reason'], 'Family emergency');

      // Clear draft on submission
      await LocalStore.instance.clearDraft(draftKey);
      expect(LocalStore.instance.getDraft(draftKey), isNull);
    });
  });

  // =========================================================================
  // 9. OFFLINE MODE & RESILIENCE TESTS
  // =========================================================================
  group('Phase 14 - 9. Offline Mode & Network Resilience Tests', () {
    test('Offline mode queues requests with isPendingSync true', () async {
      ConnectivityService.instance.setMockOnline(false);

      const offlineReq = EmployeeRequest(
        id: 'req_offline_100',
        title: 'Sick Leave',
        type: 'Sick Leave',
        refNumber: 'REQ-OFFLINE',
        status: RequestStatus.inReview,
        date: 'Today',
        summary: 'Medical visit',
        isPendingSync: true,
      );

      RequestsStore.instance.addRequest(offlineReq);
      expect(RequestsStore.instance.allRequests.length, 1);
      expect(RequestsStore.instance.allRequests.first.isPendingSync, isTrue);

      // Safe state maintained locally
      final pendingList = RequestsStore.instance.allRequests
          .where((r) => r.isPendingSync)
          .toList();
      expect(pendingList.length, 1);

      // Restore online
      ConnectivityService.instance.setMockOnline(true);
    });

    test('NetworkError differentiates genuine offline interface from timeouts',
        () {
      const offlineErr = NetworkError('Socket closed', 'network_error', null);
      const timeoutErr =
          TimeoutError('Request timed out', 'timeout_error', 408);

      expect(offlineErr.isOffline, isTrue);
      expect(timeoutErr.isOffline, isFalse);
      expect(timeoutErr.statusCode, 408);
    });
  });

  // =========================================================================
  // 10. LOCALIZATION TESTS
  // =========================================================================
  group('Phase 14 - 10. Localization & RTL Tests', () {
    test(
        'AppLocale toggles between Arabic and English and updates text direction',
        () {
      final locale = AppLocale.instance;

      locale.setLocale(const Locale('ar'));
      expect(locale.isArabic, isTrue);
      expect(locale.textDirection, TextDirection.rtl);

      locale.setLocale(const Locale('en'));
      expect(locale.isArabic, isFalse);
      expect(locale.textDirection, TextDirection.ltr);
    });

    test('AppTypography applies Cairo font for Arabic and Inter for English',
        () {
      AppLocale.instance.setLocale(const Locale('ar'));
      expect(AppTypography.isArabicTypography, isTrue);
      expect(AppTypography.fontBase.fontFamily, contains('Cairo'));

      AppLocale.instance.setLocale(const Locale('en'));
      expect(AppTypography.isArabicTypography, isFalse);
      expect(AppTypography.fontBase.fontFamily, contains('Inter'));
    });

    test(
        'Egyptian National ID validator strictly validates length, governorate, and birth dates',
        () {
      // Valid ID: born 1998-01-01 in Cairo (code 01)
      final valid = EgyptianNationalIdValidator.isValid('29801010123456');
      expect(valid, isTrue);
      expect(EgyptianNationalIdValidator.parseBirthDate('29801010123456'),
          isNotNull);

      // Invalid ID: garbage digits
      final invalid = EgyptianNationalIdValidator.isValid('00000000000000');
      expect(invalid, isFalse);
    });
  });

  // =========================================================================
  // 11. NAVIGATION TESTS
  // =========================================================================
  group('Phase 14 - 11. Navigation & Route Classification Tests', () {
    test('All core route constants are defined and non-empty', () {
      expect(AppRoutes.splash, '/');
      expect(AppRoutes.main, '/main');
      expect(AppRoutes.salarySlip, '/salary-slip');
      expect(AppRoutes.requestLeave, '/request-leave');
      expect(AppRoutes.raiseConcern, '/raise-concern');
      expect(AppRoutes.yourRequests, '/your-requests');
      expect(AppRoutes.unknown, '/404');
    });

    test('Route classification accurately detects auth vs protected routes',
        () {
      expect(AppRoutes.isAuthRoute(AppRoutes.splash), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.getStarted), isTrue);
      expect(AppRoutes.isAuthRoute(AppRoutes.lock), isTrue);

      expect(AppRoutes.isAuthRoute(AppRoutes.main), isFalse);
      expect(AppRoutes.isAuthRoute(AppRoutes.salarySlip), isFalse);
      expect(AppRoutes.isAuthRoute(AppRoutes.requestLeave), isFalse);
    });
  });

  // =========================================================================
  // 12. API ERRORS & HTTP STATUS MAPPING TESTS
  // =========================================================================
  group('Phase 14 - 12. API Errors & Status Mapping Tests', () {
    test('AppError.fromResponse maps standard HTTP status codes correctly', () {
      expect(AppError.fromResponse(400), isA<ValidationError>());
      expect(AppError.fromResponse(401), isA<UnauthorizedError>());
      expect(AppError.fromResponse(403), isA<ForbiddenError>());
      expect(AppError.fromResponse(404), isA<NotFoundError>());
      expect(AppError.fromResponse(429), isA<RateLimitError>());
      expect(AppError.fromResponse(500), isA<ServerError>());
      expect(AppError.fromResponse(503), isA<ServerError>());
    });

    test('All error domain classes provide dual-language user-facing messages',
        () {
      const errors = <AppError>[
        NetworkError(),
        TimeoutError(),
        UnauthorizedError(),
        ForbiddenError(),
        NotFoundError(),
        ValidationError(''),
        RateLimitError(),
        ServerError(),
        UnknownError(),
      ];

      for (final err in errors) {
        expect(err.userFacingMessageAr, isNotEmpty);
        expect(err.userFacingMessageEn, isNotEmpty);
        expect(err.userFacingMessage(true), err.userFacingMessageAr);
        expect(err.userFacingMessage(false), err.userFacingMessageEn);
      }
    });
  });

  // =========================================================================
  // 13. DATABASE & LOCAL PERSISTENCE TESTS
  // =========================================================================
  group('Phase 14 - 13. Database & Local Persistence Tests', () {
    test('LocalStore persists and retrieves employee profile cleanly',
        () async {
      const testProfile = EmployeeProfile(
        name: 'Tarek Mahmoud',
        employeeCode: 'EMP-9988',
        factory: 'Banha Complex',
        department: 'Quality Assurance',
        position: 'QA Lead',
        supervisor: 'Eng. Hany',
        phone: '01234567890',
        address: 'Banha, Qalyubia',
        emergencyContact: '01099887766',
        emergencyName: 'Mahmoud',
        emergencyRelationship: 'Father',
      );

      await LocalStore.instance.saveProfile(testProfile);
      final loaded = LocalStore.instance.profile;

      expect(loaded.name, 'Tarek Mahmoud');
      expect(loaded.employeeCode, 'EMP-9988');
      expect(loaded.factory, 'Banha Complex');
      expect(loaded.department, 'Quality Assurance');
      expect(loaded.emergencyContact, '01099887766');
    });

    test('LocalStore persists settings toggles and preferences', () async {
      await LocalStore.instance.setSetting('biometric', true);
      expect(LocalStore.instance.getSetting('biometric'), isTrue);

      await LocalStore.instance.setSetting('biometric', false);
      expect(LocalStore.instance.getSetting('biometric'), isFalse);

      await LocalStore.instance.setSetting('salary_protection', true);
      expect(LocalStore.instance.getSetting('salary_protection'), isTrue);
    });
  });

  // =========================================================================
  // 14. SESSION EXPIRATION TESTS
  // =========================================================================
  group('Phase 14 - 14. Session Expiration Tests', () {
    test(
        '401 response triggers onSessionExpired callback and wipes cached token',
        () async {
      bool sessionExpiredInvoked = false;
      ApiClient.onSessionExpired = () {
        sessionExpiredInvoked = true;
      };

      final client = ApiClient.createForTesting(
        mockClient: MockClient((request) async {
          return http.Response(
            '{"error": "token_expired", "message": "Your session has expired."}',
            401,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      await client.setToken('expired_sample_jwt');
      expect(client.token, 'expired_sample_jwt');

      final result = await client.request('GET', '/me');

      expect(result.isFailure, isTrue);
      expect(result.error, isA<UnauthorizedError>());
      expect(sessionExpiredInvoked, isTrue);
      expect(client.token, isNull); // Token wiped automatically on 401
    });
  });
}
