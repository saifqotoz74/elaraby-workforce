import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'app_routes.dart';

// Screen fallbacks for test environments where GoRouter is not injected
import '../../features/auth/presentation/screens/confirm_pin_screen.dart';
import '../../features/auth/presentation/screens/get_started_screen.dart';
import '../../features/auth/presentation/screens/national_id_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/pin_lock_screen.dart';
import '../../features/auth/presentation/screens/pin_screen.dart';
import '../../features/auth/presentation/screens/profile_confirmation_screen.dart';
import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/benefits/presentation/screens/benefit_detail_screen.dart';
import '../../features/benefits/presentation/screens/benefits_screen.dart';
import '../../features/benefits/presentation/screens/trip_detail_screen.dart';
import '../../features/home/data/home_content.dart';
import '../../features/home/presentation/screens/announcement_detail_screen.dart';
import '../../features/home/presentation/screens/company_news_screen.dart';
import '../../features/inbox/presentation/screens/inbox_screen.dart';
import '../../features/main_navigation/presentation/screens/main_nav_screen.dart';
import '../../features/profile/presentation/screens/change_pin_screen.dart';
import '../../features/profile/presentation/screens/help_support_screen.dart';
import '../../features/profile/presentation/screens/settings_screen.dart';
import '../../features/services/presentation/screens/employee_data_screen.dart';
import '../../features/services/presentation/screens/hr_request_screen.dart';
import '../../features/services/presentation/screens/raise_concern_screen.dart';
import '../../features/services/presentation/screens/request_leave_screen.dart';
import '../../features/services/presentation/screens/salary_slip_screen.dart';
import '../../features/services/presentation/screens/shift_schedule_screen.dart';
import '../../features/services/presentation/screens/vacation_balance_screen.dart';
import '../../features/services/presentation/screens/your_requests_screen.dart';

/// Centralized navigation service eliminating scattered navigation logic across the app.
class AppNavigation {
  AppNavigation._();

  static Future<T?> _push<T>(
    BuildContext context,
    String path, {
    Object? extra,
    required Widget Function() fallbackBuilder,
  }) async {
    final router = GoRouter.maybeOf(context);
    if (router != null) {
      return router.push<T>(path, extra: extra);
    }
    return Navigator.of(context).push<T>(
      MaterialPageRoute(builder: (_) => fallbackBuilder()),
    );
  }

