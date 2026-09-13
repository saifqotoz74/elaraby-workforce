import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get ann_contact_btn => 'عندك سؤال؟ تواصل مع المشرف';

  @override
  String get ann_contact_sent => 'تم إشعار ممثل الموارد البشرية.';

  @override
  String get ann_detail_badge => 'تحديث سياسة';

  @override
  String get ann_detail_guidelines_title => 'أهم الإرشادات والتغييرات';

  @override
  String get ann_detail_overview_body => 'لتعزيز الكفاءة التشغيلية ورفاهية العاملين في مصانعنا بالعاشر من رمضان وبنها، تنتقل مجموعة العرابي إلى سياسة ورديات متناوبة محدّثة بدءاً من يوم الاثنين 10 أغسطس 2026.';

  @override
  String get ann_detail_overview_title => 'نظرة عامة على السياسة';

  @override
  String get ann_detail_published => 'نُشر في 01 أغسطس 2026 • عمليات الموارد البشرية';

  @override
  String get ann_detail_schedules_title => 'جداول الورديات المحدّثة';

  @override
  String get ann_guide_break_d => 'استراحة غداء 45 دقيقة واستراحة راحة 15 دقيقة لكل وردية.';

  @override
  String get ann_guide_break_t => 'أوقات الراحة';

  @override
  String get ann_guide_bus_d => 'جميع خطوط ومواعيد أتوبيسات الشركة ستتزامن قبل بدء الورديات بـ 30 دقيقة.';

  @override
  String get ann_guide_bus_t => 'أتوبيسات النقل';

  @override
  String get ann_guide_ot_d => 'ستزيد بدلات الوردية الليلية بنسبة 15% اعتباراً من أول دورة رواتب.';

  @override
  String get ann_guide_ot_t => 'الإضافي والبدلات';

  @override
  String get announcement_badge => 'إعلان هام';

  @override
  String get announcement_title => 'سياسة الورديات الجديدة\nبدءاً من 10 أغسطس 2026';

  @override
  String get auth_auto_verify => 'يتم التحقق تلقائياً عند الاكتمال';

  @override
  String get auth_code_resent => 'تم إرسال رمز جديد إلى هاتفك.';

  @override
  String get auth_confirm_pin_subtitle => 'أدخل نفس الرمز مرة أخرى للتأكيد';

  @override
  String get auth_confirm_pin_title => 'أكد الرمز السري';

  @override
  String get auth_continue => 'متابعة';

  @override
  String get auth_create_pin_subtitle => 'ستستخدمه لتسجيل الدخول وفتح مفردات المرتب';

  @override
  String get auth_create_pin_title => 'أنشئ الرمز السري';

  @override
  String get auth_dev_code => 'رمز التجربة:';

  @override
  String get auth_forgot_body => 'إعادة تعيين الرمز ستخرجك من التطبيق وتمسح البيانات المحلية على هذا الجهاز. ستحتاج للتحقق من رقمك القومي مرة أخرى.';

  @override
  String get auth_forgot_pin => 'نسيت الرمز السري؟';

  @override
  String get auth_get_help_id => 'لا تستطيع إيجاد رقمك القومي؟ احصل على مساعدة';

  @override
  String get auth_get_started => 'ابدأ الآن';

  @override
  String get auth_get_started_subtitle => 'تطبيقك الواحد للورديات والمرتبات والطلبات ومزايا الشركة.';

  @override
  String get auth_id_help_body => 'رقمك القومي مطبوع على بطاقة الرقم القومي. إذا لم تجده، تفضل بزيارة مكتب الموارد البشرية (مبنى 2) أو اتصل بالخط الساخن 19319.';

  @override
  String get auth_id_not_found => 'الرقم القومي غير مسجل في قاعدة بيانات العاملين. يرجى مراجعة إدارة الموارد البشرية.';

  @override
  String auth_locked(String minutes) {
    return 'محاولات كتير خاطئة. حاول مرة أخرى بعد $minutes دقيقة.';
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
      other: 'محاولات خاطئة كثيرة. حاول مرة أخرى بعد $minutesString دقيقة.',
      many: 'محاولات خاطئة كثيرة. حاول مرة أخرى بعد $minutesString دقيقة.',
      few: 'محاولات خاطئة كثيرة. حاول مرة أخرى بعد $minutesString دقائق.',
      two: 'محاولات خاطئة كثيرة. حاول مرة أخرى بعد دقيقتين.',
      one: 'محاولات خاطئة كثيرة. حاول مرة أخرى بعد دقيقة واحدة.',
    );
    return '$_temp0';
  }

  @override
  String get auth_national_id_subtitle => 'أدخل رقمك القومي المكوّن من 14 رقماً للعثور على ملفك الشخصي';

  @override
  String get auth_national_id_title => 'أدخل الرقم القومي';

  @override
  String get auth_no_code_help => 'لم يصلك الرمز؟ احصل على مساعدة';

  @override
  String get auth_of => 'من';

  @override
  String get auth_otp_help_body => 'تأكد من توفر الشبكة وحاول إعادة إرسال الرمز. إذا لم يصل، اتصل بخدمة الدعم الفني على تحويلة 4022.';

  @override
  String get auth_otp_sent_to => 'أرسلنا رمزاً من 6 أرقام إلى';

  @override
  String get auth_otp_title => 'أدخل رمز التحقق';

  @override
  String get auth_pin_mismatch => 'الرمزان غير متطابقين. حاول مرة أخرى.';

  @override
  String get auth_registered_phone => 'رقمك المسجل';

  @override
  String get auth_resend_in => 'إعادة الإرسال بعد';

  @override
  String get auth_resend_now => 'إعادة إرسال الرمز الآن';

  @override
  String get auth_switch_employee => 'تسجيل الدخول بموظف آخر';

  @override
  String get auth_switch_employee_confirm => 'هل أنت متأكد من تسجيل الدخول بموظف آخر؟ سيتم مسح الجلسة النشطة والبيانات المحلية على هذا الجهاز.';

  @override
  String get auth_unlock_subtitle => 'أدخل رمزك السري المكوّن من 4 أرقام لفتح التطبيق';

  @override
  String get auth_unlock_title => 'مرحباً بعودتك';

  @override
  String get auth_wrong_code => 'رمز خاطئ. حاول مرة أخرى.';

  @override
  String get auth_wrong_pin => 'رمز خاطئ. حاول مرة أخرى.';

  @override
  String get ben_about_title => 'عن العرض';

  @override
  String get ben_cat_featured => 'مميزة';

  @override
  String get ben_cat_health => 'الرعاية الصحية';

  @override
  String get ben_cat_supermarkets => 'السوبر ماركت';

  @override
  String get ben_default_desc => 'سلسلة متاجر رائدة تقدم تشكيلة واسعة من الخضروات الطازجة والبقالة والأدوات المنزلية بأسعار تنافسية لموظفي العرابي.';

  @override
  String get ben_employee_id => 'بطاقة الموظف';

  @override
  String get ben_id_note => 'اعرض هذه البطاقة في المتجر المشارك للحصول على الخصم.';

  @override
  String get ben_redeem_body => 'ما عليك سوى إظهار بطاقة الموظف أو الرقم القومي عند الدفع للاستمتاع بالخصم.';

  @override
  String get ben_redeem_title => 'طريقة الاستخدام';

  @override
  String get ben_report_issue => 'تواجه مشكلة في هذه الميزة؟ أبلغ عنها';

  @override
  String get ben_section_expiring => 'تنتهي قريباً';

  @override
  String get ben_section_perks => 'مزايا حصرية';

  @override
  String get ben_section_trips => 'رحلات الشركة';

  @override
  String get ben_show_id => 'اعرض بطاقة الموظف';

  @override
  String get ben_subtitle => 'مزايا وخصومات حصرية';

  @override
  String get ben_terms_1 => 'لا ينطبق على أصناف عليها خصم مسبق';

  @override
  String get ben_terms_2 => 'يُسمح باستخدامه مرة واحدة في الزيارة';

  @override
  String get ben_terms_3 => 'لا يمكن الدمج مع عروض أخرى.';

  @override
  String get ben_terms_title => 'الشروط والاستثناءات';

  @override
  String get ben_valid_branches => 'صالح في جميع الفروع';

  @override
  String get biometric_button => 'الدخول بالبصمة';

  @override
  String get biometric_failed => 'فشل التحقق بالبصمة — استخدم رمزك السري.';

  @override
  String get biometric_not_setup => 'البصمة غير مُعدّة على هذا الجهاز. استخدم الرمز السري.';

  @override
  String get biometric_prompt => 'افتح Elaraby Connect';

  @override
  String get change_pin_step_confirm_subtitle => 'أدخل الرمز الجديد مرة أخرى';

  @override
  String get change_pin_step_confirm_title => 'أكد الرمز الجديد';

  @override
  String get change_pin_step_current_subtitle => 'أدخل رمزك السري الحالي المكوّن من 4 أرقام';

  @override
  String get change_pin_step_current_title => 'أدخل الرمز الحالي';

  @override
  String get change_pin_step_new_subtitle => 'اختر رمزاً سرياً جديداً من 4 أرقام لحسابك';

  @override
  String get change_pin_step_new_title => 'أنشئ رمزاً جديداً';

  @override
  String get change_pin_success => 'تم تغيير الرمز السري بنجاح!';

  @override
  String get change_pin_wrong_current => 'رمز خاطئ. أدخل رمزك الحالي مرة أخرى.';

  @override
  String get common_cancel => 'إلغاء';

  @override
  String get common_edit => 'تعديل';

  @override
  String get common_ok => 'حسناً';

  @override
  String get common_questions => 'الأسئلة الشائعة';

  @override
  String get common_save => 'حفظ';

  @override
  String get common_save_changes => 'حفظ التعديلات';

  @override
  String get common_submit => 'إرسال';

  @override
  String get company_news => 'أخبار الشركة';

  @override
  String get concern_success => 'تم إرسال الشكوى بشكل مجهول. شكراً لك.';

  @override
  String get confirm_profile_department => 'القسم';

  @override
  String get confirm_profile_employee_id => 'رقم الموظف';

  @override
  String get confirm_profile_factory => 'المصنع';

  @override
  String get confirm_profile_name => 'الاسم الكامل';

  @override
  String get confirm_profile_no => 'لا، هذا ليس أنا';

  @override
  String get confirm_profile_subtitle => 'يرجى تأكيد أن هذه البيانات خاصة بك';

  @override
  String get confirm_profile_title => 'وجدنا ملفك الشخصي';

  @override
  String get confirm_profile_yes => 'نعم، هذا أنا';

  @override
  String get current_language_name => 'العربية';

  @override
  String get date_today => 'الأحد، 02 أغسطس';

  @override
  String get dept_label => 'القسم';

  @override
  String get dept_value => 'الإنتاج أ';

  @override
  String get emp_address => 'العنوان';

  @override
  String get emp_code => 'رقم الموظف';

  @override
  String get emp_data_title => 'بيانات الموظف';

  @override
  String get emp_edit_note => 'سيتم إرسال تعديلات البيانات الشخصية إلى الموارد البشرية للمراجعة.';

  @override
  String get emp_edit_title => 'تعديل البيانات';

  @override
  String get emp_emergency => 'جهة اتصال للطوارئ';

  @override
  String get emp_hr_only => 'بعض البيانات لا يمكن تعديلها إلا من قبل الموارد البشرية.';

  @override
  String get emp_name => 'الاسم الكامل';

  @override
  String get emp_personal_info => 'البيانات الشخصية';

  @override
  String get emp_phone => 'رقم الهاتف';

  @override
  String get emp_position => 'الوظيفة';

  @override
  String get emp_relationship => 'صلة القرابة';

  @override
  String get emp_saved => 'تم تحديث البيانات بنجاح.';

  @override
  String get emp_saved_offline => 'تم الحفظ محلياً (سيتم المزامنة عند الاتصال بالإنترنت)';

  @override
  String get emp_supervisor => 'المشرف المباشر';

  @override
  String get emp_work_info => 'بيانات العمل';

  @override
  String get employee_data => 'بيانات الموظف';

  @override
  String get factory_label => 'المصنع';

  @override
  String get factory_value => 'العاشر من رمضان';

  @override
  String get help_call_it => 'اتصل بالدعم';

  @override
  String get help_call_now => 'اتصل الآن';

  @override
  String get help_cannot_open => 'لا يوجد تطبيق لفتح هذا الرابط';

  @override
  String get help_clinic => 'العيادة الطارئة';

  @override
  String get help_clinic_value => '107';

  @override
  String get help_direct_channels => 'قنوات التواصل المباشر';

  @override
  String get help_emergency_call => 'اتصال طارئ';

  @override
  String get help_formal_inquiry => 'تحتاج مستند رسمي أو استفسار رسمي؟';

  @override
  String get help_hotline => 'الخط الساخن للموارد البشرية';

  @override
  String get help_hotline_value => '19319';

  @override
  String get help_it => 'الدعم الفني';

  @override
  String get help_it_value => 'تحويلة 4022';

  @override
  String get help_open_chat => 'افتح المحادثة';

  @override
  String get help_open_hr_form => 'افتح نموذج طلب HR';

  @override
  String get help_subtitle => 'نحن هنا من أجلك — تواصل معنا في أي وقت.';

  @override
  String get help_title => 'تحتاج مساعدة؟';

  @override
  String get help_track_request => 'أرسل طلب HR مباشرة من التطبيق وتابع حالة الموافقة لحظة بلحظة.';

  @override
  String get help_whatsapp => 'واتساب الموارد البشرية';

  @override
  String get hr_request => 'طلب مستند HR';

  @override
  String get inbox_filter_all => 'الكل';

  @override
  String get inbox_filter_announcements => 'الإعلانات';

  @override
  String get inbox_filter_approvals => 'الموافقات';

  @override
  String get inbox_filter_benefits => 'المزايا';

  @override
  String get inbox_from_hr => 'من الموارد البشرية';

  @override
  String get inbox_mark_all_read => 'تحديد الكل كمقروء';

  @override
  String get inbox_marked_all => 'تم تحديد جميع الإشعارات كمقروءة';

  @override
  String get inbox_title => 'الوارد';

  @override
  String get leave_detail_dates => 'التواريخ';

  @override
  String get leave_detail_duration => 'المدة';

  @override
  String get leave_detail_submitted => 'تاريخ الإرسال';

  @override
  String get leave_detail_type => 'النوع';

  @override
  String get leave_discard_confirm => 'تجاهل والخروج';

  @override
  String get leave_discard_message => 'لديك بيانات غير محفوظة في طلب الإجازة. هل أنت متأكد من الخروج وتجاهل البيانات؟';

  @override
  String get leave_discard_stay => 'البقاء';

  @override
  String get leave_discard_title => 'تجاهل التعديلات؟';

  @override
  String get leave_estimated_duration => 'المدة المتوقعة';

  @override
  String get leave_exceeds_balance => 'تتجاوز الرصيد';

  @override
  String get leave_from => 'من';

  @override
  String get leave_line_manager => 'مدير الخط (محمد حسن)';

  @override
  String get leave_notes => 'ملاحظات (اختياري)';

  @override
  String get leave_notes_hint => 'أضف أي تفاصيل لمديرك...';

  @override
  String get leave_request_failed => 'تعذر إرسال طلب الإجازة. يرجى المحاولة مرة أخرى.';

  @override
  String get leave_request_submitted => 'تم تقديم طلب الإجازة بنجاح';

  @override
  String get leave_submit => 'إرسال الطلب';

  @override
  String get leave_success => 'تم إرسال طلب الإجازة بنجاح!';

  @override
  String get leave_to => 'إلى';

  @override
  String get leave_type => 'نوع الإجازة';

  @override
  String get leave_type_annual_leave => 'إجازة سنوية';

  @override
  String get leave_type_emergency_leave => 'إجازة اضطرارية';

  @override
  String get leave_type_sick_leave => 'إجازة مرضية';

  @override
  String get leave_type_unpaid_leave => 'إجازة بدون مرتب';

  @override
  String get leave_waiting_approval => 'بانتظار: موافقة مدير الخط';

  @override
  String get menu_change_pin => 'تغيير الرمز السري';

  @override
  String get menu_language => 'اللغة';

  @override
  String get menu_logout => 'تسجيل الخروج';

  @override
  String get menu_settings => 'الإعدادات';

  @override
  String get my_info => 'بياناتي';

  @override
  String get nav_benefits => 'المزايا';

  @override
  String get nav_home => 'الرئيسية';

  @override
  String get nav_inbox => 'الوارد';

  @override
  String get nav_profile => 'حسابي';

  @override
  String get nav_services => 'الخدمات';

  @override
  String get network_offline_warning => 'أنت الآن في وضع عدم الاتصال. ستتم المزامنة تلقائياً.';

  @override
  String get new_announcement => 'إعلان جديد';

  @override
  String get news_demo1_body => 'تعلن مجموعة العرابي عن افتتاح خطي إنتاج حديثين في المنطقة الصناعية بالعاشر من رمضان، بما يوفر أكثر من 600 وظيفة فنية متخصصة ويعزز القدرة التصديرية في منطقة الشرق الأوسط وشمال أفريقيا.';

  @override
  String get news_demo1_cat => 'توسع';

  @override
  String get news_demo1_title => 'منشآت تصنيعية جديدة لزيادة الطاقة الإنتاجية';

  @override
  String get news_demo2_body => 'حقق خط الإنتاج أ في بنها 180 يوم عمل متواصلاً دون حوادث. وتثمن الإدارة التفاني والالتزام الصارم بإرشادات السلامة في بيئة العمل.';

  @override
  String get news_demo2_cat => 'السلامة والجودة';

  @override
  String get news_demo2_title => 'إعلان الفائزين بجائزة التميز في السلامة للربع الثاني';

  @override
  String get news_demo3_body => 'الفحوصات الطبية الشاملة المجانية وفحوصات النظر والاستشارات الغذائية متاحة لجميع عمال المصانع في المراكز الطبية من 9 صباحاً حتى 4 عصراً.';

  @override
  String get news_demo3_cat => 'رفاهية الموظفين';

  @override
  String get news_demo3_title => 'الأسبوع الصحي والبدني يبدأ هذا الأحد';

  @override
  String get news_demo4_body => 'استعرضت قيادة مجموعة العرابي أبرز الإنجازات التشغيلية وشاركت خارطة الطريق الاستراتيجية للتصنيع المستدام وخفض الطاقة والتحول الرقمي.';

  @override
  String get news_demo4_cat => 'القيادة';

  @override
  String get news_demo4_title => 'الاجتماع الرباعي المفتوح مع قيادة المجموعة';

  @override
  String get news_read => 'اقرأ المقال';

  @override
  String get pay_and_time => 'الرواتب والوقت';

  @override
  String get profile_title => 'الملف الشخصي';

  @override
  String get qa_benefits => 'المزايا';

  @override
  String get qa_salary => 'المرتب';

  @override
  String get qa_shift => 'الورديات';

  @override
  String get qa_support => 'الدعم';

  @override
  String get qa_trips => 'الرحلات';

  @override
  String get qa_vacation => 'الإجازات';

  @override
  String get quick_actions => 'الوصول السريع';

  @override
  String get quick_survey => 'استبيان سريع';

  @override
  String get raise_concern => 'تقديم شكوى / مقترح';

  @override
  String get read_now => 'اقرأ الآن';

  @override
  String get request_leave => 'طلب إجازة';

  @override
  String get requests_section => 'الطلبات';

  @override
  String get return_home => 'العودة للرئيسية';

  @override
  String get route_not_found => 'الصفحة غير موجودة';

  @override
  String get route_not_found_desc => 'تعذر العثور على الصفحة المطلوبة.';

  @override
  String get salary_label => 'الراتب';

  @override
  String get salary_slip => 'مفردات المرتب';

  @override
  String get salary_status => 'متاح الآن';

  @override
  String get services_subtitle => 'كل ما تحتاجه في مكان واحد.';

  @override
  String get services_title => 'الخدمات';

  @override
  String get settings_about => 'عن التطبيق';

  @override
  String get settings_fingerprint => 'الدخول بالبصمة';

  @override
  String get settings_fingerprint_sub => 'استخدم البصمة بدلاً من الرمز السري';

  @override
  String get settings_help => 'المساعدة والدعم';

  @override
  String get settings_notifications => 'الإشعارات';

  @override
  String get settings_notifications_header => 'الإشعارات';

  @override
  String get settings_notifications_sub => 'الإعلانات والموافقات والورديات';

  @override
  String get settings_salary_protection => 'حماية مفردات المرتب';

  @override
  String get settings_salary_protection_sub => 'طلب الرمز السري لفتح مستندات المرتب';

  @override
  String get settings_security => 'الأمان والوصول السريع';

  @override
  String get settings_title => 'الإعدادات';

  @override
  String get shift_confirmed => 'مؤكدة';

  @override
  String get shift_line => 'خط الإنتاج أ';

  @override
  String get shift_name_evening => 'الوردية المسائية';

  @override
  String get shift_name_morning => 'الوردية الصباحية';

  @override
  String get shift_name_night => 'الوردية الليلية';

  @override
  String get shift_rest_day => 'يوم راحة';

  @override
  String get shift_schedule => 'جدول الورديات';

  @override
  String get shift_time => '07:00 ص – 03:00 م';

  @override
  String get shift_week_of => 'أسبوع';

  @override
  String get slip_allowances => 'البدلات';

  @override
  String get slip_allowances_sub => 'سكن ومواصلات';

  @override
  String get slip_basic => 'الراتب الأساسي';

  @override
  String get slip_breakdown_title => 'المستحقات والاستقطاعات';

  @override
  String get slip_deductions => 'الاستقطاعات';

  @override
  String get slip_deductions_sub => 'ضرائب وتأمينات';

  @override
  String get slip_download => 'تحميل PDF';

  @override
  String get slip_enter_pin => 'أدخل رمزك السري لعرض مستندات المرتب.';

  @override
  String get slip_paid_on => 'تم الدفع في';

  @override
  String get slip_share_failed => 'تعذر إنشاء ملف PDF. حاول مرة أخرى.';

  @override
  String get slip_shared => 'ملف قسيمة المرتب جاهز للمشاركة.';

  @override
  String get slip_total => 'إجمالي الصافي';

  @override
  String get survey_question => 'هل كان من السهل العثور على ما تحتاجه في التطبيق؟';

  @override
  String get svc_concern_subtitle => 'مجهول الهوية';

  @override
  String get svc_days_remaining => 'يوم متبقٍ';

  @override
  String get svc_hr_subtitle => 'مستندات، خطابات، إلخ.';

  @override
  String get svc_pending => 'قيد الانتظار';

  @override
  String get svc_salary_subtitle => 'يوليو — متاح الآن';

  @override
  String get svc_shift_subtitle => '7ص – 3م اليوم';

  @override
  String get svc_view_profile => 'عرض وتحديث الملف';

  @override
  String get time_just_now => 'الآن';

  @override
  String get todays_shift => 'وردية اليوم';

  @override
  String get trip_book_now => 'احجز مقعدك الآن';

  @override
  String get trip_cancel_booking => 'إلغاء الحجز';

  @override
  String get trip_cancelled => 'تم إلغاء حجز الرحلة.';

  @override
  String get trip_confirmed => 'تم تأكيد مقعدك! تابع صندوق الوارد لتعليمات الرحلة.';

  @override
  String get trip_details => 'تفاصيل رحلة الشركة';

  @override
  String get trip_inc_1 => 'أتوبيسات شركة مكيفة ذهاب وعودة';

  @override
  String get trip_inc_2 => 'دخول خاص للشاطئ والمسبح طوال اليوم';

  @override
  String get trip_inc_3 => 'بوفيه مفتوح للغداء ومشروبات منعشة';

  @override
  String get trip_inc_4 => 'ألعاب وأنشطة بناء الفريق';

  @override
  String get trip_inc_5 => 'تغطية طبية وأمنية كاملة في الموقع';

  @override
  String get trip_inclusions_title => 'ماذا تشمل الرحلة';

  @override
  String get trip_itinerary_title => 'برنامج اليوم';

  @override
  String get trip_seats_filled => 'من المقاعد محجوزة';

  @override
  String get trip_seats_left => 'متبقٍ';

  @override
  String trip_seats_left_count(num count) {
    final intl.NumberFormat countNumberFormat = intl.NumberFormat.compact(
      locale: localeName,
      
    );
    final String countString = countNumberFormat.format(count);

    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countString مقعد متبقٍ',
      many: '$countString مقعداً متبقياً',
      few: '$countString مقاعد متبقية',
      two: 'مقعدان متبقيان',
      one: 'مقعد واحد متبقٍ',
      zero: 'لا توجد مقاعد متبقية',
    );
    return '$_temp0';
  }

  @override
  String get trip_step1_d => 'المكان: بوابة 1 - مصنع العاشر من رمضان';

  @override
  String get trip_step1_t => 'التجمع والانطلاق';

  @override
  String get trip_step2_d => 'مشروبات ترحيبية وتوزيع غرف المنتجع';

  @override
  String get trip_step2_t => 'الوصول والاستقبال';

  @override
  String get trip_step3_d => 'بوفيه مفتوح في المطعم الرئيسي على البحر';

  @override
  String get trip_step3_t => 'بوفيه الغداء';

  @override
  String get trip_step4_d => 'شاي وموسيقى وجلسة تصوير جماعي';

  @override
  String get trip_step4_t => 'جلسة الغروب';

  @override
  String get trip_step5_d => 'الأتوبيسات تعود إلى العاشر من رمضان والقاهرة';

  @override
  String get trip_step5_t => 'رحلة العودة';

  @override
  String get trip_subsidized_badge => 'دعم من الشركة 60%';

  @override
  String get vac_annual => 'سنوية';

  @override
  String get vac_days_available => 'يوم متاح';

  @override
  String get vac_days_remaining => 'يوم متبقٍ';

  @override
  String get vac_days_unit => 'يوم';

  @override
  String get vac_emergency => 'اضطرارية';

  @override
  String get vac_history => 'السجل';

  @override
  String get vac_left_suffix => 'متبقٍ';

  @override
  String get vac_sick => 'مرضية';

  @override
  String get vac_total_available => 'إجمالي المتاح';

  @override
  String get vacation_balance => 'رصيد الإجازات';

  @override
  String get vacation_days => '12 يوم';

  @override
  String vacation_days_count(num count) {
    final intl.NumberFormat countNumberFormat = intl.NumberFormat.compact(
      locale: localeName,
      
    );
    final String countString = countNumberFormat.format(count);

    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countString يوم',
      many: '$countString يوماً',
      few: '$countString أيام',
      two: 'يومان',
      one: 'يوم واحد',
      zero: '٠ يوم',
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
      other: '$countString يوم متبقٍ',
      many: '$countString يوماً متبقياً',
      few: '$countString أيام متبقية',
      two: 'يومان متبقيان',
      one: 'يوم واحد متبقٍ',
      zero: '٠ يوم متبقٍ',
    );
    return '$_temp0';
  }

  @override
  String get vacation_left => 'رصيد الإجازات';

  @override
  String get view_all => 'عرض الكل';

  @override
  String get welcome_prefix => 'مرحباً،';

  @override
  String get welcome_user => 'مرحباً، أحمد';

  @override
  String get your_requests => 'طلباتك السابقة';
}
