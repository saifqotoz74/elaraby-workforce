/// Centralized route paths and names for the Elaraby Workforce application.
abstract class AppRoutes {
  // ---- Authentication & Onboarding Routes ----
  static const String splash = '/';
  static const String getStarted = '/get-started';
  static const String nationalId = '/national-id';
  static const String otp = '/otp';
  static const String profileConfirmation = '/profile-confirmation';
  static const String createPin = '/create-pin';
  static const String confirmPin = '/confirm-pin';
  static const String lock = '/lock';

  // ---- Main Shell & Bottom Navigation ----
  static const String main = '/main';
  static const String home = '/home';
  static const String services = '/services';
  static const String benefits = '/benefits';
  static const String inbox = '/inbox';
  static const String profile = '/profile';

  // ---- Services Feature Routes ----
  static const String vacationBalance = '/vacation-balance';
  static const String requestLeave = '/request-leave';
  static const String shiftSchedule = '/shift-schedule';
  static const String salarySlip = '/salary-slip';
  static const String hrRequest = '/hr-request';
  static const String raiseConcern = '/raise-concern';
  static const String employeeData = '/employee-data';
  static const String yourRequests = '/your-requests';

  // ---- Home Feature Routes ----
  static const String announcementDetail = '/announcement-detail';
  static const String companyNews = '/company-news';

  // ---- Benefits Feature Routes ----
  static const String benefitDetail = '/benefit-detail';
  static const String tripDetail = '/trip-detail';

  // ---- Profile Feature Routes ----
  static const String settings = '/settings';
  static const String changePin = '/change-pin';
  static const String helpSupport = '/help-support';

  // ---- Unknown Route (404) ----
  static const String unknown = '/404';

  /// Returns true if the given [location] is an authentication / onboarding screen.
  static bool isAuthRoute(String location) {
    return location == splash ||
        location == getStarted ||
        location == nationalId ||
        location == otp ||
        location == profileConfirmation ||
        location == createPin ||
        location == confirmPin ||
        location == lock;
  }

  /// Returns true if the given [location] represents a protected app resource.
  static bool isProtectedRoute(String location) {
    return !isAuthRoute(location) && location != unknown;
  }
}
