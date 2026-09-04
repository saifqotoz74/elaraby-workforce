import 'package:flutter/material.dart';

import '../storage/local_store.dart';

class AppLocale extends ChangeNotifier {
  static final AppLocale instance = AppLocale._();
  AppLocale._();

  Locale _locale = const Locale('en');

  Locale get currentLocale => _locale;
  bool get isArabic => _locale.languageCode == 'ar';

  /// Restores the saved language at startup (before the first frame).
  void loadFromStorage() {
    final code = LocalStore.instance.localeCode;
    if (code == 'ar' || code == 'en') {
      _locale = Locale(code!);
    }
  }

  void setLocale(Locale newLocale) {
    if (_locale != newLocale) {
      _locale = newLocale;
      LocalStore.instance.setLocaleCode(newLocale.languageCode);
      notifyListeners();
    }
  }

  void toggleLocale() {
    setLocale(isArabic ? const Locale('en') : const Locale('ar'));
  }

  static String tr(String key, [BuildContext? context]) {
    final isAr = instance.isArabic;
    if (!isAr) return _en[key] ?? key;
    return _ar[key] ?? key;
  }

  /// tr() with `{minutes}` interpolation for the lockout message.
  static String trLocked(int minutes) =>
      tr('auth_locked').replaceAll('{minutes}', '$minutes');

