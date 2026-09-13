import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale) : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates = <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en')
  ];

  /// No description provided for @ann_contact_btn.
  ///
  /// In en, this message translates to:
  /// **'Have Questions? Contact Supervisor'**
  String get ann_contact_btn;

  /// No description provided for @ann_contact_sent.
  ///
  /// In en, this message translates to:
  /// **'HR representative has been notified.'**
  String get ann_contact_sent;

  /// No description provided for @ann_detail_badge.
  ///
  /// In en, this message translates to:
  /// **'POLICY UPDATE'**
  String get ann_detail_badge;

  /// No description provided for @ann_detail_guidelines_title.
  ///
  /// In en, this message translates to:
  /// **'Key Guidelines & Changes'**
  String get ann_detail_guidelines_title;

  /// No description provided for @ann_detail_overview_body.
  ///
  /// In en, this message translates to:
  /// **'To enhance operational efficiency and workforce well-being across our manufacturing facilities in 10th of Ramadan and Benha, Elaraby Group is transitioning to an updated rotational shift policy starting Monday, August 10, 2026.'**
  String get ann_detail_overview_body;

  /// No description provided for @ann_detail_overview_title.
  ///
  /// In en, this message translates to:
  /// **'Policy Overview'**
  String get ann_detail_overview_title;

  /// No description provided for @ann_detail_published.
  ///
  /// In en, this message translates to:
  /// **'Published 01 Aug 2026 • HR Operations'**
  String get ann_detail_published;

  /// No description provided for @ann_detail_schedules_title.
  ///
  /// In en, this message translates to:
  /// **'Updated Shift Schedules'**
  String get ann_detail_schedules_title;

  /// No description provided for @ann_guide_break_d.
  ///
  /// In en, this message translates to:
  /// **'45-minute lunch break and one 15-minute rest break per shift.'**
  String get ann_guide_break_d;

  /// No description provided for @ann_guide_break_t.
  ///
  /// In en, this message translates to:
  /// **'Break Times'**
  String get ann_guide_break_t;

  /// No description provided for @ann_guide_bus_d.
  ///
  /// In en, this message translates to:
  /// **'All company bus routes and timing will synchronize 30 minutes before shifts start.'**
  String get ann_guide_bus_d;

  /// No description provided for @ann_guide_bus_t.
  ///
  /// In en, this message translates to:
  /// **'Transportation Buses'**
  String get ann_guide_bus_t;

  /// No description provided for @ann_guide_ot_d.
  ///
  /// In en, this message translates to:
  /// **'Shift allowances for night shifts will increase by 15% effective from the first pay cycle.'**
  String get ann_guide_ot_d;

  /// No description provided for @ann_guide_ot_t.
  ///
  /// In en, this message translates to:
  /// **'Overtime & Allowances'**
  String get ann_guide_ot_t;

  /// No description provided for @announcement_badge.
  ///
  /// In en, this message translates to:
  /// **'Important Announcement'**
  String get announcement_badge;

  /// No description provided for @announcement_title.
  ///
  /// In en, this message translates to:
  /// **'New Shift Policy Starting\nfrom 10 August 2026'**
  String get announcement_title;

  /// No description provided for @auth_auto_verify.
  ///
  /// In en, this message translates to:
  /// **'Auto-verifies once complete'**
  String get auth_auto_verify;

  /// No description provided for @auth_code_resent.
  ///
  /// In en, this message translates to:
  /// **'A new code has been sent to your phone.'**
  String get auth_code_resent;

  /// No description provided for @auth_confirm_pin_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the same PIN again to confirm'**
  String get auth_confirm_pin_subtitle;

  /// No description provided for @auth_confirm_pin_title.
  ///
  /// In en, this message translates to:
  /// **'Confirm your PIN'**
  String get auth_confirm_pin_title;

  /// No description provided for @auth_continue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get auth_continue;

  /// No description provided for @auth_create_pin_subtitle.
  ///
  /// In en, this message translates to:
  /// **'You\'ll use this to log in and to unlock your salary slip'**
  String get auth_create_pin_subtitle;

  /// No description provided for @auth_create_pin_title.
  ///
  /// In en, this message translates to:
  /// **'Create your PIN'**
  String get auth_create_pin_title;

  /// No description provided for @auth_dev_code.
  ///
  /// In en, this message translates to:
  /// **'Testing code:'**
  String get auth_dev_code;

  /// No description provided for @auth_forgot_body.
  ///
  /// In en, this message translates to:
  /// **'Resetting your PIN will sign you out and clear local data on this device. You will need to verify your National ID again.'**
  String get auth_forgot_body;

  /// No description provided for @auth_forgot_pin.
  ///
  /// In en, this message translates to:
  /// **'Forgot your PIN?'**
  String get auth_forgot_pin;

  /// No description provided for @auth_get_help_id.
  ///
  /// In en, this message translates to:
  /// **'Can\'t find your ID? Get help'**
  String get auth_get_help_id;

  /// No description provided for @auth_get_started.
  ///
  /// In en, this message translates to:
  /// **'Get Started'**
  String get auth_get_started;

  /// No description provided for @auth_get_started_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Your one app for shifts, salary, requests and company benefits.'**
  String get auth_get_started_subtitle;

  /// No description provided for @auth_id_help_body.
  ///
  /// In en, this message translates to:
  /// **'Your National ID number is printed on the front of your ID card. If you still cannot find it, visit the HR office (Building 2) or call the hotline 19319.'**
  String get auth_id_help_body;

  /// No description provided for @auth_id_not_found.
  ///
  /// In en, this message translates to:
  /// **'National ID not found in workforce database. Please contact HR office.'**
  String get auth_id_not_found;

  /// Lockout message
  ///
  /// In en, this message translates to:
  /// **'Too many wrong attempts. Try again in {minutes} minutes.'**
  String auth_locked(String minutes);

  /// Lockout message with plural minutes
  ///
  /// In en, this message translates to:
  /// **'{minutes, plural, =1{Too many wrong attempts. Try again in 1 minute.} other{Too many wrong attempts. Try again in {minutes} minutes.}}'**
  String auth_locked_minutes(num minutes);

  /// No description provided for @auth_national_id_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your 14–digit National ID number to locate your profile'**
  String get auth_national_id_subtitle;

  /// No description provided for @auth_national_id_title.
  ///
  /// In en, this message translates to:
  /// **'Enter your National ID'**
  String get auth_national_id_title;

  /// No description provided for @auth_no_code_help.
  ///
  /// In en, this message translates to:
  /// **'Didn\'t get a code? Get help'**
  String get auth_no_code_help;

  /// No description provided for @auth_of.
  ///
  /// In en, this message translates to:
  /// **'of'**
  String get auth_of;

  /// No description provided for @auth_otp_help_body.
  ///
  /// In en, this message translates to:
  /// **'Make sure you have network coverage and try resending the code. If it still does not arrive, call the IT help desk on extension 4022.'**
  String get auth_otp_help_body;

  /// No description provided for @auth_otp_sent_to.
  ///
  /// In en, this message translates to:
  /// **'We sent a 6–digit code to'**
  String get auth_otp_sent_to;

  /// No description provided for @auth_otp_title.
  ///
  /// In en, this message translates to:
  /// **'Enter verification code'**
  String get auth_otp_title;

  /// No description provided for @auth_pin_mismatch.
  ///
  /// In en, this message translates to:
  /// **'PINs do not match. Please try again.'**
  String get auth_pin_mismatch;

  /// No description provided for @auth_registered_phone.
  ///
  /// In en, this message translates to:
  /// **'your registered phone'**
  String get auth_registered_phone;

  /// No description provided for @auth_resend_in.
  ///
  /// In en, this message translates to:
  /// **'Resend code in'**
  String get auth_resend_in;

  /// No description provided for @auth_resend_now.
  ///
  /// In en, this message translates to:
  /// **'Resend code now'**
  String get auth_resend_now;

  /// No description provided for @auth_switch_employee.
  ///
  /// In en, this message translates to:
  /// **'Log in as another employee'**
  String get auth_switch_employee;

  /// No description provided for @auth_switch_employee_confirm.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to log in as another employee? This will clear active session and local data on this device.'**
  String get auth_switch_employee_confirm;

  /// No description provided for @auth_unlock_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your 4-digit PIN to unlock the app'**
  String get auth_unlock_subtitle;

  /// No description provided for @auth_unlock_title.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get auth_unlock_title;

  /// No description provided for @auth_wrong_code.
  ///
  /// In en, this message translates to:
  /// **'Wrong code. Please try again.'**
  String get auth_wrong_code;

  /// No description provided for @auth_wrong_pin.
  ///
  /// In en, this message translates to:
  /// **'Wrong PIN. Please try again.'**
  String get auth_wrong_pin;

  /// No description provided for @ben_about_title.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get ben_about_title;

  /// No description provided for @ben_cat_featured.
  ///
  /// In en, this message translates to:
  /// **'Featured'**
  String get ben_cat_featured;

  /// No description provided for @ben_cat_health.
  ///
  /// In en, this message translates to:
  /// **'Health Care'**
  String get ben_cat_health;

  /// No description provided for @ben_cat_supermarkets.
  ///
  /// In en, this message translates to:
  /// **'Supermarkets'**
  String get ben_cat_supermarkets;

  /// No description provided for @ben_default_desc.
  ///
  /// In en, this message translates to:
  /// **'A leading retail chain offering a wide selection of fresh produce, groceries, and household items at competitive prices for Elaraby employees.'**
  String get ben_default_desc;

  /// No description provided for @ben_employee_id.
  ///
  /// In en, this message translates to:
  /// **'Employee ID'**
  String get ben_employee_id;

  /// No description provided for @ben_id_note.
  ///
  /// In en, this message translates to:
  /// **'Show this card at the participating store to claim your discount.'**
  String get ben_id_note;

  /// No description provided for @ben_redeem_body.
  ///
  /// In en, this message translates to:
  /// **'Simply present your Employee ID or National ID at checkout to enjoy your discount.'**
  String get ben_redeem_body;

  /// No description provided for @ben_redeem_title.
  ///
  /// In en, this message translates to:
  /// **'How to Redeem'**
  String get ben_redeem_title;

  /// No description provided for @ben_report_issue.
  ///
  /// In en, this message translates to:
  /// **'Having trouble with this perk? Report an issue'**
  String get ben_report_issue;

  /// No description provided for @ben_section_expiring.
  ///
  /// In en, this message translates to:
  /// **'Expiring Soon'**
  String get ben_section_expiring;

  /// No description provided for @ben_section_perks.
  ///
  /// In en, this message translates to:
  /// **'Exclusive Perks'**
  String get ben_section_perks;

  /// No description provided for @ben_section_trips.
  ///
  /// In en, this message translates to:
  /// **'Company Trips'**
  String get ben_section_trips;

  /// No description provided for @ben_show_id.
  ///
  /// In en, this message translates to:
  /// **'Show Employee ID'**
  String get ben_show_id;

  /// No description provided for @ben_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Exclusive perks and discounts'**
  String get ben_subtitle;

  /// No description provided for @ben_terms_1.
  ///
  /// In en, this message translates to:
  /// **'Not valid on already-discounted items'**
  String get ben_terms_1;

  /// No description provided for @ben_terms_2.
  ///
  /// In en, this message translates to:
  /// **'Limited to one use per visit'**
  String get ben_terms_2;

  /// No description provided for @ben_terms_3.
  ///
  /// In en, this message translates to:
  /// **'Cannot be combined with other offers.'**
  String get ben_terms_3;

  /// No description provided for @ben_terms_title.
  ///
  /// In en, this message translates to:
  /// **'Terms & Exclusions'**
  String get ben_terms_title;

  /// No description provided for @ben_valid_branches.
  ///
  /// In en, this message translates to:
  /// **'Valid at all branches'**
  String get ben_valid_branches;

  /// No description provided for @biometric_button.
  ///
  /// In en, this message translates to:
  /// **'Unlock with fingerprint'**
  String get biometric_button;

  /// No description provided for @biometric_failed.
  ///
  /// In en, this message translates to:
  /// **'Biometric authentication failed — use your PIN.'**
  String get biometric_failed;

  /// No description provided for @biometric_not_setup.
  ///
  /// In en, this message translates to:
  /// **'Fingerprint is not set up on this device. Use your PIN.'**
  String get biometric_not_setup;

  /// No description provided for @biometric_prompt.
  ///
  /// In en, this message translates to:
  /// **'Unlock Elaraby Connect'**
  String get biometric_prompt;

  /// No description provided for @change_pin_step_confirm_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter the new 4-digit PIN once again'**
  String get change_pin_step_confirm_subtitle;

  /// No description provided for @change_pin_step_confirm_title.
  ///
  /// In en, this message translates to:
  /// **'Confirm New PIN'**
  String get change_pin_step_confirm_title;

  /// No description provided for @change_pin_step_current_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Please enter your existing 4-digit security PIN'**
  String get change_pin_step_current_subtitle;

  /// No description provided for @change_pin_step_current_title.
  ///
  /// In en, this message translates to:
  /// **'Enter Current PIN'**
  String get change_pin_step_current_title;

  /// No description provided for @change_pin_step_new_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose a new 4-digit PIN for your account'**
  String get change_pin_step_new_subtitle;

  /// No description provided for @change_pin_step_new_title.
  ///
  /// In en, this message translates to:
  /// **'Create New PIN'**
  String get change_pin_step_new_title;

  /// No description provided for @change_pin_success.
  ///
  /// In en, this message translates to:
  /// **'PIN successfully changed!'**
  String get change_pin_success;

  /// No description provided for @change_pin_wrong_current.
  ///
  /// In en, this message translates to:
  /// **'Wrong PIN. Please enter your current PIN again.'**
  String get change_pin_wrong_current;

  /// No description provided for @common_cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get common_cancel;

  /// No description provided for @common_edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get common_edit;

  /// No description provided for @common_ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get common_ok;

  /// No description provided for @common_questions.
  ///
  /// In en, this message translates to:
  /// **'Common Questions'**
  String get common_questions;

  /// No description provided for @common_save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get common_save;

  /// No description provided for @common_save_changes.
  ///
  /// In en, this message translates to:
  /// **'Save Changes'**
  String get common_save_changes;

  /// No description provided for @common_submit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get common_submit;

  /// No description provided for @company_news.
  ///
  /// In en, this message translates to:
  /// **'Company News'**
  String get company_news;

  /// No description provided for @concern_success.
  ///
  /// In en, this message translates to:
  /// **'Concern submitted anonymously. Thank you.'**
  String get concern_success;

  /// No description provided for @confirm_profile_department.
  ///
  /// In en, this message translates to:
  /// **'Department'**
  String get confirm_profile_department;

  /// No description provided for @confirm_profile_employee_id.
  ///
  /// In en, this message translates to:
  /// **'Employee ID'**
  String get confirm_profile_employee_id;

  /// No description provided for @confirm_profile_factory.
  ///
  /// In en, this message translates to:
  /// **'Factory'**
  String get confirm_profile_factory;

  /// No description provided for @confirm_profile_name.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get confirm_profile_name;

  /// No description provided for @confirm_profile_no.
  ///
  /// In en, this message translates to:
  /// **'No, this isn\'t me'**
  String get confirm_profile_no;

  /// No description provided for @confirm_profile_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Please confirm these details are yours'**
  String get confirm_profile_subtitle;

  /// No description provided for @confirm_profile_title.
  ///
  /// In en, this message translates to:
  /// **'We found your profile'**
  String get confirm_profile_title;

  /// No description provided for @confirm_profile_yes.
  ///
  /// In en, this message translates to:
  /// **'Yes, this is me'**
  String get confirm_profile_yes;

  /// No description provided for @current_language_name.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get current_language_name;

  /// No description provided for @date_today.
  ///
  /// In en, this message translates to:
  /// **'Sunday, 02 August'**
  String get date_today;

  /// No description provided for @dept_label.
  ///
  /// In en, this message translates to:
  /// **'Department'**
  String get dept_label;

  /// No description provided for @dept_value.
  ///
  /// In en, this message translates to:
  /// **'Production A'**
  String get dept_value;

  /// No description provided for @emp_address.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get emp_address;

  /// No description provided for @emp_code.
  ///
  /// In en, this message translates to:
  /// **'Employee ID'**
  String get emp_code;

  /// No description provided for @emp_data_title.
  ///
  /// In en, this message translates to:
  /// **'Employee Data'**
  String get emp_data_title;

  /// No description provided for @emp_edit_note.
  ///
  /// In en, this message translates to:
  /// **'Changes to personal information will be submitted to HR for review.'**
  String get emp_edit_note;

  /// No description provided for @emp_edit_title.
  ///
  /// In en, this message translates to:
  /// **'Edit Information'**
  String get emp_edit_title;

  /// No description provided for @emp_emergency.
  ///
  /// In en, this message translates to:
  /// **'Emergency Contact'**
  String get emp_emergency;

  /// No description provided for @emp_hr_only.
  ///
  /// In en, this message translates to:
  /// **'Some information can only be updated by HR.'**
  String get emp_hr_only;

  /// No description provided for @emp_name.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get emp_name;

  /// No description provided for @emp_personal_info.
  ///
  /// In en, this message translates to:
  /// **'Personal Information'**
  String get emp_personal_info;

  /// No description provided for @emp_phone.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get emp_phone;

  /// No description provided for @emp_position.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get emp_position;

  /// No description provided for @emp_relationship.
  ///
  /// In en, this message translates to:
  /// **'Relationship'**
  String get emp_relationship;

  /// No description provided for @emp_saved.
  ///
  /// In en, this message translates to:
  /// **'Information updated successfully.'**
  String get emp_saved;

  /// No description provided for @emp_saved_offline.
  ///
  /// In en, this message translates to:
  /// **'Changes saved locally (will sync when online)'**
  String get emp_saved_offline;

  /// No description provided for @emp_supervisor.
  ///
  /// In en, this message translates to:
  /// **'Direct Supervisor'**
  String get emp_supervisor;

  /// No description provided for @emp_work_info.
  ///
  /// In en, this message translates to:
  /// **'Work Information'**
  String get emp_work_info;

  /// No description provided for @employee_data.
  ///
  /// In en, this message translates to:
  /// **'Employee Data'**
  String get employee_data;

  /// No description provided for @factory_label.
  ///
  /// In en, this message translates to:
  /// **'Factory'**
  String get factory_label;

  /// No description provided for @factory_value.
  ///
  /// In en, this message translates to:
  /// **'10th of Ramadan'**
  String get factory_value;

  /// No description provided for @help_call_it.
  ///
  /// In en, this message translates to:
  /// **'Call IT'**
  String get help_call_it;

  /// No description provided for @help_call_now.
  ///
  /// In en, this message translates to:
  /// **'Call Now'**
  String get help_call_now;

  /// No description provided for @help_cannot_open.
  ///
  /// In en, this message translates to:
  /// **'No app found to open this link'**
  String get help_cannot_open;

  /// No description provided for @help_clinic.
  ///
  /// In en, this message translates to:
  /// **'Emergency Clinic'**
  String get help_clinic;

  /// No description provided for @help_clinic_value.
  ///
  /// In en, this message translates to:
  /// **'107'**
  String get help_clinic_value;

  /// No description provided for @help_direct_channels.
  ///
  /// In en, this message translates to:
  /// **'Direct Channels'**
  String get help_direct_channels;

  /// No description provided for @help_emergency_call.
  ///
  /// In en, this message translates to:
  /// **'Emergency Call'**
  String get help_emergency_call;

  /// No description provided for @help_formal_inquiry.
  ///
  /// In en, this message translates to:
  /// **'Need official documentation or a formal inquiry?'**
  String get help_formal_inquiry;

  /// No description provided for @help_hotline.
  ///
  /// In en, this message translates to:
  /// **'HR Hotline'**
  String get help_hotline;

  /// No description provided for @help_hotline_value.
  ///
  /// In en, this message translates to:
  /// **'19319'**
  String get help_hotline_value;

  /// No description provided for @help_it.
  ///
  /// In en, this message translates to:
  /// **'IT Help Desk'**
  String get help_it;

  /// No description provided for @help_it_value.
  ///
  /// In en, this message translates to:
  /// **'Ext. 4022'**
  String get help_it_value;

  /// No description provided for @help_open_chat.
  ///
  /// In en, this message translates to:
  /// **'Open Chat'**
  String get help_open_chat;

  /// No description provided for @help_open_hr_form.
  ///
  /// In en, this message translates to:
  /// **'Open HR Request Form'**
  String get help_open_hr_form;

  /// No description provided for @help_subtitle.
  ///
  /// In en, this message translates to:
  /// **'We are here for you — reach out any time.'**
  String get help_subtitle;

  /// No description provided for @help_title.
  ///
  /// In en, this message translates to:
  /// **'Need Help?'**
  String get help_title;

  /// No description provided for @help_track_request.
  ///
  /// In en, this message translates to:
  /// **'Submit an HR request directly through the app and track its approval status in real-time.'**
  String get help_track_request;

  /// No description provided for @help_whatsapp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp HR'**
  String get help_whatsapp;

  /// No description provided for @hr_request.
  ///
  /// In en, this message translates to:
  /// **'HR Request'**
  String get hr_request;

  /// No description provided for @inbox_filter_all.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get inbox_filter_all;

  /// No description provided for @inbox_filter_announcements.
  ///
  /// In en, this message translates to:
  /// **'Announcements'**
  String get inbox_filter_announcements;

  /// No description provided for @inbox_filter_approvals.
  ///
  /// In en, this message translates to:
  /// **'Approvals'**
  String get inbox_filter_approvals;

  /// No description provided for @inbox_filter_benefits.
  ///
  /// In en, this message translates to:
  /// **'Benefits'**
  String get inbox_filter_benefits;

  /// No description provided for @inbox_from_hr.
  ///
  /// In en, this message translates to:
  /// **'From HR'**
  String get inbox_from_hr;

  /// No description provided for @inbox_mark_all_read.
  ///
  /// In en, this message translates to:
  /// **'Mark all as read'**
  String get inbox_mark_all_read;

  /// No description provided for @inbox_marked_all.
  ///
  /// In en, this message translates to:
  /// **'All notifications marked as read'**
  String get inbox_marked_all;

  /// No description provided for @inbox_title.
  ///
  /// In en, this message translates to:
  /// **'Inbox'**
  String get inbox_title;

  /// No description provided for @leave_detail_dates.
  ///
  /// In en, this message translates to:
  /// **'Dates'**
  String get leave_detail_dates;

  /// No description provided for @leave_detail_duration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get leave_detail_duration;

  /// No description provided for @leave_detail_submitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted'**
  String get leave_detail_submitted;

  /// No description provided for @leave_detail_type.
  ///
  /// In en, this message translates to:
  /// **'Type'**
  String get leave_detail_type;

  /// No description provided for @leave_discard_confirm.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get leave_discard_confirm;

  /// No description provided for @leave_discard_message.
  ///
  /// In en, this message translates to:
  /// **'You have unsaved changes in your leave request. Are you sure you want to exit and lose them?'**
  String get leave_discard_message;

  /// No description provided for @leave_discard_stay.
  ///
  /// In en, this message translates to:
  /// **'Stay'**
  String get leave_discard_stay;

  /// No description provided for @leave_discard_title.
  ///
  /// In en, this message translates to:
  /// **'Discard changes?'**
  String get leave_discard_title;

  /// No description provided for @leave_estimated_duration.
  ///
  /// In en, this message translates to:
  /// **'Estimated Duration'**
  String get leave_estimated_duration;

  /// No description provided for @leave_exceeds_balance.
  ///
  /// In en, this message translates to:
  /// **'Exceeds balance'**
  String get leave_exceeds_balance;

  /// No description provided for @leave_from.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get leave_from;

  /// No description provided for @leave_line_manager.
  ///
  /// In en, this message translates to:
  /// **'Line Manager (Mohamed Hassan)'**
  String get leave_line_manager;

  /// No description provided for @leave_notes.
  ///
  /// In en, this message translates to:
  /// **'Notes (Optional)'**
  String get leave_notes;

  /// No description provided for @leave_notes_hint.
  ///
  /// In en, this message translates to:
  /// **'Add any details for your manager...'**
  String get leave_notes_hint;

  /// No description provided for @leave_request_failed.
  ///
  /// In en, this message translates to:
  /// **'Failed to submit leave request. Please try again.'**
  String get leave_request_failed;

  /// No description provided for @leave_request_submitted.
  ///
  /// In en, this message translates to:
  /// **'Leave request submitted successfully'**
  String get leave_request_submitted;

  /// No description provided for @leave_submit.
  ///
  /// In en, this message translates to:
  /// **'Submit Request'**
  String get leave_submit;

  /// No description provided for @leave_success.
  ///
  /// In en, this message translates to:
  /// **'Leave request submitted successfully!'**
  String get leave_success;

  /// No description provided for @leave_to.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get leave_to;

  /// No description provided for @leave_type.
  ///
  /// In en, this message translates to:
  /// **'Leave Type'**
  String get leave_type;

  /// No description provided for @leave_type_annual_leave.
  ///
  /// In en, this message translates to:
  /// **'Annual Leave'**
  String get leave_type_annual_leave;

  /// No description provided for @leave_type_emergency_leave.
  ///
  /// In en, this message translates to:
  /// **'Emergency Leave'**
  String get leave_type_emergency_leave;

  /// No description provided for @leave_type_sick_leave.
  ///
  /// In en, this message translates to:
  /// **'Sick Leave'**
  String get leave_type_sick_leave;

  /// No description provided for @leave_type_unpaid_leave.
  ///
  /// In en, this message translates to:
  /// **'Unpaid Leave'**
  String get leave_type_unpaid_leave;

  /// No description provided for @leave_waiting_approval.
  ///
  /// In en, this message translates to:
  /// **'Waiting on: Line Manager Approval'**
  String get leave_waiting_approval;

  /// No description provided for @menu_change_pin.
  ///
  /// In en, this message translates to:
  /// **'Change PIN'**
  String get menu_change_pin;

  /// No description provided for @menu_language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get menu_language;

  /// No description provided for @menu_logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get menu_logout;

  /// No description provided for @menu_settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get menu_settings;

  /// No description provided for @my_info.
  ///
  /// In en, this message translates to:
  /// **'My Info'**
  String get my_info;

  /// No description provided for @nav_benefits.
  ///
  /// In en, this message translates to:
  /// **'Benefits'**
  String get nav_benefits;

  /// No description provided for @nav_home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get nav_home;

  /// No description provided for @nav_inbox.
  ///
  /// In en, this message translates to:
  /// **'Inbox'**
  String get nav_inbox;

  /// No description provided for @nav_profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get nav_profile;

  /// No description provided for @nav_services.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get nav_services;

  /// No description provided for @network_offline_warning.
  ///
  /// In en, this message translates to:
  /// **'You are currently offline. Changes will sync automatically.'**
  String get network_offline_warning;

  /// No description provided for @new_announcement.
  ///
  /// In en, this message translates to:
  /// **'New Announcement'**
  String get new_announcement;

  /// No description provided for @news_demo1_body.
  ///
  /// In en, this message translates to:
  /// **'Elaraby Group announces the opening of two state-of-the-art production lines in 10th of Ramadan Industrial Zone, creating over 600 new specialized technical jobs and boosting export capabilities across the MENA region.'**
  String get news_demo1_body;

  /// No description provided for @news_demo1_cat.
  ///
  /// In en, this message translates to:
  /// **'Expansion'**
  String get news_demo1_cat;

  /// No description provided for @news_demo1_title.
  ///
  /// In en, this message translates to:
  /// **'New Manufacturing Facilities to Increase Production Capacity'**
  String get news_demo1_title;

  /// No description provided for @news_demo2_body.
  ///
  /// In en, this message translates to:
  /// **'Production Line A in Benha has achieved 180 continuous days with zero incidents. Management commends the dedication and strict adherence to workplace safety guidelines.'**
  String get news_demo2_body;

  /// No description provided for @news_demo2_cat.
  ///
  /// In en, this message translates to:
  /// **'Safety & Quality'**
  String get news_demo2_cat;

  /// No description provided for @news_demo2_title.
  ///
  /// In en, this message translates to:
  /// **'Annual Safety Excellence Award Winners Announced for Q2'**
  String get news_demo2_title;

  /// No description provided for @news_demo3_body.
  ///
  /// In en, this message translates to:
  /// **'Free comprehensive medical examinations, eye checkups, and nutritional counseling will be available to all factory workers across clinic centers from 9 AM to 4 PM.'**
  String get news_demo3_body;

  /// No description provided for @news_demo3_cat.
  ///
  /// In en, this message translates to:
  /// **'Employee Well-being'**
  String get news_demo3_cat;

  /// No description provided for @news_demo3_title.
  ///
  /// In en, this message translates to:
  /// **'Healthcare & Wellness Week Starting This Sunday'**
  String get news_demo3_title;

  /// No description provided for @news_demo4_body.
  ///
  /// In en, this message translates to:
  /// **'Elaraby Group leadership reviewed our key operational milestones and shared the strategic roadmap for sustainable manufacturing, energy reduction, and digital transformation.'**
  String get news_demo4_body;

  /// No description provided for @news_demo4_cat.
  ///
  /// In en, this message translates to:
  /// **'Leadership'**
  String get news_demo4_cat;

  /// No description provided for @news_demo4_title.
  ///
  /// In en, this message translates to:
  /// **'Quarterly Town Hall Meeting with Group Leadership'**
  String get news_demo4_title;

  /// No description provided for @news_read.
  ///
  /// In en, this message translates to:
  /// **'Read Article'**
  String get news_read;

  /// No description provided for @pay_and_time.
  ///
  /// In en, this message translates to:
  /// **'Pay & Time'**
  String get pay_and_time;

  /// No description provided for @profile_title.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile_title;

  /// No description provided for @qa_benefits.
  ///
  /// In en, this message translates to:
  /// **'Benefits'**
  String get qa_benefits;

  /// No description provided for @qa_salary.
  ///
  /// In en, this message translates to:
  /// **'Salary'**
  String get qa_salary;

  /// No description provided for @qa_shift.
  ///
  /// In en, this message translates to:
  /// **'Shift'**
  String get qa_shift;

  /// No description provided for @qa_support.
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get qa_support;

  /// No description provided for @qa_trips.
  ///
  /// In en, this message translates to:
  /// **'Trips'**
  String get qa_trips;

  /// No description provided for @qa_vacation.
  ///
  /// In en, this message translates to:
  /// **'Vacation'**
  String get qa_vacation;

  /// No description provided for @quick_actions.
  ///
  /// In en, this message translates to:
  /// **'Quick Actions'**
  String get quick_actions;

  /// No description provided for @quick_survey.
  ///
  /// In en, this message translates to:
  /// **'Quick Survey'**
  String get quick_survey;

  /// No description provided for @raise_concern.
  ///
  /// In en, this message translates to:
  /// **'Raise a Concern'**
  String get raise_concern;

  /// No description provided for @read_now.
  ///
  /// In en, this message translates to:
  /// **'Read Now'**
  String get read_now;

  /// No description provided for @request_leave.
  ///
  /// In en, this message translates to:
  /// **'Request Leave'**
  String get request_leave;

  /// No description provided for @requests_section.
  ///
  /// In en, this message translates to:
  /// **'Requests'**
  String get requests_section;

  /// No description provided for @return_home.
  ///
  /// In en, this message translates to:
  /// **'Return to Home'**
  String get return_home;

  /// No description provided for @route_not_found.
  ///
  /// In en, this message translates to:
  /// **'Page Not Found'**
  String get route_not_found;

  /// No description provided for @route_not_found_desc.
  ///
  /// In en, this message translates to:
  /// **'The requested page could not be found.'**
  String get route_not_found_desc;

  /// No description provided for @salary_label.
  ///
  /// In en, this message translates to:
  /// **'Salary'**
  String get salary_label;

  /// No description provided for @salary_slip.
  ///
  /// In en, this message translates to:
  /// **'Salary Slip'**
  String get salary_slip;

  /// No description provided for @salary_status.
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get salary_status;

  /// No description provided for @services_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Everything you need in one place.'**
  String get services_subtitle;

  /// No description provided for @services_title.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get services_title;

  /// No description provided for @settings_about.
  ///
  /// In en, this message translates to:
  /// **'About App'**
  String get settings_about;

  /// No description provided for @settings_fingerprint.
  ///
  /// In en, this message translates to:
  /// **'Fingerprint Login'**
  String get settings_fingerprint;

  /// No description provided for @settings_fingerprint_sub.
  ///
  /// In en, this message translates to:
  /// **'Use biometrics instead of your PIN'**
  String get settings_fingerprint_sub;

  /// No description provided for @settings_help.
  ///
  /// In en, this message translates to:
  /// **'Help & Support'**
  String get settings_help;

  /// No description provided for @settings_notifications.
  ///
  /// In en, this message translates to:
  /// **'Push Notifications'**
  String get settings_notifications;

  /// No description provided for @settings_notifications_header.
  ///
  /// In en, this message translates to:
  /// **'Notification'**
  String get settings_notifications_header;

  /// No description provided for @settings_notifications_sub.
  ///
  /// In en, this message translates to:
  /// **'Announcements, approvals and shifts'**
  String get settings_notifications_sub;

  /// No description provided for @settings_salary_protection.
  ///
  /// In en, this message translates to:
  /// **'Salary Slip Protection'**
  String get settings_salary_protection;

  /// No description provided for @settings_salary_protection_sub.
  ///
  /// In en, this message translates to:
  /// **'Require PIN to open salary documents'**
  String get settings_salary_protection_sub;

  /// No description provided for @settings_security.
  ///
  /// In en, this message translates to:
  /// **'Security & Fast Access'**
  String get settings_security;

  /// No description provided for @settings_title.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings_title;

  /// No description provided for @shift_confirmed.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get shift_confirmed;

  /// No description provided for @shift_line.
  ///
  /// In en, this message translates to:
  /// **'Production line A'**
  String get shift_line;

  /// No description provided for @shift_name_evening.
  ///
  /// In en, this message translates to:
  /// **'Evening Shift'**
  String get shift_name_evening;

  /// No description provided for @shift_name_morning.
  ///
  /// In en, this message translates to:
  /// **'Morning Shift'**
  String get shift_name_morning;

  /// No description provided for @shift_name_night.
  ///
  /// In en, this message translates to:
  /// **'Night Shift'**
  String get shift_name_night;

  /// No description provided for @shift_rest_day.
  ///
  /// In en, this message translates to:
  /// **'Rest Day'**
  String get shift_rest_day;

  /// No description provided for @shift_schedule.
  ///
  /// In en, this message translates to:
  /// **'Shift Schedule'**
  String get shift_schedule;

  /// No description provided for @shift_time.
  ///
  /// In en, this message translates to:
  /// **'07:00 AM – 03:00 PM'**
  String get shift_time;

  /// No description provided for @shift_week_of.
  ///
  /// In en, this message translates to:
  /// **'Week of'**
  String get shift_week_of;

  /// No description provided for @slip_allowances.
  ///
  /// In en, this message translates to:
  /// **'Allowances'**
  String get slip_allowances;

  /// No description provided for @slip_allowances_sub.
  ///
  /// In en, this message translates to:
  /// **'Housing & Transport'**
  String get slip_allowances_sub;

  /// No description provided for @slip_basic.
  ///
  /// In en, this message translates to:
  /// **'Basic Salary'**
  String get slip_basic;

  /// No description provided for @slip_breakdown_title.
  ///
  /// In en, this message translates to:
  /// **'Earnings & Deductions'**
  String get slip_breakdown_title;

  /// No description provided for @slip_deductions.
  ///
  /// In en, this message translates to:
  /// **'Deductions'**
  String get slip_deductions;

  /// No description provided for @slip_deductions_sub.
  ///
  /// In en, this message translates to:
  /// **'Tax & Insurance'**
  String get slip_deductions_sub;

  /// No description provided for @slip_download.
  ///
  /// In en, this message translates to:
  /// **'Download PDF'**
  String get slip_download;

  /// No description provided for @slip_enter_pin.
  ///
  /// In en, this message translates to:
  /// **'Enter your PIN to view salary documents.'**
  String get slip_enter_pin;

  /// No description provided for @slip_paid_on.
  ///
  /// In en, this message translates to:
  /// **'Paid on'**
  String get slip_paid_on;

  /// No description provided for @slip_share_failed.
  ///
  /// In en, this message translates to:
  /// **'Could not generate the PDF. Please try again.'**
  String get slip_share_failed;

  /// No description provided for @slip_shared.
  ///
  /// In en, this message translates to:
  /// **'Salary slip PDF is ready to share.'**
  String get slip_shared;

  /// No description provided for @slip_total.
  ///
  /// In en, this message translates to:
  /// **'Total Net Pay'**
  String get slip_total;

  /// No description provided for @survey_question.
  ///
  /// In en, this message translates to:
  /// **'Was it easy to find what you needed in the app?'**
  String get survey_question;

  /// No description provided for @svc_concern_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Anonymous'**
  String get svc_concern_subtitle;

  /// No description provided for @svc_days_remaining.
  ///
  /// In en, this message translates to:
  /// **'days remaining'**
  String get svc_days_remaining;

  /// No description provided for @svc_hr_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Document, letter, etc.'**
  String get svc_hr_subtitle;

  /// No description provided for @svc_pending.
  ///
  /// In en, this message translates to:
  /// **'PENDING'**
  String get svc_pending;

  /// No description provided for @svc_salary_subtitle.
  ///
  /// In en, this message translates to:
  /// **'July — available now'**
  String get svc_salary_subtitle;

  /// No description provided for @svc_shift_subtitle.
  ///
  /// In en, this message translates to:
  /// **'7am – 3pm today'**
  String get svc_shift_subtitle;

  /// No description provided for @svc_view_profile.
  ///
  /// In en, this message translates to:
  /// **'View & update profile'**
  String get svc_view_profile;

  /// No description provided for @time_just_now.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get time_just_now;

  /// No description provided for @todays_shift.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Shift'**
  String get todays_shift;

  /// No description provided for @trip_book_now.
  ///
  /// In en, this message translates to:
  /// **'Book Seat Now'**
  String get trip_book_now;

  /// No description provided for @trip_cancel_booking.
  ///
  /// In en, this message translates to:
  /// **'Cancel Reservation'**
  String get trip_cancel_booking;

  /// No description provided for @trip_cancelled.
  ///
  /// In en, this message translates to:
  /// **'Trip reservation cancelled.'**
  String get trip_cancelled;

  /// No description provided for @trip_confirmed.
  ///
  /// In en, this message translates to:
  /// **'Seat confirmed! Check your Inbox for trip instructions.'**
  String get trip_confirmed;

  /// No description provided for @trip_details.
  ///
  /// In en, this message translates to:
  /// **'Company Trip Details'**
  String get trip_details;

  /// No description provided for @trip_inc_1.
  ///
  /// In en, this message translates to:
  /// **'Round-trip air-conditioned company buses'**
  String get trip_inc_1;

  /// No description provided for @trip_inc_2.
  ///
  /// In en, this message translates to:
  /// **'Full-day private beach & pool access'**
  String get trip_inc_2;

  /// No description provided for @trip_inc_3.
  ///
  /// In en, this message translates to:
  /// **'Open buffet lunch & refreshing soft drinks'**
  String get trip_inc_3;

  /// No description provided for @trip_inc_4.
  ///
  /// In en, this message translates to:
  /// **'Organized team-building games & activities'**
  String get trip_inc_4;

  /// No description provided for @trip_inc_5.
  ///
  /// In en, this message translates to:
  /// **'Full medical and safety coverage on-site'**
  String get trip_inc_5;

  /// No description provided for @trip_inclusions_title.
  ///
  /// In en, this message translates to:
  /// **'What\'s Included'**
  String get trip_inclusions_title;

  /// No description provided for @trip_itinerary_title.
  ///
  /// In en, this message translates to:
  /// **'Day Program'**
  String get trip_itinerary_title;

  /// No description provided for @trip_seats_filled.
  ///
  /// In en, this message translates to:
  /// **'of seats filled'**
  String get trip_seats_filled;

  /// No description provided for @trip_seats_left.
  ///
  /// In en, this message translates to:
  /// **'left'**
  String get trip_seats_left;

  /// Plural count
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No seats left} =1{1 seat left} other{{count} seats left}}'**
  String trip_seats_left_count(num count);

  /// No description provided for @trip_step1_d.
  ///
  /// In en, this message translates to:
  /// **'Meeting at 10th of Ramadan Factory Gate 1'**
  String get trip_step1_d;

  /// No description provided for @trip_step1_t.
  ///
  /// In en, this message translates to:
  /// **'Assembly & Departure'**
  String get trip_step1_t;

  /// No description provided for @trip_step2_d.
  ///
  /// In en, this message translates to:
  /// **'Welcome drinks and resort room allocations'**
  String get trip_step2_d;

  /// No description provided for @trip_step2_t.
  ///
  /// In en, this message translates to:
  /// **'Arrival & Welcome'**
  String get trip_step2_t;

  /// No description provided for @trip_step3_d.
  ///
  /// In en, this message translates to:
  /// **'Full open-buffet lunch at main seaside restaurant'**
  String get trip_step3_d;

  /// No description provided for @trip_step3_t.
  ///
  /// In en, this message translates to:
  /// **'Lunch Buffet'**
  String get trip_step3_t;

  /// No description provided for @trip_step4_d.
  ///
  /// In en, this message translates to:
  /// **'Tea, music, and group photography session'**
  String get trip_step4_d;

  /// No description provided for @trip_step4_t.
  ///
  /// In en, this message translates to:
  /// **'Sunset Gathering'**
  String get trip_step4_t;

  /// No description provided for @trip_step5_d.
  ///
  /// In en, this message translates to:
  /// **'Buses depart back to 10th of Ramadan & Cairo'**
  String get trip_step5_d;

  /// No description provided for @trip_step5_t.
  ///
  /// In en, this message translates to:
  /// **'Return Journey'**
  String get trip_step5_t;

  /// No description provided for @trip_subsidized_badge.
  ///
  /// In en, this message translates to:
  /// **'60% COMPANY SUBSIDIZED'**
  String get trip_subsidized_badge;

  /// No description provided for @vac_annual.
  ///
  /// In en, this message translates to:
  /// **'Annual'**
  String get vac_annual;

  /// No description provided for @vac_days_available.
  ///
  /// In en, this message translates to:
  /// **'Days Available'**
  String get vac_days_available;

  /// No description provided for @vac_days_remaining.
  ///
  /// In en, this message translates to:
  /// **'Days Remaining'**
  String get vac_days_remaining;

  /// No description provided for @vac_days_unit.
  ///
  /// In en, this message translates to:
  /// **'Days'**
  String get vac_days_unit;

  /// No description provided for @vac_emergency.
  ///
  /// In en, this message translates to:
  /// **'Emergency'**
  String get vac_emergency;

  /// No description provided for @vac_history.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get vac_history;

  /// No description provided for @vac_left_suffix.
  ///
  /// In en, this message translates to:
  /// **'Left'**
  String get vac_left_suffix;

  /// No description provided for @vac_sick.
  ///
  /// In en, this message translates to:
  /// **'Sick'**
  String get vac_sick;

  /// No description provided for @vac_total_available.
  ///
  /// In en, this message translates to:
  /// **'Total Available'**
  String get vac_total_available;

  /// No description provided for @vacation_balance.
  ///
  /// In en, this message translates to:
  /// **'Vacation Balance'**
  String get vacation_balance;

  /// No description provided for @vacation_days.
  ///
  /// In en, this message translates to:
  /// **'12 Days'**
  String get vacation_days;

  /// Plural count
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{0 Days} =1{1 Day} other{{count} Days}}'**
  String vacation_days_count(num count);

  /// Plural count
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{0 days remaining} =1{1 day remaining} other{{count} days remaining}}'**
  String vacation_days_remaining_count(num count);

  /// No description provided for @vacation_left.
  ///
  /// In en, this message translates to:
  /// **'Vacation Left'**
  String get vacation_left;

  /// No description provided for @view_all.
  ///
  /// In en, this message translates to:
  /// **'View All'**
  String get view_all;

  /// No description provided for @welcome_prefix.
  ///
  /// In en, this message translates to:
  /// **'Welcome,'**
  String get welcome_prefix;

  /// No description provided for @welcome_user.
  ///
  /// In en, this message translates to:
  /// **'Welcome, Ahmed'**
  String get welcome_user;

  /// No description provided for @your_requests.
  ///
  /// In en, this message translates to:
  /// **'Your Requests'**
  String get your_requests;
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {


  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar': return AppLocalizationsAr();
    case 'en': return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.'
  );
}
