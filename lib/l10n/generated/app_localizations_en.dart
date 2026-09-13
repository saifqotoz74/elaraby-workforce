import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get ann_contact_btn => 'Have Questions? Contact Supervisor';

  @override
  String get ann_contact_sent => 'HR representative has been notified.';

  @override
  String get ann_detail_badge => 'POLICY UPDATE';

  @override
  String get ann_detail_guidelines_title => 'Key Guidelines & Changes';

  @override
  String get ann_detail_overview_body => 'To enhance operational efficiency and workforce well-being across our manufacturing facilities in 10th of Ramadan and Benha, Elaraby Group is transitioning to an updated rotational shift policy starting Monday, August 10, 2026.';

  @override
  String get ann_detail_overview_title => 'Policy Overview';

  @override
  String get ann_detail_published => 'Published 01 Aug 2026 • HR Operations';

  @override
  String get ann_detail_schedules_title => 'Updated Shift Schedules';

  @override
  String get ann_guide_break_d => '45-minute lunch break and one 15-minute rest break per shift.';

  @override
  String get ann_guide_break_t => 'Break Times';

  @override
  String get ann_guide_bus_d => 'All company bus routes and timing will synchronize 30 minutes before shifts start.';

  @override
  String get ann_guide_bus_t => 'Transportation Buses';

  @override
  String get ann_guide_ot_d => 'Shift allowances for night shifts will increase by 15% effective from the first pay cycle.';

  @override
  String get ann_guide_ot_t => 'Overtime & Allowances';

  @override
  String get announcement_badge => 'Important Announcement';

  @override
  String get announcement_title => 'New Shift Policy Starting\nfrom 10 August 2026';

  @override
  String get auth_auto_verify => 'Auto-verifies once complete';

  @override
  String get auth_code_resent => 'A new code has been sent to your phone.';

  @override
  String get auth_confirm_pin_subtitle => 'Enter the same PIN again to confirm';

  @override
  String get auth_confirm_pin_title => 'Confirm your PIN';

  @override
  String get auth_continue => 'Continue';

  @override
  String get auth_create_pin_subtitle => 'You\'ll use this to log in and to unlock your salary slip';

  @override
  String get auth_create_pin_title => 'Create your PIN';

  @override
  String get auth_dev_code => 'Testing code:';

  @override
  String get auth_forgot_body => 'Resetting your PIN will sign you out and clear local data on this device. You will need to verify your National ID again.';

  @override
  String get auth_forgot_pin => 'Forgot your PIN?';

  @override
  String get auth_get_help_id => 'Can\'t find your ID? Get help';

  @override
  String get auth_get_started => 'Get Started';

  @override
  String get auth_get_started_subtitle => 'Your one app for shifts, salary, requests and company benefits.';

  @override
  String get auth_id_help_body => 'Your National ID number is printed on the front of your ID card. If you still cannot find it, visit the HR office (Building 2) or call the hotline 19319.';

  @override
  String get auth_id_not_found => 'National ID not found in workforce database. Please contact HR office.';

  @override
  String auth_locked(String minutes) {
    return 'Too many wrong attempts. Try again in $minutes minutes.';
  }

  @override
  String auth_locked_minutes(num minutes) {
    final intl.NumberFormat minutesNumberFormat = intl.NumberFormat.compact(
      locale: localeName,
      
    );
    final String minutesString = minutesNumberFormat.format(minutes);

    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: 'Too many wrong attempts. Try again in $minutesString minutes.',
      one: 'Too many wrong attempts. Try again in 1 minute.',
    );
    return '$_temp0';
  }

  @override
  String get auth_national_id_subtitle => 'Enter your 14–digit National ID number to locate your profile';

  @override
  String get auth_national_id_title => 'Enter your National ID';

  @override
  String get auth_no_code_help => 'Didn\'t get a code? Get help';

  @override
  String get auth_of => 'of';

  @override
  String get auth_otp_help_body => 'Make sure you have network coverage and try resending the code. If it still does not arrive, call the IT help desk on extension 4022.';

  @override
  String get auth_otp_sent_to => 'We sent a 6–digit code to';

  @override
  String get auth_otp_title => 'Enter verification code';

  @override
  String get auth_pin_mismatch => 'PINs do not match. Please try again.';

  @override
  String get auth_registered_phone => 'your registered phone';

  @override
  String get auth_resend_in => 'Resend code in';

  @override
  String get auth_resend_now => 'Resend code now';

  @override
  String get auth_switch_employee => 'Log in as another employee';

  @override
  String get auth_switch_employee_confirm => 'Are you sure you want to log in as another employee? This will clear active session and local data on this device.';

  @override
  String get auth_unlock_subtitle => 'Enter your 4-digit PIN to unlock the app';

  @override
  String get auth_unlock_title => 'Welcome back';

  @override
  String get auth_wrong_code => 'Wrong code. Please try again.';

  @override
  String get auth_wrong_pin => 'Wrong PIN. Please try again.';

  @override
  String get ben_about_title => 'About';

  @override
  String get ben_cat_featured => 'Featured';

  @override
  String get ben_cat_health => 'Health Care';

  @override
  String get ben_cat_supermarkets => 'Supermarkets';

  @override
  String get ben_default_desc => 'A leading retail chain offering a wide selection of fresh produce, groceries, and household items at competitive prices for Elaraby employees.';

  @override
  String get ben_employee_id => 'Employee ID';

  @override
  String get ben_id_note => 'Show this card at the participating store to claim your discount.';

  @override
  String get ben_redeem_body => 'Simply present your Employee ID or National ID at checkout to enjoy your discount.';

  @override
  String get ben_redeem_title => 'How to Redeem';

  @override
  String get ben_report_issue => 'Having trouble with this perk? Report an issue';

  @override
  String get ben_section_expiring => 'Expiring Soon';

  @override
  String get ben_section_perks => 'Exclusive Perks';

  @override
  String get ben_section_trips => 'Company Trips';

  @override
  String get ben_show_id => 'Show Employee ID';

  @override
  String get ben_subtitle => 'Exclusive perks and discounts';

  @override
  String get ben_terms_1 => 'Not valid on already-discounted items';

  @override
  String get ben_terms_2 => 'Limited to one use per visit';

  @override
  String get ben_terms_3 => 'Cannot be combined with other offers.';

  @override
  String get ben_terms_title => 'Terms & Exclusions';

  @override
  String get ben_valid_branches => 'Valid at all branches';

  @override
  String get biometric_button => 'Unlock with fingerprint';

  @override
  String get biometric_failed => 'Biometric authentication failed — use your PIN.';

  @override
  String get biometric_not_setup => 'Fingerprint is not set up on this device. Use your PIN.';

  @override
  String get biometric_prompt => 'Unlock Elaraby Connect';

  @override
  String get change_pin_step_confirm_subtitle => 'Enter the new 4-digit PIN once again';

  @override
  String get change_pin_step_confirm_title => 'Confirm New PIN';

  @override
  String get change_pin_step_current_subtitle => 'Please enter your existing 4-digit security PIN';

  @override
  String get change_pin_step_current_title => 'Enter Current PIN';

  @override
  String get change_pin_step_new_subtitle => 'Choose a new 4-digit PIN for your account';

  @override
  String get change_pin_step_new_title => 'Create New PIN';

  @override
  String get change_pin_success => 'PIN successfully changed!';

  @override
  String get change_pin_wrong_current => 'Wrong PIN. Please enter your current PIN again.';

  @override
  String get common_cancel => 'Cancel';

  @override
  String get common_edit => 'Edit';

  @override
  String get common_ok => 'OK';

  @override
  String get common_questions => 'Common Questions';

  @override
  String get common_save => 'Save';

  @override
  String get common_save_changes => 'Save Changes';

  @override
  String get common_submit => 'Submit';

  @override
  String get company_news => 'Company News';

  @override
  String get concern_success => 'Concern submitted anonymously. Thank you.';

  @override
  String get confirm_profile_department => 'Department';

  @override
  String get confirm_profile_employee_id => 'Employee ID';

  @override
  String get confirm_profile_factory => 'Factory';

  @override
  String get confirm_profile_name => 'Full Name';

  @override
  String get confirm_profile_no => 'No, this isn\'t me';

  @override
  String get confirm_profile_subtitle => 'Please confirm these details are yours';

  @override
  String get confirm_profile_title => 'We found your profile';

  @override
  String get confirm_profile_yes => 'Yes, this is me';

  @override
  String get current_language_name => 'English';

  @override
  String get date_today => 'Sunday, 02 August';

  @override
  String get dept_label => 'Department';

  @override
  String get dept_value => 'Production A';

  @override
  String get emp_address => 'Address';

  @override
  String get emp_code => 'Employee ID';

  @override
  String get emp_data_title => 'Employee Data';

  @override
  String get emp_edit_note => 'Changes to personal information will be submitted to HR for review.';

  @override
  String get emp_edit_title => 'Edit Information';

  @override
  String get emp_emergency => 'Emergency Contact';

  @override
  String get emp_hr_only => 'Some information can only be updated by HR.';

  @override
  String get emp_name => 'Full Name';

  @override
  String get emp_personal_info => 'Personal Information';

  @override
  String get emp_phone => 'Phone Number';

  @override
  String get emp_position => 'Position';

  @override
  String get emp_relationship => 'Relationship';

  @override
  String get emp_saved => 'Information updated successfully.';

  @override
  String get emp_saved_offline => 'Changes saved locally (will sync when online)';

  @override
  String get emp_supervisor => 'Direct Supervisor';

  @override
  String get emp_work_info => 'Work Information';

  @override
  String get employee_data => 'Employee Data';

  @override
  String get factory_label => 'Factory';

  @override
  String get factory_value => '10th of Ramadan';

  @override
  String get help_call_it => 'Call IT';

  @override
  String get help_call_now => 'Call Now';

  @override
  String get help_cannot_open => 'No app found to open this link';

  @override
  String get help_clinic => 'Emergency Clinic';

  @override
  String get help_clinic_value => '107';

  @override
  String get help_direct_channels => 'Direct Channels';

  @override
  String get help_emergency_call => 'Emergency Call';

  @override
  String get help_formal_inquiry => 'Need official documentation or a formal inquiry?';

  @override
  String get help_hotline => 'HR Hotline';

  @override
  String get help_hotline_value => '19319';

  @override
  String get help_it => 'IT Help Desk';

  @override
  String get help_it_value => 'Ext. 4022';

  @override
  String get help_open_chat => 'Open Chat';

  @override
  String get help_open_hr_form => 'Open HR Request Form';

  @override
  String get help_subtitle => 'We are here for you — reach out any time.';

  @override
  String get help_title => 'Need Help?';

  @override
  String get help_track_request => 'Submit an HR request directly through the app and track its approval status in real-time.';

  @override
  String get help_whatsapp => 'WhatsApp HR';

  @override
  String get hr_request => 'HR Request';

  @override
  String get inbox_filter_all => 'All';

  @override
  String get inbox_filter_announcements => 'Announcements';

  @override
  String get inbox_filter_approvals => 'Approvals';

  @override
  String get inbox_filter_benefits => 'Benefits';

  @override
  String get inbox_from_hr => 'From HR';

  @override
  String get inbox_mark_all_read => 'Mark all as read';

  @override
  String get inbox_marked_all => 'All notifications marked as read';

  @override
  String get inbox_title => 'Inbox';

  @override
  String get leave_detail_dates => 'Dates';

  @override
  String get leave_detail_duration => 'Duration';

  @override
  String get leave_detail_submitted => 'Submitted';

  @override
  String get leave_detail_type => 'Type';

  @override
  String get leave_discard_confirm => 'Discard';

  @override
  String get leave_discard_message => 'You have unsaved changes in your leave request. Are you sure you want to exit and lose them?';

  @override
  String get leave_discard_stay => 'Stay';

  @override
  String get leave_discard_title => 'Discard changes?';

  @override
  String get leave_estimated_duration => 'Estimated Duration';

  @override
  String get leave_exceeds_balance => 'Exceeds balance';

  @override
  String get leave_from => 'From';

  @override
  String get leave_line_manager => 'Line Manager (Mohamed Hassan)';

  @override
  String get leave_notes => 'Notes (Optional)';

  @override
  String get leave_notes_hint => 'Add any details for your manager...';

  @override
  String get leave_request_failed => 'Failed to submit leave request. Please try again.';

  @override
  String get leave_request_submitted => 'Leave request submitted successfully';

  @override
  String get leave_submit => 'Submit Request';

  @override
  String get leave_success => 'Leave request submitted successfully!';

  @override
  String get leave_to => 'To';

  @override
  String get leave_type => 'Leave Type';

  @override
  String get leave_type_annual_leave => 'Annual Leave';

  @override
  String get leave_type_emergency_leave => 'Emergency Leave';

  @override
  String get leave_type_sick_leave => 'Sick Leave';

  @override
  String get leave_type_unpaid_leave => 'Unpaid Leave';

  @override
  String get leave_waiting_approval => 'Waiting on: Line Manager Approval';

  @override
  String get menu_change_pin => 'Change PIN';

  @override
  String get menu_language => 'Language';

  @override
  String get menu_logout => 'Logout';

  @override
  String get menu_settings => 'Settings';

  @override
  String get my_info => 'My Info';

  @override
  String get nav_benefits => 'Benefits';

  @override
  String get nav_home => 'Home';

  @override
  String get nav_inbox => 'Inbox';

  @override
  String get nav_profile => 'Profile';

  @override
  String get nav_services => 'Services';

  @override
  String get network_offline_warning => 'You are currently offline. Changes will sync automatically.';

  @override
  String get new_announcement => 'New Announcement';

  @override
  String get news_demo1_body => 'Elaraby Group announces the opening of two state-of-the-art production lines in 10th of Ramadan Industrial Zone, creating over 600 new specialized technical jobs and boosting export capabilities across the MENA region.';

  @override
  String get news_demo1_cat => 'Expansion';

  @override
  String get news_demo1_title => 'New Manufacturing Facilities to Increase Production Capacity';

  @override
  String get news_demo2_body => 'Production Line A in Benha has achieved 180 continuous days with zero incidents. Management commends the dedication and strict adherence to workplace safety guidelines.';

  @override
  String get news_demo2_cat => 'Safety & Quality';

  @override
  String get news_demo2_title => 'Annual Safety Excellence Award Winners Announced for Q2';

  @override
  String get news_demo3_body => 'Free comprehensive medical examinations, eye checkups, and nutritional counseling will be available to all factory workers across clinic centers from 9 AM to 4 PM.';

  @override
  String get news_demo3_cat => 'Employee Well-being';

  @override
  String get news_demo3_title => 'Healthcare & Wellness Week Starting This Sunday';

  @override
  String get news_demo4_body => 'Elaraby Group leadership reviewed our key operational milestones and shared the strategic roadmap for sustainable manufacturing, energy reduction, and digital transformation.';

  @override
  String get news_demo4_cat => 'Leadership';

  @override
  String get news_demo4_title => 'Quarterly Town Hall Meeting with Group Leadership';

  @override
  String get news_read => 'Read Article';

  @override
  String get pay_and_time => 'Pay & Time';

  @override
  String get profile_title => 'Profile';

  @override
  String get qa_benefits => 'Benefits';

  @override
  String get qa_salary => 'Salary';

  @override
  String get qa_shift => 'Shift';

  @override
  String get qa_support => 'Support';

  @override
  String get qa_trips => 'Trips';

  @override
  String get qa_vacation => 'Vacation';

  @override
  String get quick_actions => 'Quick Actions';

  @override
  String get quick_survey => 'Quick Survey';

  @override
  String get raise_concern => 'Raise a Concern';

  @override
  String get read_now => 'Read Now';

  @override
  String get request_leave => 'Request Leave';

  @override
  String get requests_section => 'Requests';

  @override
  String get return_home => 'Return to Home';

  @override
  String get route_not_found => 'Page Not Found';

  @override
  String get route_not_found_desc => 'The requested page could not be found.';

  @override
  String get salary_label => 'Salary';

  @override
  String get salary_slip => 'Salary Slip';

  @override
  String get salary_status => 'Available';

  @override
  String get services_subtitle => 'Everything you need in one place.';

  @override
  String get services_title => 'Services';

  @override
  String get settings_about => 'About App';

  @override
  String get settings_fingerprint => 'Fingerprint Login';

  @override
  String get settings_fingerprint_sub => 'Use biometrics instead of your PIN';

  @override
  String get settings_help => 'Help & Support';

  @override
  String get settings_notifications => 'Push Notifications';

  @override
  String get settings_notifications_header => 'Notification';

  @override
  String get settings_notifications_sub => 'Announcements, approvals and shifts';

  @override
  String get settings_salary_protection => 'Salary Slip Protection';

  @override
  String get settings_salary_protection_sub => 'Require PIN to open salary documents';

  @override
  String get settings_security => 'Security & Fast Access';

  @override
  String get settings_title => 'Settings';

  @override
  String get shift_confirmed => 'Confirmed';

  @override
  String get shift_line => 'Production line A';

  @override
  String get shift_name_evening => 'Evening Shift';

  @override
  String get shift_name_morning => 'Morning Shift';

  @override
  String get shift_name_night => 'Night Shift';

  @override
  String get shift_rest_day => 'Rest Day';

  @override
  String get shift_schedule => 'Shift Schedule';

  @override
  String get shift_time => '07:00 AM – 03:00 PM';

  @override
  String get shift_week_of => 'Week of';

  @override
  String get slip_allowances => 'Allowances';

  @override
  String get slip_allowances_sub => 'Housing & Transport';

  @override
  String get slip_basic => 'Basic Salary';

  @override
  String get slip_breakdown_title => 'Earnings & Deductions';

  @override
  String get slip_deductions => 'Deductions';

  @override
  String get slip_deductions_sub => 'Tax & Insurance';

  @override
  String get slip_download => 'Download PDF';

  @override
  String get slip_enter_pin => 'Enter your PIN to view salary documents.';

  @override
  String get slip_paid_on => 'Paid on';

  @override
  String get slip_share_failed => 'Could not generate the PDF. Please try again.';

  @override
  String get slip_shared => 'Salary slip PDF is ready to share.';

  @override
  String get slip_total => 'Total Net Pay';

  @override
  String get survey_question => 'Was it easy to find what you needed in the app?';

  @override
  String get svc_concern_subtitle => 'Anonymous';

  @override
  String get svc_days_remaining => 'days remaining';

  @override
  String get svc_hr_subtitle => 'Document, letter, etc.';

  @override
  String get svc_pending => 'PENDING';

  @override
  String get svc_salary_subtitle => 'July — available now';

  @override
  String get svc_shift_subtitle => '7am – 3pm today';

  @override
  String get svc_view_profile => 'View & update profile';

  @override
  String get time_just_now => 'Just now';

  @override
  String get todays_shift => 'Today\'s Shift';

  @override
  String get trip_book_now => 'Book Seat Now';

  @override
  String get trip_cancel_booking => 'Cancel Reservation';

  @override
  String get trip_cancelled => 'Trip reservation cancelled.';

  @override
  String get trip_confirmed => 'Seat confirmed! Check your Inbox for trip instructions.';

  @override
  String get trip_details => 'Company Trip Details';

  @override
  String get trip_inc_1 => 'Round-trip air-conditioned company buses';

  @override
  String get trip_inc_2 => 'Full-day private beach & pool access';

  @override
  String get trip_inc_3 => 'Open buffet lunch & refreshing soft drinks';

  @override
  String get trip_inc_4 => 'Organized team-building games & activities';

  @override
  String get trip_inc_5 => 'Full medical and safety coverage on-site';

  @override
  String get trip_inclusions_title => 'What\'s Included';

  @override
  String get trip_itinerary_title => 'Day Program';

  @override
  String get trip_seats_filled => 'of seats filled';

  @override
  String get trip_seats_left => 'left';

  @override
  String trip_seats_left_count(num count) {
    final intl.NumberFormat countNumberFormat = intl.NumberFormat.compact(
      locale: localeName,
      
    );
    final String countString = countNumberFormat.format(count);

    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countString seats left',
      one: '1 seat left',
      zero: 'No seats left',
    );
    return '$_temp0';
  }

  @override
  String get trip_step1_d => 'Meeting at 10th of Ramadan Factory Gate 1';

  @override
  String get trip_step1_t => 'Assembly & Departure';

  @override
  String get trip_step2_d => 'Welcome drinks and resort room allocations';

  @override
  String get trip_step2_t => 'Arrival & Welcome';

  @override
  String get trip_step3_d => 'Full open-buffet lunch at main seaside restaurant';

  @override
  String get trip_step3_t => 'Lunch Buffet';

  @override
  String get trip_step4_d => 'Tea, music, and group photography session';

  @override
  String get trip_step4_t => 'Sunset Gathering';

  @override
  String get trip_step5_d => 'Buses depart back to 10th of Ramadan & Cairo';

  @override
  String get trip_step5_t => 'Return Journey';

  @override
  String get trip_subsidized_badge => '60% COMPANY SUBSIDIZED';

  @override
  String get vac_annual => 'Annual';

  @override
  String get vac_days_available => 'Days Available';

  @override
  String get vac_days_remaining => 'Days Remaining';

  @override
  String get vac_days_unit => 'Days';

  @override
  String get vac_emergency => 'Emergency';

  @override
  String get vac_history => 'History';

  @override
  String get vac_left_suffix => 'Left';

  @override
  String get vac_sick => 'Sick';

  @override
  String get vac_total_available => 'Total Available';

  @override
  String get vacation_balance => 'Vacation Balance';

  @override
  String get vacation_days => '12 Days';

  @override
  String vacation_days_count(num count) {
    final intl.NumberFormat countNumberFormat = intl.NumberFormat.compact(
      locale: localeName,
      
    );
    final String countString = countNumberFormat.format(count);

    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countString Days',
      one: '1 Day',
      zero: '0 Days',
    );
    return '$_temp0';
  }

  @override
  String vacation_days_remaining_count(num count) {
    final intl.NumberFormat countNumberFormat = intl.NumberFormat.compact(
      locale: localeName,
      
    );
    final String countString = countNumberFormat.format(count);

    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countString days remaining',
      one: '1 day remaining',
      zero: '0 days remaining',
    );
    return '$_temp0';
  }

  @override
  String get vacation_left => 'Vacation Left';

  @override
  String get view_all => 'View All';

  @override
  String get welcome_prefix => 'Welcome,';

  @override
  String get welcome_user => 'Welcome, Ahmed';

  @override
  String get your_requests => 'Your Requests';
}
