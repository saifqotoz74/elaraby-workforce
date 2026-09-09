import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../network/api_client.dart';
import '../storage/local_store.dart';
import 'app_routes.dart';
import 'unknown_route_screen.dart';

// Auth Screens
import '../../features/auth/presentation/screens/confirm_pin_screen.dart';
import '../../features/auth/presentation/screens/get_started_screen.dart';
import '../../features/auth/presentation/screens/national_id_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/pin_lock_screen.dart';
import '../../features/auth/presentation/screens/pin_screen.dart';
import '../../features/auth/presentation/screens/profile_confirmation_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';

// Main Shell & Tabs
import '../../features/main_navigation/presentation/screens/main_nav_screen.dart';
import '../../features/inbox/presentation/screens/inbox_screen.dart';

// Services Screens
import '../../features/services/presentation/screens/employee_data_screen.dart';
import '../../features/services/presentation/screens/hr_request_screen.dart';
import '../../features/services/presentation/screens/raise_concern_screen.dart';
import '../../features/services/presentation/screens/request_leave_screen.dart';
import '../../features/services/presentation/screens/salary_slip_screen.dart';
import '../../features/services/presentation/screens/shift_schedule_screen.dart';
import '../../features/services/presentation/screens/vacation_balance_screen.dart';
import '../../features/services/presentation/screens/your_requests_screen.dart';

// Home Screens
import '../../features/home/data/home_content.dart';
import '../../features/home/presentation/screens/announcement_detail_screen.dart';
import '../../features/home/presentation/screens/company_news_screen.dart';

// Benefits Screens
import '../../features/benefits/presentation/screens/benefit_detail_screen.dart';
import '../../features/benefits/presentation/screens/benefits_screen.dart';
import '../../features/benefits/presentation/screens/trip_detail_screen.dart';

// Profile Screens
import '../../features/profile/presentation/screens/change_pin_screen.dart';
import '../../features/profile/presentation/screens/help_support_screen.dart';
import '../../features/profile/presentation/screens/settings_screen.dart';

/// Global navigation key for root GoRouter navigation.
final GlobalKey<NavigatorState> rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'root');

/// State tracking whether the user is actively locked out or unlocked after onboarding.
class AppAuthState extends ChangeNotifier {
  static final AppAuthState instance = AppAuthState._();
  AppAuthState._();

  bool _isUnlocked = false;

  bool get isUnlocked => _isUnlocked;

  void markUnlocked() {
    if (!_isUnlocked) {
      _isUnlocked = true;
      notifyListeners();
    }
  }

  void markLocked() {
    if (_isUnlocked) {
      _isUnlocked = false;
      notifyListeners();
    }
  }
}

