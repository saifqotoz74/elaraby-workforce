import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../storage/local_store.dart';
import '../theme/app_theme.dart';
import 'l10n_map.dart';

/// Centralized locale manager backed by Flutter official ARB-generated [AppLocalizations].
///
/// Supports English and Arabic, full RTL/LTR text directionality,
/// and Arabic/English pluralization rules.
class AppLocale extends ChangeNotifier {
  static final AppLocale instance = AppLocale._();
  AppLocale._();

  Locale _locale = const Locale('en');
  late AppLocalizations _l10n = lookupAppLocalizations(_locale);

  Locale get currentLocale => _locale;
  bool get isArabic => _locale.languageCode == 'ar';
  bool get isRTL => _locale.languageCode == 'ar';
  TextDirection get textDirection =>
      isRTL ? TextDirection.rtl : TextDirection.ltr;

  AppLocalizations get l10n => _l10n;
  static AppLocalizations get current => instance._l10n;

  /// Restores the saved language at startup (before the first frame).
  void loadFromStorage() {
    final code = LocalStore.instance.localeCode;
    if (code == 'ar' || code == 'en') {
      _locale = Locale(code!);
    } else {
      _locale = const Locale('ar');
    }
    _l10n = lookupAppLocalizations(_locale);
  }

  void setLocale(Locale newLocale) {
    if (_locale != newLocale) {
      _locale = newLocale;
      _l10n = lookupAppLocalizations(newLocale);
      LocalStore.instance.setLocaleCode(newLocale.languageCode);
      notifyListeners();
    }
  }

  void toggleLocale() {
    setLocale(isArabic ? const Locale('en') : const Locale('ar'));
  }