  static const Map<String, String> _en = {
    // Navigation
    'nav_home': 'Home',
    'nav_services': 'Services',
    'nav_benefits': 'Benefits',
    'nav_inbox': 'Inbox',
    'nav_profile': 'Profile',

    // Home
    'date_today': 'Sunday, 02 August',
    'welcome_user': 'Welcome, Ahmed',
    'announcement_badge': 'Important Announcement',
    'new_announcement': 'New Announcement',
    'announcement_title': 'New Shift Policy Starting\nfrom 10 August 2026',
    'read_now': 'Read Now',
    'todays_shift': "Today's Shift",
    'shift_time': '07:00 AM – 03:00 PM',
    'shift_line': 'Production line A',
    'vacation_left': 'Vacation Left',
    'vacation_days': '12 Days',
    'salary_label': 'Salary',
    'salary_status': 'Available',
    'quick_actions': 'Quick Actions',
    'qa_salary': 'Salary',
    'qa_vacation': 'Vacation',
    'qa_shift': 'Shift',
    'qa_benefits': 'Benefits',
    'qa_trips': 'Trips',
    'qa_support': 'Support',
    'company_news': 'Company News',
    'view_all': 'View All',
    'quick_survey': 'Quick Survey',
    'survey_question': 'Was it easy to find what you needed in the app?',

    // Profile
    'profile_title': 'Profile',
    'factory_label': 'Factory',
    'factory_value': '10th of Ramadan',
    'dept_label': 'Department',
    'dept_value': 'Production A',
    'menu_language': 'Language',
    'menu_settings': 'Settings',
    'menu_change_pin': 'Change PIN',
    'menu_logout': 'Logout',
    'current_language_name': 'English',

    // Services
    'services_title': 'Services',
    'services_subtitle': 'Everything you need in one place.',
    'your_requests': 'Your Requests',
    'pay_and_time': 'Pay & Time',
    'salary_slip': 'Salary Slip',
    'shift_schedule': 'Shift Schedule',
    'vacation_balance': 'Vacation Balance',
    'requests_section': 'Requests',
    'request_leave': 'Request Leave',
    'hr_request': 'HR Request',
    'raise_concern': 'Raise a Concern',
    'my_info': 'My Info',
    'employee_data': 'Employee Data',
    'common_questions': 'Common Questions',

    // Common
    'common_ok': 'OK',
    'common_cancel': 'Cancel',
    'common_submit': 'Submit',
    'common_edit': 'Edit',
    'common_save': 'Save',
    'common_save_changes': 'Save Changes',
    'help_title': 'Need Help?',

    // Auth
    'auth_national_id_title': 'Enter your National ID',
    'auth_national_id_subtitle':
        'Enter your 14–digit National ID number to locate your profile',
    'auth_of': 'of',
    'auth_continue': 'Continue',
    'auth_get_help_id': "Can't find your ID? Get help",
    'auth_id_help_body':
        'Your National ID number is printed on the front of your ID card. If you still cannot find it, visit the HR office (Building 2) or call the hotline 19319.',
    'auth_otp_title': 'Enter verification code',
    'auth_otp_sent_to': 'We sent a 6–digit code to',
    'auth_registered_phone': 'your registered phone',
    'auth_id_not_found':
        'National ID not found in workforce database. Please contact HR office.',
    'auth_auto_verify': 'Auto-verifies once complete',
    'auth_resend_in': 'Resend code in',
    'auth_resend_now': 'Resend code now',
    'auth_code_resent': 'A new code has been sent to your phone.',
    'auth_no_code_help': "Didn't get a code? Get help",
    'auth_otp_help_body':
        'Make sure you have network coverage and try resending the code. If it still does not arrive, call the IT help desk on extension 4022.',
    'auth_create_pin_title': 'Create your PIN',
    'auth_create_pin_subtitle':
        "You'll use this to log in and to unlock your salary slip",
    'auth_confirm_pin_title': 'Confirm your PIN',
    'auth_confirm_pin_subtitle': 'Enter the same PIN again to confirm',
    'auth_pin_mismatch': 'PINs do not match. Please try again.',
    'auth_wrong_pin': 'Wrong PIN. Please try again.',
    'auth_wrong_code': 'Wrong code. Please try again.',
    'auth_locked': 'Too many wrong attempts. Try again in {minutes} minutes.',
    'auth_dev_code': 'Testing code:',
    'auth_unlock_title': 'Welcome back',
    'auth_unlock_subtitle': 'Enter your 4-digit PIN to unlock the app',
    'auth_forgot_pin': 'Forgot your PIN?',
    'auth_forgot_body':
        'Resetting your PIN will sign you out and clear local data on this device. You will need to verify your National ID again.',
    'auth_get_started': 'Get Started',
    'auth_get_started_subtitle':
        'Your one app for shifts, salary, requests and company benefits.',

    // Profile confirmation
    'confirm_profile_title': 'We found your profile',
    'confirm_profile_subtitle': 'Please confirm these details are yours',
    'confirm_profile_name': 'Full Name',
    'confirm_profile_employee_id': 'Employee ID',
    'confirm_profile_factory': 'Factory',
    'confirm_profile_department': 'Department',
    'confirm_profile_yes': 'Yes, this is me',
    'confirm_profile_no': "No, this isn't me",

    // Change PIN
    'change_pin_step_current_title': 'Enter Current PIN',
    'change_pin_step_current_subtitle':
        'Please enter your existing 4-digit security PIN',
    'change_pin_step_new_title': 'Create New PIN',
    'change_pin_step_new_subtitle': 'Choose a new 4-digit PIN for your account',
    'change_pin_step_confirm_title': 'Confirm New PIN',
    'change_pin_step_confirm_subtitle': 'Enter the new 4-digit PIN once again',
    'change_pin_wrong_current':
        'Wrong PIN. Please enter your current PIN again.',
    'change_pin_success': 'PIN successfully changed!',

    // Inbox
    'inbox_title': 'Inbox',
    'inbox_mark_all_read': 'Mark all as read',
    'inbox_filter_all': 'All',
    'inbox_filter_announcements': 'Announcements',
    'inbox_filter_approvals': 'Approvals',
    'inbox_filter_benefits': 'Benefits',

    // Settings / Help
    'settings_title': 'Settings',
    'settings_fingerprint': 'Fingerprint Login',
    'settings_fingerprint_sub': 'Use biometrics instead of your PIN',
    'settings_salary_protection': 'Salary Slip Protection',
    'settings_salary_protection_sub': 'Require PIN to open salary documents',
    'settings_notifications': 'Push Notifications',
    'settings_notifications_sub': 'Announcements, approvals and shifts',
    'settings_about': 'About App',
    'settings_help': 'Help & Support',
    'help_subtitle': 'We are here for you — reach out any time.',
    'help_hotline': 'HR Hotline',
    'help_whatsapp': 'WhatsApp HR',
    'help_it': 'IT Help Desk',
    'help_clinic': 'Emergency Clinic',
    'help_hotline_value': '19319',
    'help_it_value': 'Ext. 4022',
    'help_clinic_value': '107',
    'help_open_hr_form': 'Open HR Request Form',

    // Employee data
    'emp_data_title': 'Employee Data',
    'emp_personal_info': 'Personal Information',
    'emp_work_info': 'Work Information',
    'emp_name': 'Full Name',
    'emp_code': 'Employee ID',
    'emp_phone': 'Phone Number',
    'emp_address': 'Address',
    'emp_emergency': 'Emergency Contact',
    'emp_position': 'Position',
    'emp_supervisor': 'Direct Supervisor',
    'emp_edit_title': 'Edit Information',
    'emp_edit_note':
        'Changes to personal information will be submitted to HR for review.',
    'emp_saved': 'Information updated successfully.',
    'emp_relationship': 'Relationship',
    'emp_hr_only': 'Some information can only be updated by HR.',

    // Leave request
    'leave_type': 'Leave Type',
    'leave_type_annual_leave': 'Annual Leave',
    'leave_type_sick_leave': 'Sick Leave',
    'leave_type_emergency_leave': 'Emergency Leave',
    'leave_type_unpaid_leave': 'Unpaid Leave',
    'leave_from': 'From',
    'leave_to': 'To',
    'leave_notes': 'Notes (Optional)',
    'leave_notes_hint': 'Add any details for your manager...',
    'leave_estimated_duration': 'Estimated Duration',
    'leave_exceeds_balance': 'Exceeds balance',
    'leave_submit': 'Submit Request',
    'leave_success': 'Leave request submitted successfully!',
    'leave_waiting_approval': 'Waiting on: Line Manager Approval',
    'leave_line_manager': 'Line Manager (Mohamed Hassan)',
    'leave_detail_duration': 'Duration',
    'leave_detail_dates': 'Dates',
    'leave_detail_type': 'Type',
    'leave_detail_submitted': 'Submitted',
    'time_just_now': 'Just now',
    'vac_days_available': 'Days Available',
    'vac_days_unit': 'Days',
    'vac_left_suffix': 'Left',
    'vac_total_available': 'Total Available',
    'vac_days_remaining': 'Days Remaining',
    'vac_annual': 'Annual',
    'vac_sick': 'Sick',
    'vac_emergency': 'Emergency',
    'vac_history': 'History',

    // Concern
    'concern_success': 'Concern submitted anonymously. Thank you.',

    // Salary slip
    'slip_paid_on': 'Paid on',
    'slip_breakdown_title': 'Earnings & Deductions',
    'slip_basic': 'Basic Salary',
    'slip_allowances': 'Allowances',
    'slip_allowances_sub': 'Housing & Transport',
    'slip_deductions': 'Deductions',
    'slip_deductions_sub': 'Tax & Insurance',
    'slip_total': 'Total Net Pay',
    'slip_download': 'Download PDF',
    'slip_shared': 'Salary slip PDF is ready to share.',
    'slip_share_failed': 'Could not generate the PDF. Please try again.',
    'slip_enter_pin': 'Enter your PIN to view salary documents.',

    // Services hub
    'svc_salary_subtitle': 'July — available now',
    'svc_shift_subtitle': '7am – 3pm today',
    'svc_days_remaining': 'days remaining',
    'svc_pending': 'PENDING',
    'svc_hr_subtitle': 'Document, letter, etc.',
    'svc_concern_subtitle': 'Anonymous',
    'svc_view_profile': 'View & update profile',

    // Shift schedule
    'shift_week_of': 'Week of',
    'shift_confirmed': 'Confirmed',
    'shift_rest_day': 'Rest Day',

    // Home
    'welcome_prefix': 'Welcome,',

    // Benefits
    'ben_subtitle': 'Exclusive perks and discounts',
    'ben_cat_featured': 'Featured',
    'ben_cat_supermarkets': 'Supermarkets',
    'ben_cat_health': 'Health Care',
    'ben_section_perks': 'Exclusive Perks',
    'ben_section_trips': 'Company Trips',
    'ben_section_expiring': 'Expiring Soon',
    'ben_show_id': 'Show Employee ID',
    'ben_employee_id': 'Employee ID',
    'ben_id_note':
        'Show this card at the participating store to claim your discount.',

    // Trips
    'trip_details': 'Company Trip Details',
    'trip_confirmed':
        'Seat confirmed! Check your Inbox for trip instructions.',
    'trip_cancelled': 'Trip reservation cancelled.',

    // Inbox
    'inbox_marked_all': 'All notifications marked as read',
    'inbox_from_hr': 'From HR',

    // Help actions
    'help_direct_channels': 'Direct Channels',
    'help_formal_inquiry': 'Need official documentation or a formal inquiry?',
    'help_track_request':
        'Submit an HR request directly through the app and track its approval status in real-time.',
    'help_call_now': 'Call Now',
    'help_open_chat': 'Open Chat',
    'help_call_it': 'Call IT',
    'help_emergency_call': 'Emergency Call',
    'help_cannot_open': 'No app found to open this link',


    // Announcement detail (policy article)
    'ann_detail_badge': 'POLICY UPDATE',
    'ann_detail_published': 'Published 01 Aug 2026 • HR Operations',
    'ann_detail_overview_title': 'Policy Overview',
    'ann_detail_overview_body':
        'To enhance operational efficiency and workforce well-being across our manufacturing facilities in 10th of Ramadan and Benha, Elaraby Group is transitioning to an updated rotational shift policy starting Monday, August 10, 2026.',
    'ann_detail_schedules_title': 'Updated Shift Schedules',
    'shift_name_morning': 'Morning Shift',
    'shift_name_evening': 'Evening Shift',
    'shift_name_night': 'Night Shift',
    'ann_detail_guidelines_title': 'Key Guidelines & Changes',
    'ann_guide_break_t': 'Break Times',
    'ann_guide_break_d': '45-minute lunch break and one 15-minute rest break per shift.',
    'ann_guide_bus_t': 'Transportation Buses',
    'ann_guide_bus_d': 'All company bus routes and timing will synchronize 30 minutes before shifts start.',
    'ann_guide_ot_t': 'Overtime & Allowances',
    'ann_guide_ot_d': 'Shift allowances for night shifts will increase by 15% effective from the first pay cycle.',
    'ann_contact_btn': 'Have Questions? Contact Supervisor',
    'ann_contact_sent': 'HR representative has been notified.',

    // News demo articles
    'news_read': 'Read Article',
    'news_demo1_title': 'New Manufacturing Facilities to Increase Production Capacity',
    'news_demo1_cat': 'Expansion',
    'news_demo1_body':
        'Elaraby Group announces the opening of two state-of-the-art production lines in 10th of Ramadan Industrial Zone, creating over 600 new specialized technical jobs and boosting export capabilities across the MENA region.',
    'news_demo2_title': 'Annual Safety Excellence Award Winners Announced for Q2',
    'news_demo2_cat': 'Safety & Quality',
    'news_demo2_body':
        'Production Line A in Benha has achieved 180 continuous days with zero incidents. Management commends the dedication and strict adherence to workplace safety guidelines.',
    'news_demo3_title': 'Healthcare & Wellness Week Starting This Sunday',
    'news_demo3_cat': 'Employee Well-being',
    'news_demo3_body':
        'Free comprehensive medical examinations, eye checkups, and nutritional counseling will be available to all factory workers across clinic centers from 9 AM to 4 PM.',
    'news_demo4_title': 'Quarterly Town Hall Meeting with Group Leadership',
    'news_demo4_cat': 'Leadership',
    'news_demo4_body':
        'Elaraby Group leadership reviewed our key operational milestones and shared the strategic roadmap for sustainable manufacturing, energy reduction, and digital transformation.',

    // Benefit detail
    'ben_valid_branches': 'Valid at all branches',
    'ben_redeem_title': 'How to Redeem',
    'ben_redeem_body': 'Simply present your Employee ID or National ID at checkout to enjoy your discount.',
    'ben_terms_title': 'Terms & Exclusions',
    'ben_terms_1': 'Not valid on already-discounted items',
    'ben_terms_2': 'Limited to one use per visit',
    'ben_terms_3': 'Cannot be combined with other offers.',
    'ben_about_title': 'About',
    'ben_default_desc':
        'A leading retail chain offering a wide selection of fresh produce, groceries, and household items at competitive prices for Elaraby employees.',
    'ben_report_issue': 'Having trouble with this perk? Report an issue',

    // Trip detail
    'trip_subsidized_badge': '60% COMPANY SUBSIDIZED',
    'trip_seats_filled': 'of seats filled',
    'trip_seats_left': 'left',
    'trip_inclusions_title': "What's Included",
    'trip_inc_1': 'Round-trip air-conditioned company buses',
    'trip_inc_2': 'Full-day private beach & pool access',
    'trip_inc_3': 'Open buffet lunch & refreshing soft drinks',
    'trip_inc_4': 'Organized team-building games & activities',
    'trip_inc_5': 'Full medical and safety coverage on-site',
    'trip_itinerary_title': 'Day Program',
    'trip_step1_t': 'Assembly & Departure',
    'trip_step1_d': 'Meeting at 10th of Ramadan Factory Gate 1',
    'trip_step2_t': 'Arrival & Welcome',
    'trip_step2_d': 'Welcome drinks and resort room allocations',
    'trip_step3_t': 'Lunch Buffet',
    'trip_step3_d': 'Full open-buffet lunch at main seaside restaurant',
    'trip_step4_t': 'Sunset Gathering',
    'trip_step4_d': 'Tea, music, and group photography session',
    'trip_step5_t': 'Return Journey',
    'trip_step5_d': 'Buses depart back to 10th of Ramadan & Cairo',
    'trip_book_now': 'Book Seat Now',
    'trip_cancel_booking': 'Cancel Reservation',

    // Biometrics
    'biometric_prompt': 'Unlock Elaraby Connect',
    'biometric_button': 'Unlock with fingerprint',
    'biometric_failed': 'Biometric authentication failed — use your PIN.',
    'biometric_not_setup': 'Fingerprint is not set up on this device. Use your PIN.',

    // Settings sections
    'settings_security': 'Security & Fast Access',
    'settings_notifications_header': 'Notification',
  };