/// Creates a fully configured [GoRouter] instance with centralized routes,
/// auth guards, protected routes, and unknown route handling.
GoRouter createAppRouter({
  String? initialLocation,
  Listenable? refreshListenable,
  GlobalKey<NavigatorState>? navigatorKey,
}) {
  final router = GoRouter(
    navigatorKey: navigatorKey ?? rootNavigatorKey,
    initialLocation: initialLocation ?? AppRoutes.splash,
    refreshListenable: refreshListenable ??
        Listenable.merge([
          AppAuthState.instance,
          LocalStore.instance,
        ]),
    redirect: (BuildContext context, GoRouterState state) {
      final loc = state.uri.path;
      final bool isOnboarded = LocalStore.instance.isOnboarded;
      final bool hasPin = LocalStore.instance.hasSavedPin;
      final bool isFullyOnboarded = isOnboarded && hasPin;
      final bool isUnlocked = AppAuthState.instance.isUnlocked;

      // Allow splash to perform its initialization check freely
      if (loc == AppRoutes.splash) {
        return null;
      }

      // 1. Un-onboarded user trying to access protected routes
      if (!isFullyOnboarded) {
        if (AppRoutes.isProtectedRoute(loc)) {
          return AppRoutes.getStarted;
        }
        return null;
      }

      // 2. Fully onboarded user trying to access onboarding screens
      if (loc == AppRoutes.getStarted ||
          loc == AppRoutes.nationalId ||
          loc == AppRoutes.otp ||
          loc == AppRoutes.profileConfirmation ||
          loc == AppRoutes.createPin ||
          loc == AppRoutes.confirmPin) {
        return isUnlocked ? AppRoutes.main : AppRoutes.lock;
      }

      // 3. User is locked: restrict access to protected resources
      if (!isUnlocked && AppRoutes.isProtectedRoute(loc)) {
        return AppRoutes.lock;
      }

      // 4. User is unlocked and sitting on the lock screen
      if (isUnlocked && loc == AppRoutes.lock) {
        return AppRoutes.main;
      }

      return null;
    },
    errorBuilder: (context, state) =>
        UnknownRouteScreen(path: state.uri.toString()),
    routes: [
      // ---- Authentication Routes ----
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.getStarted,
        builder: (context, state) => const GetStartedScreen(),
      ),
      GoRoute(
        path: AppRoutes.nationalId,
        builder: (context, state) => const NationalIdScreen(),
      ),
      GoRoute(
        path: AppRoutes.otp,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return OtpScreen(
            nationalId: extra?['nationalId'] as String?,
            devCode: extra?['devCode'] as String?,
            maskedPhone: extra?['maskedPhone'] as String?,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.profileConfirmation,
        builder: (context, state) => const ProfileConfirmationScreen(),
      ),
      GoRoute(
        path: AppRoutes.createPin,
        builder: (context, state) => const PinScreen(),
      ),
      GoRoute(
        path: AppRoutes.confirmPin,
        builder: (context, state) {
          final pin = state.extra as String? ?? '';
          return ConfirmPinScreen(createdPin: pin);
        },
      ),
      GoRoute(
        path: AppRoutes.lock,
        builder: (context, state) => const PinLockScreen(),
      ),

      // ---- Main Application Shell & Inbox ----
      GoRoute(
        path: AppRoutes.main,
        builder: (context, state) => const MainNavScreen(),
      ),
      GoRoute(
        path: AppRoutes.inbox,
        builder: (context, state) => const InboxScreen(),
      ),
      GoRoute(
        path: AppRoutes.benefits,
        builder: (context, state) {
          final tab = (state.extra as num?)?.toInt() ?? 0;
          return BenefitsScreen(initialTab: tab);
        },
      ),

      // ---- Services Feature Routes ----
      GoRoute(
        path: AppRoutes.vacationBalance,
        builder: (context, state) => const VacationBalanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.requestLeave,
        builder: (context, state) => const RequestLeaveScreen(),
      ),
      GoRoute(
        path: AppRoutes.shiftSchedule,
        builder: (context, state) => const ShiftScheduleScreen(),
      ),
      GoRoute(
        path: AppRoutes.salarySlip,
        builder: (context, state) => const SalarySlipScreen(),
      ),
      GoRoute(
        path: AppRoutes.hrRequest,
        builder: (context, state) => const HrRequestScreen(),
      ),
      GoRoute(
        path: AppRoutes.raiseConcern,
        builder: (context, state) => const RaiseConcernScreen(),
      ),
      GoRoute(
        path: AppRoutes.employeeData,
        builder: (context, state) => const EmployeeDataScreen(),
      ),
      GoRoute(
        path: AppRoutes.yourRequests,
        builder: (context, state) => const YourRequestsScreen(),
      ),

      // ---- Home Feature Routes ----
      GoRoute(
        path: AppRoutes.announcementDetail,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return AnnouncementDetailScreen(
            title: extra?['title'] as String?,
            body: extra?['body'] as String?,
            imageUrl: extra?['imageUrl'] as String?,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.companyNews,
        builder: (context, state) {
          final extra = state.extra;
          if (extra is List<ServerNews>) {
            return CompanyNewsScreen(serverNews: extra);
          }
          return const CompanyNewsScreen();
        },
      ),

      // ---- Benefits Feature Routes ----
      GoRoute(
        path: AppRoutes.benefitDetail,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return BenefitDetailScreen(
            title: extra?['title'] as String? ?? 'Saudi Supermarket',
            discount: extra?['discount'] as String? ?? '20% OFF',
            category: extra?['category'] as String? ?? 'Exclusive Perk',
            imagePath: extra?['imagePath'] as String? ??
                'assets/images/benefit_supermarket.png',
            imageUrl: extra?['imageUrl'] as String?,
            validity:
                extra?['validity'] as String? ?? 'Valid through 31 Dec 2026',
            description: extra?['description'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: AppRoutes.tripDetail,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return TripDetailScreen(
            title: extra?['title'] as String? ?? 'Ain Sokhna Retreat',
            destination:
                extra?['destination'] as String? ?? 'Ain Sokhna • Red Sea',
            price: extra?['price'] as String? ?? 'EGP 500',
            originalPrice: extra?['originalPrice'] as String? ?? 'EGP 1,200',
            date: extra?['date'] as String? ?? 'Friday, 24 Oct 2026',
            imagePath: extra?['imagePath'] as String? ??
                'assets/images/benefit_sokhna.png',
            imageUrl: extra?['imageUrl'] as String?,
            tripId: extra?['tripId'] as String?,
            totalSeats: (extra?['totalSeats'] as num?)?.toInt() ?? 30,
            bookedSeats: (extra?['bookedSeats'] as num?)?.toInt() ?? 23,
            inclusions: extra?['inclusions'] as List<String>?,
            itinerary: extra?['itinerary'] as List<TripItineraryStep>?,
          );
        },
      ),

      // ---- Profile Feature Routes ----
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.changePin,
        builder: (context, state) => const ChangePinScreen(),
      ),
      GoRoute(
        path: AppRoutes.helpSupport,
        builder: (context, state) => const HelpSupportScreen(),
      ),
    ],
  );

  // Automatically route to lock screen on session expiration (HTTP 401)
  ApiClient.onSessionExpired = () {
    AppAuthState.instance.markLocked();
    router.go(AppRoutes.lock);
  };

  return router;
}

/// Shared Riverpod provider exposing the application's [GoRouter].
final appRouterProvider = Provider<GoRouter>((ref) {
  return createAppRouter();
});