  /// Looks up a localized string by its ARB key.
  ///
  /// Prefers [AppLocalizations.of(context)] when a [context] is provided,
  /// falling back to the singleton's active [AppLocalizations] instance.
  /// Falls back to returning [key] if no translation exists.
  static final Map<String, Map<String, String>> _fallbacks = {
    'qa_buses': {'ar': 'حافلات العمل', 'en': 'Fleet Bus'},
    'welcome_title': {'ar': 'مرحباً بك في {company}', 'en': 'Welcome to {company}'},
    'company_services': {'ar': 'خدمات {company} للعاملين', 'en': '{company} Workforce Services'},
    'organization_workplace': {'ar': 'المؤسسة وجهة العمل', 'en': 'Organization & Workplace'},
    'switch_organization': {'ar': 'تغيير المؤسسة', 'en': 'Switch Organization'},
    'support_hotline_label': {'ar': 'الخط الساخن: {hotline}', 'en': 'Hotline: {hotline}'},
    'loans_and_advances': {'ar': 'السلف والقروض', 'en': 'Loans & Advances'},
    'loans_subtitle': {'ar': 'إدارة السلف، القروض الحسنة وجدول الأقساط', 'en': 'Manage advances, social loans & schedules'},
    'salary_slips_tab': {'ar': 'كشف الراتب', 'en': 'Salary Slip'},
    'loans_advances_tab': {'ar': 'السلف والقروض', 'en': 'Loans & Advances'},
    'installments_tab': {'ar': 'جدول الأقساط', 'en': 'Installments'},
    'apply_new_loan': {'ar': 'طلب سلفة جديدة', 'en': 'Apply for Advance'},
    'emergency_advance': {'ar': 'سلفة طارئة', 'en': 'Emergency Advance'},
    'social_loan': {'ar': 'قرض حسن / رعاية اجتماعية', 'en': 'Social Loan'},
    'loan_amount': {'ar': 'قيمة المبلغ المطلوب', 'en': 'Requested Amount'},
    'repayment_months': {'ar': 'مدة السداد بالشهور', 'en': 'Repayment Period'},
    'monthly_installment': {'ar': 'القسط الشهري المتوقع', 'en': 'Monthly Installment'},
    'loan_purpose': {'ar': 'سبب أو غرض الطلب', 'en': 'Purpose of Request'},
    'financial_hub_title': {'ar': 'المركز المالي والمفردات', 'en': 'Financial Hub & Salary'},
    'historical_statements': {'ar': 'كشوف الشهور السابقة', 'en': 'Past Statements'},
    'download_official_pdf': {'ar': 'تحميل بيان الراتب الرسمي (PDF)', 'en': 'Download Official PDF Slip'},
    'earnings_title': {'ar': 'المستحقات والبدلات', 'en': 'Earnings & Allowances'},
    'deductions_title': {'ar': 'الاستقطاعات والخصومات', 'en': 'Deductions & Taxes'},
    'overtime_pay': {'ar': 'ساعات إضافية', 'en': 'Overtime Pay'},
    'transport_allowance': {'ar': 'بدل انتقال', 'en': 'Transport Allowance'},
    'meal_allowance': {'ar': 'بدل وجبة وطبيعة عمل', 'en': 'Meal Allowance'},
    'production_incentive': {'ar': 'حافز إنتاج وانتظام', 'en': 'Production Incentive'},
    'social_insurance': {'ar': 'تأمينات اجتماعية', 'en': 'Social Insurance'},
    'income_tax': {'ar': 'ضريبة كسب العمل', 'en': 'Income Tax'},
    'medical_insurance': {'ar': 'تأمين صحي', 'en': 'Medical Insurance'},
    'loan_deduction': {'ar': 'قسط سلفة / قرض', 'en': 'Loan Installment'},
    'penalties_deduction': {'ar': 'جزاءات وتأخيرات', 'en': 'Penalties & Delays'},
    'active_loan_progress': {'ar': 'نسبة سداد السلفة الحالية', 'en': 'Active Loan Progress'},
    'remaining_balance': {'ar': 'المبلغ المتبقي', 'en': 'Remaining Balance'},
    'installment_count_desc': {'ar': 'عدد الأقساط', 'en': 'Installments'},
    'loan_status_active': {'ar': 'ساري ويتم الاستقطاع', 'en': 'Active & Deducting'},
    'loan_status_pending': {'ar': 'قيد المراجعة الإدارية', 'en': 'Pending HR Review'},
    'loan_status_completed': {'ar': 'مسدد بالكامل', 'en': 'Fully Repaid'},
    'loan_receipt_title': {'ar': 'إيصال تقديم الطلب المالي', 'en': 'Financial Request Receipt'},
    'loan_receipt_ref': {'ar': 'رقم المعاملة المرجعي', 'en': 'Transaction Reference'},
    'month_comparison_positive': {'ar': 'زيادة عن الشهر السابق', 'en': 'more than last month'},
    'month_comparison_negative': {'ar': 'أقل من الشهر السابق', 'en': 'less than last month'},
    'annual_leave': {'ar': 'إجازة سنوية', 'en': 'Annual Leave'},
    'emergency_leave': {'ar': 'إجازة عارضة', 'en': 'Emergency Leave'},
    'sick_leave': {'ar': 'إجازة مرضية', 'en': 'Sick Leave'},
    'unpaid_leave': {'ar': 'إجازة بدون مرتب', 'en': 'Unpaid Leave'},
    'medical_report_required': {'ar': 'يرجى إرفاق التقرير الطبي أو الروشتة المعتمدة', 'en': 'Please attach certified medical report or prescription'},
    'emergency_cap_note': {'ar': 'الحد الأقصى للإجازة العارضة يومين متتاليين و 6 أيام سنوياً طبقاً لقانون العمل المصري', 'en': 'Emergency leave is capped at 2 consecutive days & 6 days/year under Egyptian Labor Law'},
    'attach_medical_doc': {'ar': 'إرفاق تقرير طبي / مستند', 'en': 'Attach Medical Report / Document'},
    'camera_photo': {'ar': 'التقاط صورة بالكاميرا', 'en': 'Take Photo with Camera'},
    'gallery_photo': {'ar': 'اختيار من معرض الصور', 'en': 'Choose from Gallery'},
    'browse_file': {'ar': 'اختيار ملف PDF / مستند', 'en': 'Choose PDF / Document'},
    'file_attached': {'ar': 'تم إرفاق المستند بنجاح', 'en': 'Document attached successfully'},
    'remove_attachment': {'ar': 'حذف المستند', 'en': 'Remove Document'},
    'working_days_summary': {'ar': 'صافي أيام الإجازة المحتسبة', 'en': 'Net Billable Leave Days'},
    'weekends_excluded': {'ar': 'عطلات نهاية الأسبوع المستبعدة (الجمعة والسبت)', 'en': 'Excluded Weekends (Fri & Sat)'},
    'holidays_excluded': {'ar': 'العطلات الرسمية المستبعدة', 'en': 'Excluded Official Holidays'},
    'approval_timeline': {'ar': 'مراحل الاعتماد والموافقة', 'en': 'Approval Stages Timeline'},
    'stage_pending': {'ar': 'قيد المراجعة', 'en': 'Pending Review'},
    'stage_approved': {'ar': 'تمت الموافقة', 'en': 'Approved'},
    'stage_rejected': {'ar': 'مرفوض', 'en': 'Rejected'},
    'vacation_balance_hub': {'ar': 'سجل وأرصدة الإجازات', 'en': 'Vacation & Leave Balance Hub'},
    'annual_balance_available': {'ar': 'الرصيد السنوي المتاح', 'en': 'Available Annual Balance'},
    'emergency_balance_used': {'ar': 'المستهلك من العارضة', 'en': 'Emergency Days Used'},
    'sick_days_taken': {'ar': 'أيام الإجازات المرضية', 'en': 'Sick Days Taken'},
    'leave_history_title': {'ar': 'سجل الإجازات المسجلة', 'en': 'Recorded Leaves History'},
    'emergency_annual_limit': {'ar': 'الحد السنوي للعارضة 6 أيام', 'en': 'Annual Emergency Cap: 6 Days'},
    'tab_roster_calendar': {'ar': 'جدول الورديات', 'en': 'Roster & Calendar'},
    'tab_attendance_punch': {'ar': 'الحضور والانصراف', 'en': 'Attendance & QR Punch'},
    'tab_swaps_overtime': {'ar': 'التبديلات والإضافي', 'en': 'Swaps & Overtime'},
    'morning_shift': {'ar': 'الوردية الأولى (صباحية)', 'en': 'Morning Shift (1st)'},
    'evening_shift': {'ar': 'الوردية الثانية (مسائية)', 'en': 'Evening Shift (2nd)'},
    'night_shift': {'ar': 'الوردية الثالثة (ليلية)', 'en': 'Night Shift (3rd)'},
    'regular_shift': {'ar': 'دوام إداري منتظم', 'en': 'Regular Office Hours'},
    'rest_day': {'ar': 'عطلة أسبوعية', 'en': 'Rest Day'},
    'request_shift_swap': {'ar': 'طلب تبديل وردية', 'en': 'Request Shift Swap'},
    'select_colleague': {'ar': 'اختر الزميل البديل', 'en': 'Select Colleague'},
    'swap_pending_colleague': {'ar': 'في انتظار موافقة الزميل', 'en': 'Waiting for Colleague'},
    'swap_pending_supervisor': {'ar': 'في انتظار اعتماد المشرف', 'en': 'Pending Supervisor Review'},
    'swap_approved': {'ar': 'تم اعتماد التبديل', 'en': 'Swap Approved'},
    'swap_declined': {'ar': 'تم رفض التبديل', 'en': 'Swap Declined'},
    'accept_swap': {'ar': 'موافقة على التبديل', 'en': 'Accept Swap'},
    'decline_swap': {'ar': 'اعتذار عن التبديل', 'en': 'Decline Swap'},
    'fatigue_rule_warning': {'ar': 'تنبيه السلامة: يمنع العمل ورديتين متتاليتين طبقاً لقانون العمل', 'en': 'Safety Alert: Back-to-back double shifts are prohibited under Egyptian Labor Law'},
    'log_overtime': {'ar': 'تسجيل عمل إضافي', 'en': 'Claim Overtime'},
    'overtime_day_rate': {'ar': 'إضافي نهاري (135%)', 'en': 'Daytime Overtime (135%)'},
    'overtime_night_rate': {'ar': 'إضافي ليلي (170%)', 'en': 'Nighttime Overtime (170%)'},
    'overtime_holiday_rate': {'ar': 'إضافي عطلات وراحة (200%)', 'en': 'Holiday / Rest Day OT (200%)'},
    'overtime_hours': {'ar': 'عدد الساعات الإضافية', 'en': 'Overtime Hours'},
    'overtime_reason': {'ar': 'سبب العمل الإضافي', 'en': 'Overtime Reason'},
    'statutory_calculation': {'ar': 'حساب التعويض طبقاً لقانون العمل', 'en': 'Statutory Egyptian Labor Law Calculation'},
    'punch_in': {'ar': 'تسجيل حضور', 'en': 'Punch In'},
    'punch_out': {'ar': 'تسجيل انصراف', 'en': 'Punch Out'},
    'checked_in_status': {'ar': 'حاضر بالوردية', 'en': 'Currently on Shift'},
    'checked_out_status': {'ar': 'تم تسجيل الانصراف', 'en': 'Shift Completed'},
    'not_checked_in_status': {'ar': 'لم يسجل حضور بعد', 'en': 'Not Checked In'},
    'geofence_within': {'ar': 'متواجد داخل نطاق المصنع', 'en': 'Within Factory Premises'},
    'geofence_outside': {'ar': 'خارج نطاق المصنع', 'en': 'Outside Factory Geofence'},
    'attendance_qr_title': {'ar': 'باركود الحضور الذكي', 'en': 'Smart Attendance QR'},
    'attendance_qr_desc': {'ar': 'امسح الباركود عند البوابة الأمنية أو جهاز البصمة', 'en': 'Scan at security turnstile or punch terminal'},
    'offline_token_badge': {'ar': 'رمز الحضور دون اتصال', 'en': 'Offline Token'},
    'on_time_badge': {'ar': 'في الموعد', 'en': 'On Time'},
    'late_badge': {'ar': 'تأخير', 'en': 'Late'},
    // Transportation Fleet Module
    'company_transportation': {'ar': 'أتوبيسات الشركة والنقل', 'en': 'Company Transportation'},
    'svc_transport_subtitle': {'ar': 'تتبّع الحافلة ومواعيد الخطوط', 'en': 'Live bus tracking & routes'},
    'tab_my_commute': {'ar': 'رحلتي وتتبّع الحافلة', 'en': 'My Commute & Tracking'},
    'tab_routes_directory': {'ar': 'دليل الخطوط والمواعيد', 'en': 'Routes & Schedules'},
    'tab_boarding_pass': {'ar': 'بطاقة الصعود والبلاغات', 'en': 'Boarding Pass & Alerts'},
    'bus_in_transit': {'ar': 'في الطريق إلى محطتك', 'en': 'En route to your stop'},
    'bus_approaching': {'ar': 'الحافلة على وشك الوصول', 'en': 'Bus approaching stop'},
    'bus_at_stop': {'ar': 'الحافلة وصلت إلى المحطة الآن', 'en': 'Bus arrived at stop'},
    'pickup_stop': {'ar': 'محطة الركوب المحددة', 'en': 'Selected Pickup Stop'},
    'change_stop': {'ar': 'تغيير المحطة', 'en': 'Change Stop'},
    'eta_countdown': {'ar': 'وقت الوصول المقدر', 'en': 'Estimated Arrival Time'},
    'minutes_abbr': {'ar': 'دقيقة', 'en': 'mins'},
    'km_abbr': {'ar': 'كم', 'en': 'km'},
    'driver_details': {'ar': 'بيانات السائق والمركبة', 'en': 'Driver & Vehicle Details'},
    'call_driver': {'ar': 'اتصال بالسائق', 'en': 'Call Driver'},
    'bus_model_label': {'ar': 'طراز الحافلة', 'en': 'Bus Model'},
    'bus_plate_label': {'ar': 'رقم اللوحة', 'en': 'Plate Number'},
    'request_transfer_btn': {'ar': 'طلب تحويل خط', 'en': 'Request Line Transfer'},
    'digital_boarding_pass': {'ar': 'بطاقة الصعود الرقمية', 'en': 'Digital Boarding Pass'},
    'boarding_pass_hint': {'ar': 'أبرز رمز QR لمشرف الحافلة عند الصعود', 'en': 'Present QR to bus supervisor upon boarding'},
    'seat_number': {'ar': 'رقم المقعد', 'en': 'Seat Number'},
    'transit_excuse_active': {'ar': 'عذر تأخير مروري معتمد', 'en': 'Approved Traffic Delay Excuse'},
    'report_delay_btn': {'ar': 'إبلاغ عن عطل / زحام', 'en': 'Report Delay / Breakdown'},
    'missed_bus_btn': {'ar': 'فاتني الأتوبيس؟', 'en': 'Missed Your Bus?'},
    'missed_bus_title': {'ar': 'مساعد الحافلات البديلة', 'en': 'Alternate Bus Assistant'},
    'missed_bus_desc': {'ar': 'يمكنك استقلال أحد الخطوط البديلة المتجهة لنفس المجمع الصناعي:', 'en': 'You can board any of these alternate buses heading to the same complex:'},
    'active_alerts_title': {'ar': 'تنبيهات وبلاغات الطريق', 'en': 'Live Route & Traffic Alerts'},
    'no_active_alerts': {'ar': 'حركة المرور طبيعية على مسار الخط', 'en': 'Traffic is flowing smoothly on this line'},
    'search_routes_hint': {'ar': 'ابحث باسم الخط أو المنطقة أو المحطة...', 'en': 'Search by route name, area, or stop...'},
    'all_factories_tab': {'ar': 'جميع المجمعات', 'en': 'All Complexes'},
    'transfer_reason_label': {'ar': 'سبب طلب تحويل الخط', 'en': 'Reason for Route Transfer'},
    'submit_transfer_request': {'ar': 'تأكيد طلب التحويل', 'en': 'Submit Transfer Request'},
    'incident_type_traffic': {'ar': 'تكدس مروري حاد', 'en': 'Heavy Traffic Jam'},
    'incident_type_breakdown': {'ar': 'عطل ميكانيكي بالحافلة', 'en': 'Mechanical Breakdown'},
    'incident_type_detour': {'ar': 'تحويلة مرورية / غلق طريق', 'en': 'Road Detour / Closure'},
    'incident_notes_hint': {'ar': 'اكتب وصفاً مختصراً للموقف...', 'en': 'Briefly describe the situation...'},
    'incident_sent_success': {'ar': 'تم إرسال البلاغ لغرفة العمليات وسائقي الخط', 'en': 'Incident reported to control room & drivers'},
    // Proximity Alerts & Smart Commute Suppression
    'proximity_alert_active': {'ar': 'تنبيهات اقتراب الحافلة مفعّلة', 'en': 'Bus approaching alerts active'},
    'proximity_alert_suppressed': {'ar': 'التنبيهات متوقفة مؤقتاً', 'en': 'Alerts temporarily paused'},
    'not_commuting_today': {'ar': 'لن أستقل الأتوبيس اليوم', 'en': 'Not Commuting Today'},
    'not_commuting_desc': {'ar': 'إيقاف تنبيهات اقتراب الحافلة لليوم وتحديث كشف ركاب الخط', 'en': 'Pause approaching alerts for today and update passenger roster'},
    'commuting_confirmed': {'ar': 'تم تأكيد اشتراكك في رحلة اليوم وتفعيل التنبيهات', 'en': 'Commute confirmed for today with active alerts'},
    'commuting_paused': {'ar': 'تم إيقاف تنبيهات الحافلة لليوم بناءً على اختيارك', 'en': 'Bus alerts paused for today as requested'},
    'open_live_map_action': {'ar': 'عرض الخريطة الحية', 'en': 'Open Live Map'},
    'call_driver_action': {'ar': 'اتصال بالسائق', 'en': 'Call Driver'},
    'approaching_banner_title': {'ar': 'الحافلة على وشك الوصول!', 'en': 'Bus Approaching Now!'},
    'approaching_banner_desc': {'ar': 'الحافلة على بُعد أقل من 10 دقائق من محطتك. يُرجى التواجد في نقطة الركوب.', 'en': 'Bus is less than 10 minutes away. Please be ready at your stop.'},
    'simulated_proximity_ping': {'ar': 'تجربة إشعار اقتراب الحافلة', 'en': 'Simulate Proximity Alert'},
    // Driver & Bus Supervisor Dedicated Tablet Console
    'driver_console_title': {'ar': 'لوحة تحكم السائق والمشرف', 'en': 'Driver & Supervisor Cockpit'},
    'driver_cockpit_mode': {'ar': 'وضع السائق والمشرف', 'en': 'Driver Cockpit Mode'},
    'driver_pin_prompt': {'ar': 'أدخل رمز مرور السائق (PIN)', 'en': 'Enter Driver Security PIN'},
    'driver_pin_invalid': {'ar': 'رمز المرور غير صحيح (الافتراضي: 1234)', 'en': 'Invalid PIN (Default: 1234)'},
    'manifest_boarded_count': {'ar': 'تم الصعود', 'en': 'Boarded'},
    'manifest_waiting_count': {'ar': 'في الانتظار', 'en': 'Waiting'},
    'manifest_opted_out_count': {'ar': 'معتذر اليوم', 'en': 'Opted Out'},
    'manifest_occupancy': {'ar': 'نسبة الإشغال', 'en': 'Occupancy'},
    'manifest_all_accounted': {'ar': 'تم حصر جميع ركاب الخط', 'en': 'All Passengers Accounted For'},
    'stop_departure_action': {'ar': 'تحرك من المحطة (المحطة التالية)', 'en': 'Depart Stop (Advance)'},
    'departed_badge': {'ar': 'تمت المغادرة', 'en': 'Departed'},
    'current_stop_badge': {'ar': 'المحطة الحالية', 'en': 'Current Stop'},
    'upcoming_stop_badge': {'ar': 'محطة قادمة', 'en': 'Upcoming Stop'},
    'manual_check_in_btn': {'ar': 'تسجيل صعود يدوي', 'en': 'Manual Check-in'},
    'passenger_boarded_success': {'ar': 'تم تأكيد صعود الراكب بنجاح', 'en': 'Passenger boarded successfully'},
    'delay_preset_15m': {'ar': 'تكدس مروري (+15 د)', 'en': 'Traffic Jam (+15m)'},
    'delay_preset_35m': {'ar': 'عطل طارئ (+35 د)', 'en': 'Breakdown (+35m)'},
    'delay_excuse_issued': {'ar': 'تم تسجيل البلاغ ومنح عذر تأخير رسمي لجميع ركاب الحافلة', 'en': 'Delay logged & official HR transit excuse granted to all onboard'},
    'arrived_complex_btn': {'ar': 'وصلنا المجمع (إنهاء الرحلة)', 'en': 'Arrived at Complex (End Run)'},
    'run_completed_dialog_title': {'ar': 'تم إنهاء خط السير بنجاح', 'en': 'Route Completed Successfully'},
    'run_completed_dialog_desc': {'ar': 'تم تسجيل وصول الحافلة واعتماد ركابها في المجمع الصناعي.', 'en': 'Bus arrival recorded and passengers registered at Industrial Complex.'},
    'qr_scanner_title': {'ar': 'مسح رمز صعود الراكب', 'en': 'Scan Passenger QR'},
    'qr_simulated_scan': {'ar': 'محاكاة مسح QR', 'en': 'Simulate QR Scan'},
    'enter_pin_btn': {'ar': 'تأكيد الدخول', 'en': 'Verify PIN'},
    'driver_mode_desc': {'ar': 'شاشة مخصصة لكابتن الحافلة ومشرف الخط لمتابعة كشف الركاب والتحكم في مسار الرحلة.', 'en': 'Dedicated cockpit for bus captain & line supervisor to track manifests and manage highway stops.'},
    'map_camera_follow_bus': {'ar': 'تتبع الحافلة', 'en': 'Follow Bus'},
    'map_camera_my_stop': {'ar': 'محطتي', 'en': 'My Stop'},
    'map_camera_fit_route': {'ar': 'كامل المسار', 'en': 'Whole Route'},
    'map_stop_details_title': {'ar': 'تفاصيل المحطة', 'en': 'Stop Details'},
    'map_set_as_my_stop': {'ar': 'تعيين كمحطة ركوبي الأساسية', 'en': 'Set as My Pickup Stop'},
    'map_pickup_zone_active': {'ar': 'أنت داخل نطاق محطة الركوب (نصف قطر ٥٠٠م)', 'en': 'Inside Pickup Geofence (500m radius)'},
    'map_offline_vector_mode': {'ar': 'وضع الخريطة غير المتصلة (أوفلاين)', 'en': 'Offline Corridor Map'},
    'map_zoom_in': {'ar': 'تكبير', 'en': 'Zoom In'},
    'map_zoom_out': {'ar': 'تصغير', 'en': 'Zoom Out'},
    'map_live_speed': {'ar': 'السرعة الحالية', 'en': 'Current Speed'},
    'map_next_stop_label': {'ar': 'المحطة القادمة', 'en': 'Next Stop'},
    'map_bus_bearing': {'ar': 'الاتجاه', 'en': 'Bearing'},
  };