  static const Map<String, String> _ar = {
    // Navigation
    'nav_home': 'الرئيسية',
    'nav_services': 'الخدمات',
    'nav_benefits': 'المزايا',
    'nav_inbox': 'الوارد',
    'nav_profile': 'حسابي',

    // Home
    'date_today': 'الأحد، 02 أغسطس',
    'welcome_user': 'مرحباً، أحمد',
    'announcement_badge': 'إعلان هام',
    'new_announcement': 'إعلان جديد',
    'announcement_title': 'سياسة الورديات الجديدة\nبدءاً من 10 أغسطس 2026',
    'read_now': 'اقرأ الآن',
    'todays_shift': 'وردية اليوم',
    'shift_time': '07:00 ص – 03:00 م',
    'shift_line': 'خط الإنتاج أ',
    'vacation_left': 'رصيد الإجازات',
    'vacation_days': '12 يوم',
    'salary_label': 'الراتب',
    'salary_status': 'متاح الآن',
    'quick_actions': 'الوصول السريع',
    'qa_salary': 'المرتب',
    'qa_vacation': 'الإجازات',
    'qa_shift': 'الورديات',
    'qa_benefits': 'المزايا',
    'qa_trips': 'الرحلات',
    'qa_support': 'الدعم',
    'company_news': 'أخبار الشركة',
    'view_all': 'عرض الكل',
    'quick_survey': 'استبيان سريع',
    'survey_question': 'هل كان من السهل العثور على ما تحتاجه في التطبيق؟',

    // Profile
    'profile_title': 'الملف الشخصي',
    'factory_label': 'المصنع',
    'factory_value': 'العاشر من رمضان',
    'dept_label': 'القسم',
    'dept_value': 'الإنتاج أ',
    'menu_language': 'اللغة',
    'menu_settings': 'الإعدادات',
    'menu_change_pin': 'تغيير الرمز السري',
    'menu_logout': 'تسجيل الخروج',
    'current_language_name': 'العربية',

    // Services
    'services_title': 'الخدمات',
    'services_subtitle': 'كل ما تحتاجه في مكان واحد.',
    'your_requests': 'طلباتك السابقة',
    'pay_and_time': 'الرواتب والوقت',
    'salary_slip': 'مفردات المرتب',
    'shift_schedule': 'جدول الورديات',
    'vacation_balance': 'رصيد الإجازات',
    'requests_section': 'الطلبات',
    'request_leave': 'طلب إجازة',
    'hr_request': 'طلب مستند HR',
    'raise_concern': 'تقديم شكوى / مقترح',
    'my_info': 'بياناتي',
    'employee_data': 'بيانات الموظف',
    'common_questions': 'الأسئلة الشائعة',

    // Common
    'common_ok': 'حسناً',
    'common_cancel': 'إلغاء',
    'common_submit': 'إرسال',
    'common_edit': 'تعديل',
    'common_save': 'حفظ',
    'common_save_changes': 'حفظ التعديلات',
    'help_title': 'تحتاج مساعدة؟',

    // Auth
    'auth_national_id_title': 'أدخل الرقم القومي',
    'auth_national_id_subtitle':
        'أدخل رقمك القومي المكوّن من 14 رقماً للعثور على ملفك الشخصي',
    'auth_of': 'من',
    'auth_continue': 'متابعة',
    'auth_get_help_id': 'لا تستطيع إيجاد رقمك القومي؟ احصل على مساعدة',
    'auth_id_help_body':
        'رقمك القومي مطبوع على بطاقة الرقم القومي. إذا لم تجده، تفضل بزيارة مكتب الموارد البشرية (مبنى 2) أو اتصل بالخط الساخن 19319.',
    'auth_otp_title': 'أدخل رمز التحقق',
    'auth_otp_sent_to': 'أرسلنا رمزاً من 6 أرقام إلى',
    'auth_registered_phone': 'رقمك المسجل',
    'auth_id_not_found':
        'الرقم القومي غير مسجل في قاعدة بيانات العاملين. يرجى مراجعة إدارة الموارد البشرية.',
    'auth_auto_verify': 'يتم التحقق تلقائياً عند الاكتمال',
    'auth_resend_in': 'إعادة الإرسال بعد',
    'auth_resend_now': 'إعادة إرسال الرمز الآن',
    'auth_code_resent': 'تم إرسال رمز جديد إلى هاتفك.',
    'auth_no_code_help': 'لم يصلك الرمز؟ احصل على مساعدة',
    'auth_otp_help_body':
        'تأكد من توفر الشبكة وحاول إعادة إرسال الرمز. إذا لم يصل، اتصل بخدمة الدعم الفني على تحويلة 4022.',
    'auth_create_pin_title': 'أنشئ الرمز السري',
    'auth_create_pin_subtitle':
        'ستستخدمه لتسجيل الدخول وفتح مفردات المرتب',
    'auth_confirm_pin_title': 'أكد الرمز السري',
    'auth_confirm_pin_subtitle': 'أدخل نفس الرمز مرة أخرى للتأكيد',
    'auth_pin_mismatch': 'الرمزان غير متطابقين. حاول مرة أخرى.',
    'auth_wrong_pin': 'رمز خاطئ. حاول مرة أخرى.',
    'auth_wrong_code': 'رمز خاطئ. حاول مرة أخرى.',
    'auth_locked': 'محاولات كتير خاطئة. حاول مرة أخرى بعد {minutes} دقيقة.',
    'auth_dev_code': 'رمز التجربة:',
    'auth_unlock_title': 'مرحباً بعودتك',
    'auth_unlock_subtitle': 'أدخل رمزك السري المكوّن من 4 أرقام لفتح التطبيق',
    'auth_forgot_pin': 'نسيت الرمز السري؟',
    'auth_forgot_body':
        'إعادة تعيين الرمز ستخرجك من التطبيق وتمسح البيانات المحلية على هذا الجهاز. ستحتاج للتحقق من رقمك القومي مرة أخرى.',
    'auth_get_started': 'ابدأ الآن',
    'auth_get_started_subtitle':
        'تطبيقك الواحد للورديات والمرتبات والطلبات ومزايا الشركة.',

    // Profile confirmation
    'confirm_profile_title': 'وجدنا ملفك الشخصي',
    'confirm_profile_subtitle': 'يرجى تأكيد أن هذه البيانات خاصة بك',
    'confirm_profile_name': 'الاسم الكامل',
    'confirm_profile_employee_id': 'رقم الموظف',
    'confirm_profile_factory': 'المصنع',
    'confirm_profile_department': 'القسم',
    'confirm_profile_yes': 'نعم، هذا أنا',
    'confirm_profile_no': 'لا، هذا ليس أنا',

    // Change PIN
    'change_pin_step_current_title': 'أدخل الرمز الحالي',
    'change_pin_step_current_subtitle': 'أدخل رمزك السري الحالي المكوّن من 4 أرقام',
    'change_pin_step_new_title': 'أنشئ رمزاً جديداً',
    'change_pin_step_new_subtitle': 'اختر رمزاً سرياً جديداً من 4 أرقام لحسابك',
    'change_pin_step_confirm_title': 'أكد الرمز الجديد',
    'change_pin_step_confirm_subtitle': 'أدخل الرمز الجديد مرة أخرى',
    'change_pin_wrong_current': 'رمز خاطئ. أدخل رمزك الحالي مرة أخرى.',
    'change_pin_success': 'تم تغيير الرمز السري بنجاح!',

    // Inbox
    'inbox_title': 'الوارد',
    'inbox_mark_all_read': 'تحديد الكل كمقروء',
    'inbox_filter_all': 'الكل',
    'inbox_filter_announcements': 'الإعلانات',
    'inbox_filter_approvals': 'الموافقات',
    'inbox_filter_benefits': 'المزايا',

    // Settings / Help
    'settings_title': 'الإعدادات',
    'settings_fingerprint': 'الدخول بالبصمة',
    'settings_fingerprint_sub': 'استخدم البصمة بدلاً من الرمز السري',
    'settings_salary_protection': 'حماية مفردات المرتب',
    'settings_salary_protection_sub': 'طلب الرمز السري لفتح مستندات المرتب',
    'settings_notifications': 'الإشعارات',
    'settings_notifications_sub': 'الإعلانات والموافقات والورديات',
    'settings_about': 'عن التطبيق',
    'settings_help': 'المساعدة والدعم',
    'help_subtitle': 'نحن هنا من أجلك — تواصل معنا في أي وقت.',
    'help_hotline': 'الخط الساخن للموارد البشرية',
    'help_whatsapp': 'واتساب الموارد البشرية',
    'help_it': 'الدعم الفني',
    'help_clinic': 'العيادة الطارئة',
    'help_hotline_value': '19319',
    'help_it_value': 'تحويلة 4022',
    'help_clinic_value': '107',
    'help_open_hr_form': 'افتح نموذج طلب HR',

    // Employee data
    'emp_data_title': 'بيانات الموظف',
    'emp_personal_info': 'البيانات الشخصية',
    'emp_work_info': 'بيانات العمل',
    'emp_name': 'الاسم الكامل',
    'emp_code': 'رقم الموظف',
    'emp_phone': 'رقم الهاتف',
    'emp_address': 'العنوان',
    'emp_emergency': 'جهة اتصال للطوارئ',
    'emp_position': 'الوظيفة',
    'emp_supervisor': 'المشرف المباشر',
    'emp_edit_title': 'تعديل البيانات',
    'emp_edit_note': 'سيتم إرسال تعديلات البيانات الشخصية إلى الموارد البشرية للمراجعة.',
    'emp_saved': 'تم تحديث البيانات بنجاح.',
    'emp_relationship': 'صلة القرابة',
    'emp_hr_only': 'بعض البيانات لا يمكن تعديلها إلا من قبل الموارد البشرية.',

    // Leave request
    'leave_type': 'نوع الإجازة',
    'leave_type_annual_leave': 'إجازة سنوية',
    'leave_type_sick_leave': 'إجازة مرضية',
    'leave_type_emergency_leave': 'إجازة اضطرارية',
    'leave_type_unpaid_leave': 'إجازة بدون مرتب',
    'leave_from': 'من',
    'leave_to': 'إلى',
    'leave_notes': 'ملاحظات (اختياري)',
    'leave_notes_hint': 'أضف أي تفاصيل لمديرك...',
    'leave_estimated_duration': 'المدة المتوقعة',
    'leave_exceeds_balance': 'تتجاوز الرصيد',
    'leave_submit': 'إرسال الطلب',
    'leave_success': 'تم إرسال طلب الإجازة بنجاح!',
    'leave_waiting_approval': 'بانتظار: موافقة مدير الخط',
    'leave_line_manager': 'مدير الخط (محمد حسن)',
    'leave_detail_duration': 'المدة',
    'leave_detail_dates': 'التواريخ',
    'leave_detail_type': 'النوع',
    'leave_detail_submitted': 'تاريخ الإرسال',
    'time_just_now': 'الآن',
    'vac_days_available': 'يوم متاح',
    'vac_days_unit': 'يوم',
    'vac_left_suffix': 'متبقٍ',
    'vac_total_available': 'إجمالي المتاح',
    'vac_days_remaining': 'يوم متبقٍ',
    'vac_annual': 'سنوية',
    'vac_sick': 'مرضية',
    'vac_emergency': 'اضطرارية',
    'vac_history': 'السجل',

    // Concern
    'concern_success': 'تم إرسال الشكوى بشكل مجهول. شكراً لك.',

    // Salary slip
    'slip_paid_on': 'تم الدفع في',
    'slip_breakdown_title': 'المستحقات والاستقطاعات',
    'slip_basic': 'الراتب الأساسي',
    'slip_allowances': 'البدلات',
    'slip_allowances_sub': 'سكن ومواصلات',
    'slip_deductions': 'الاستقطاعات',
    'slip_deductions_sub': 'ضرائب وتأمينات',
    'slip_total': 'إجمالي الصافي',
    'slip_download': 'تحميل PDF',
    'slip_shared': 'ملف قسيمة المرتب جاهز للمشاركة.',
    'slip_share_failed': 'تعذر إنشاء ملف PDF. حاول مرة أخرى.',
    'slip_enter_pin': 'أدخل رمزك السري لعرض مستندات المرتب.',

    // Services hub
    'svc_salary_subtitle': 'يوليو — متاح الآن',
    'svc_shift_subtitle': '7ص – 3م اليوم',
    'svc_days_remaining': 'يوم متبقٍ',
    'svc_pending': 'قيد الانتظار',
    'svc_hr_subtitle': 'مستندات، خطابات، إلخ.',
    'svc_concern_subtitle': 'مجهول الهوية',
    'svc_view_profile': 'عرض وتحديث الملف',

    // Shift schedule
    'shift_week_of': 'أسبوع',
    'shift_confirmed': 'مؤكدة',
    'shift_rest_day': 'يوم راحة',

    // Home
    'welcome_prefix': 'مرحباً،',

    // Benefits
    'ben_subtitle': 'مزايا وخصومات حصرية',
    'ben_cat_featured': 'مميزة',
    'ben_cat_supermarkets': 'السوبر ماركت',
    'ben_cat_health': 'الرعاية الصحية',
    'ben_section_perks': 'مزايا حصرية',
    'ben_section_trips': 'رحلات الشركة',
    'ben_section_expiring': 'تنتهي قريباً',
    'ben_show_id': 'اعرض بطاقة الموظف',
    'ben_employee_id': 'بطاقة الموظف',
    'ben_id_note': 'اعرض هذه البطاقة في المتجر المشارك للحصول على الخصم.',

    // Trips
    'trip_details': 'تفاصيل رحلة الشركة',
    'trip_confirmed': 'تم تأكيد مقعدك! تابع صندوق الوارد لتعليمات الرحلة.',
    'trip_cancelled': 'تم إلغاء حجز الرحلة.',

    // Inbox
    'inbox_marked_all': 'تم تحديد جميع الإشعارات كمقروءة',
    'inbox_from_hr': 'من الموارد البشرية',

    // Help actions
    'help_direct_channels': 'قنوات التواصل المباشر',
    'help_formal_inquiry': 'تحتاج مستند رسمي أو استفسار رسمي؟',
    'help_track_request':
        'أرسل طلب HR مباشرة من التطبيق وتابع حالة الموافقة لحظة بلحظة.',
    'help_call_now': 'اتصل الآن',
    'help_open_chat': 'افتح المحادثة',
    'help_call_it': 'اتصل بالدعم',
    'help_emergency_call': 'اتصال طارئ',
    'help_cannot_open': 'لا يوجد تطبيق لفتح هذا الرابط',


    // Announcement detail (policy article)
    'ann_detail_badge': 'تحديث سياسة',
    'ann_detail_published': 'نُشر في 01 أغسطس 2026 • عمليات الموارد البشرية',
    'ann_detail_overview_title': 'نظرة عامة على السياسة',
    'ann_detail_overview_body':
        'لتعزيز الكفاءة التشغيلية ورفاهية العاملين في مصانعنا بالعاشر من رمضان وبنها، تنتقل مجموعة العرابي إلى سياسة ورديات متناوبة محدّثة بدءاً من يوم الاثنين 10 أغسطس 2026.',
    'ann_detail_schedules_title': 'جداول الورديات المحدّثة',
    'shift_name_morning': 'الوردية الصباحية',
    'shift_name_evening': 'الوردية المسائية',
    'shift_name_night': 'الوردية الليلية',
    'ann_detail_guidelines_title': 'أهم الإرشادات والتغييرات',
    'ann_guide_break_t': 'أوقات الراحة',
    'ann_guide_break_d': 'استراحة غداء 45 دقيقة واستراحة راحة 15 دقيقة لكل وردية.',
    'ann_guide_bus_t': 'أتوبيسات النقل',
    'ann_guide_bus_d': 'جميع خطوط ومواعيد أتوبيسات الشركة ستتزامن قبل بدء الورديات بـ 30 دقيقة.',
    'ann_guide_ot_t': 'الإضافي والبدلات',
    'ann_guide_ot_d': 'ستزيد بدلات الوردية الليلية بنسبة 15% اعتباراً من أول دورة رواتب.',
    'ann_contact_btn': 'عندك سؤال؟ تواصل مع المشرف',
    'ann_contact_sent': 'تم إشعار ممثل الموارد البشرية.',

    // News demo articles
    'news_read': 'اقرأ المقال',
    'news_demo1_title': 'منشآت تصنيعية جديدة لزيادة الطاقة الإنتاجية',
    'news_demo1_cat': 'توسع',
    'news_demo1_body':
        'تعلن مجموعة العرابي عن افتتاح خطي إنتاج حديثين في المنطقة الصناعية بالعاشر من رمضان، بما يوفر أكثر من 600 وظيفة فنية متخصصة ويعزز القدرة التصديرية في منطقة الشرق الأوسط وشمال أفريقيا.',
    'news_demo2_title': 'إعلان الفائزين بجائزة التميز في السلامة للربع الثاني',
    'news_demo2_cat': 'السلامة والجودة',
    'news_demo2_body':
        'حقق خط الإنتاج أ في بنها 180 يوم عمل متواصلاً دون حوادث. وتثمن الإدارة التفاني والالتزام الصارم بإرشادات السلامة في بيئة العمل.',
    'news_demo3_title': 'الأسبوع الصحي والبدني يبدأ هذا الأحد',
    'news_demo3_cat': 'رفاهية الموظفين',
    'news_demo3_body':
        'الفحوصات الطبية الشاملة المجانية وفحوصات النظر والاستشارات الغذائية متاحة لجميع عمال المصانع في المراكز الطبية من 9 صباحاً حتى 4 عصراً.',
    'news_demo4_title': 'الاجتماع الرباعي المفتوح مع قيادة المجموعة',
    'news_demo4_cat': 'القيادة',
    'news_demo4_body':
        'استعرضت قيادة مجموعة العرابي أبرز الإنجازات التشغيلية وشاركت خارطة الطريق الاستراتيجية للتصنيع المستدام وخفض الطاقة والتحول الرقمي.',

    // Benefit detail
    'ben_valid_branches': 'صالح في جميع الفروع',
    'ben_redeem_title': 'طريقة الاستخدام',
    'ben_redeem_body': 'ما عليك سوى إظهار بطاقة الموظف أو الرقم القومي عند الدفع للاستمتاع بالخصم.',
    'ben_terms_title': 'الشروط والاستثناءات',
    'ben_terms_1': 'لا ينطبق على أصناف عليها خصم مسبق',
    'ben_terms_2': 'يُسمح باستخدامه مرة واحدة في الزيارة',
    'ben_terms_3': 'لا يمكن الدمج مع عروض أخرى.',
    'ben_about_title': 'عن العرض',
    'ben_default_desc':
        'سلسلة متاجر رائدة تقدم تشكيلة واسعة من الخضروات الطازجة والبقالة والأدوات المنزلية بأسعار تنافسية لموظفي العرابي.',
    'ben_report_issue': 'تواجه مشكلة في هذه الميزة؟ أبلغ عنها',

    // Trip detail
    'trip_subsidized_badge': 'دعم من الشركة 60%',
    'trip_seats_filled': 'من المقاعد محجوزة',
    'trip_seats_left': 'متبقٍ',
    'trip_inclusions_title': 'ماذا تشمل الرحلة',
    'trip_inc_1': 'أتوبيسات شركة مكيفة ذهاب وعودة',
    'trip_inc_2': 'دخول خاص للشاطئ والمسبح طوال اليوم',
    'trip_inc_3': 'بوفيه مفتوح للغداء ومشروبات منعشة',
    'trip_inc_4': 'ألعاب وأنشطة بناء الفريق',
    'trip_inc_5': 'تغطية طبية وأمنية كاملة في الموقع',
    'trip_itinerary_title': 'برنامج اليوم',
    'trip_step1_t': 'التجمع والانطلاق',
    'trip_step1_d': 'المكان: بوابة 1 - مصنع العاشر من رمضان',
    'trip_step2_t': 'الوصول والاستقبال',
    'trip_step2_d': 'مشروبات ترحيبية وتوزيع غرف المنتجع',
    'trip_step3_t': 'بوفيه الغداء',
    'trip_step3_d': 'بوفيه مفتوح في المطعم الرئيسي على البحر',
    'trip_step4_t': 'جلسة الغروب',
    'trip_step4_d': 'شاي وموسيقى وجلسة تصوير جماعي',
    'trip_step5_t': 'رحلة العودة',
    'trip_step5_d': 'الأتوبيسات تعود إلى العاشر من رمضان والقاهرة',
    'trip_book_now': 'احجز مقعدك الآن',
    'trip_cancel_booking': 'إلغاء الحجز',

    // Biometrics
    'biometric_prompt': 'افتح Elaraby Connect',
    'biometric_button': 'الدخول بالبصمة',
    'biometric_failed': 'فشل التحقق بالبصمة — استخدم رمزك السري.',
    'biometric_not_setup': 'البصمة غير مُعدّة على هذا الجهاز. استخدم الرمز السري.',

    // Settings sections
    'settings_security': 'الأمان والوصول السريع',
    'settings_notifications_header': 'الإشعارات',
  };
}