  static void _go(
    BuildContext context,
    String path, {
    Object? extra,
    required Widget Function() fallbackBuilder,
  }) {
    final router = GoRouter.maybeOf(context);
    if (router != null) {
      router.go(path, extra: extra);
    } else {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => fallbackBuilder()),
        (route) => false,
      );
    }
  }

  // ---- Auth / Onboarding ----
  static void toSplash(BuildContext context) {
    _go(context, AppRoutes.splash, fallbackBuilder: () => const SplashScreen());
  }

  static void toGetStarted(BuildContext context) {
    _go(context, AppRoutes.getStarted,
        fallbackBuilder: () => const GetStartedScreen());
  }

  static Future<void> toNationalId(BuildContext context) async {
    await _push(context, AppRoutes.nationalId,
        fallbackBuilder: () => const NationalIdScreen());
  }

  static Future<void> toOtp(
    BuildContext context, {
    String? nationalId,
    String? devCode,
    String? maskedPhone,
  }) async {
    await _push(
      context,
      AppRoutes.otp,
      extra: {
        'nationalId': nationalId,
        'devCode': devCode,
        'maskedPhone': maskedPhone,
      },
      fallbackBuilder: () => OtpScreen(
        nationalId: nationalId,
        devCode: devCode,
        maskedPhone: maskedPhone,
      ),
    );
  }

  static Future<void> toProfileConfirmation(BuildContext context) async {
    await _push(context, AppRoutes.profileConfirmation,
        fallbackBuilder: () => const ProfileConfirmationScreen());
  }

  static Future<void> toCreatePin(BuildContext context) async {
    await _push(context, AppRoutes.createPin,
        fallbackBuilder: () => const PinScreen());
  }

  static Future<void> toConfirmPin(
    BuildContext context, {
    required String createdPin,
  }) async {
    await _push(
      context,
      AppRoutes.confirmPin,
      extra: createdPin,
      fallbackBuilder: () => ConfirmPinScreen(createdPin: createdPin),
    );
  }

  static void toLock(BuildContext context) {
    _go(context, AppRoutes.lock, fallbackBuilder: () => const PinLockScreen());
  }

  // ---- Main Shell & Inbox ----
  static void toMain(BuildContext context) {
    _go(context, AppRoutes.main, fallbackBuilder: () => const MainNavScreen());
  }

  static Future<void> toInbox(BuildContext context) async {
    await _push(context, AppRoutes.inbox,
        fallbackBuilder: () => const InboxScreen());
  }

  static Future<void> toBenefits(
    BuildContext context, {
    int initialTab = 0,
  }) async {
    await _push(
      context,
      AppRoutes.benefits,
      extra: initialTab,
      fallbackBuilder: () => BenefitsScreen(initialTab: initialTab),
    );
  }

  // ---- Services Feature ----
  static Future<void> toSalarySlip(BuildContext context) async {
    await _push(context, AppRoutes.salarySlip,
        fallbackBuilder: () => const SalarySlipScreen());
  }

  static Future<void> toVacationBalance(BuildContext context) async {
    await _push(context, AppRoutes.vacationBalance,
        fallbackBuilder: () => const VacationBalanceScreen());
  }

  static Future<T?> toRequestLeave<T>(BuildContext context) async {
    return _push<T>(context, AppRoutes.requestLeave,
        fallbackBuilder: () => const RequestLeaveScreen());
  }

  static Future<void> toShiftSchedule(BuildContext context) async {
    await _push(context, AppRoutes.shiftSchedule,
        fallbackBuilder: () => const ShiftScheduleScreen());
  }

  static Future<void> toHrRequest(BuildContext context) async {
    await _push(context, AppRoutes.hrRequest,
        fallbackBuilder: () => const HrRequestScreen());
  }

  static Future<void> toRaiseConcern(BuildContext context) async {
    await _push(context, AppRoutes.raiseConcern,
        fallbackBuilder: () => const RaiseConcernScreen());
  }

  static Future<void> toEmployeeData(BuildContext context) async {
    await _push(context, AppRoutes.employeeData,
        fallbackBuilder: () => const EmployeeDataScreen());
  }

  static Future<void> toYourRequests(BuildContext context) async {
    await _push(context, AppRoutes.yourRequests,
        fallbackBuilder: () => const YourRequestsScreen());
  }

  // ---- Home Feature ----
  static Future<void> toAnnouncementDetail(
    BuildContext context, {
    String? title,
    String? body,
    String? imageUrl,
  }) async {
    await _push(
      context,
      AppRoutes.announcementDetail,
      extra: {
        'title': title,
        'body': body,
        'imageUrl': imageUrl,
      },
      fallbackBuilder: () => AnnouncementDetailScreen(
        title: title,
        body: body,
        imageUrl: imageUrl,
      ),
    );
  }

  static Future<void> toCompanyNews(
    BuildContext context, {
    List<ServerNews> serverNews = const [],
  }) async {
    await _push(
      context,
      AppRoutes.companyNews,
      extra: serverNews,
      fallbackBuilder: () => CompanyNewsScreen(serverNews: serverNews),
    );
  }

  // ---- Benefits Feature ----
  static Future<void> toBenefitDetail(
    BuildContext context, {
    String title = 'Saudi Supermarket',
    String discount = '20% OFF',
    String category = 'Exclusive Perk',
    String imagePath = 'assets/images/benefit_supermarket.png',
    String? imageUrl,
    String validity = 'Valid through 31 Dec 2026',
    String description = '',
  }) async {
    final extra = {
      'title': title,
      'discount': discount,
      'category': category,
      'imagePath': imagePath,
      'imageUrl': imageUrl,
      'validity': validity,
      'description': description,
    };
    await _push(
      context,
      AppRoutes.benefitDetail,
      extra: extra,
      fallbackBuilder: () => BenefitDetailScreen(
        title: title,
        discount: discount,
        category: category,
        imagePath: imagePath,
        imageUrl: imageUrl,
        validity: validity,
        description: description,
      ),
    );
  }

  static Future<void> toTripDetail(
    BuildContext context, {
    String title = 'Ain Sokhna Retreat',
    String destination = 'Ain Sokhna • Red Sea',
    String price = 'EGP 500',
    String originalPrice = 'EGP 1,200',
    String date = 'Friday, 24 Oct 2026',
    String imagePath = 'assets/images/benefit_sokhna.png',
    String? imageUrl,
    String? tripId,
    int totalSeats = 30,
    int bookedSeats = 23,
    List<String>? inclusions,
    List<TripItineraryStep>? itinerary,
  }) async {
    final extra = {
      'title': title,
      'destination': destination,
      'price': price,
      'originalPrice': originalPrice,
      'date': date,
      'imagePath': imagePath,
      'imageUrl': imageUrl,
      'tripId': tripId,
      'totalSeats': totalSeats,
      'bookedSeats': bookedSeats,
      'inclusions': inclusions,
      'itinerary': itinerary,
    };
    await _push(
      context,
      AppRoutes.tripDetail,
      extra: extra,
      fallbackBuilder: () => TripDetailScreen(
        title: title,
        destination: destination,
        price: price,
        originalPrice: originalPrice,
        date: date,
        imagePath: imagePath,
        imageUrl: imageUrl,
        tripId: tripId,
        totalSeats: totalSeats,
        bookedSeats: bookedSeats,
        inclusions: inclusions,
        itinerary: itinerary,
      ),
    );
  }

  // ---- Profile Feature ----
  static Future<void> toSettings(BuildContext context) async {
    await _push(context, AppRoutes.settings,
        fallbackBuilder: () => const SettingsScreen());
  }

  static Future<void> toChangePin(BuildContext context) async {
    await _push(context, AppRoutes.changePin,
        fallbackBuilder: () => const ChangePinScreen());
  }

  static Future<void> toHelpSupport(BuildContext context) async {
    await _push(context, AppRoutes.helpSupport,
        fallbackBuilder: () => const HelpSupportScreen());
  }

  // ---- Back / Pop ----
  static void pop<T>(BuildContext context, [T? result]) {
    final router = GoRouter.maybeOf(context);
    if (router != null && router.canPop()) {
      router.pop(result);
    } else {
      Navigator.of(context).maybePop(result);
    }
  }
}