  /// Looks up a localized string by its ARB key.
  ///
  /// Prefers [AppLocalizations.of(context)] when a [context] is provided,
  /// falling back to the singleton's active [AppLocalizations] instance.
  /// Falls back to returning [key] if no translation exists.
  static String tr(String key, [BuildContext? context]) {
    final activeL10n =
        (context != null ? AppLocalizations.of(context) : null) ??
            instance._l10n;
    String text = lookupL10nString(activeL10n, key) ?? '';
    if (text.isEmpty) {
      final fb = _fallbacks[key];
      if (fb != null) {
        text = (instance.isArabic ? fb['ar'] : fb['en']) ?? key;
      } else {
        text = key;
      }
    }
    if (text.contains('{company}') || text.contains('{hotline}')) {
      final brand = AppTheme.currentBrand;
      text = text
          .replaceAll('{company}', brand.localizedCompanyName(instance.isArabic))
          .replaceAll('{hotline}', brand.supportHotline);
    }
    return text;
  }

  /// Lockout message formatted with remaining minutes.
  static String trLocked(int minutes) =>
      instance._l10n.auth_locked(minutes.toString());

  /// Typed pluralization helper for lockout minutes.
  static String trLockedPlural(num minutes) =>
      instance._l10n.auth_locked_minutes(minutes);

  /// Typed pluralization helper for vacation days available.
  static String vacationDaysCount(num count) =>
      instance._l10n.vacation_days_count(count);

  /// Typed pluralization helper for vacation days remaining.
  static String vacationDaysRemainingCount(num count) =>
      instance._l10n.vacation_days_remaining_count(count);

  /// Typed pluralization helper for trip seats remaining.
  static String tripSeatsLeftCount(num count) =>
      instance._l10n.trip_seats_left_count(count);
}

/// Convenience extension on [BuildContext] for ergonomic localization access.
extension AppLocalizationExtension on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
  bool get isRTL => Directionality.of(this) == TextDirection.rtl;
  TextDirection get textDirection => Directionality.of(this);
}
