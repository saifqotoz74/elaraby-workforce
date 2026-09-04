import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/storage/local_store.dart';
import '../../../auth/presentation/screens/get_started_screen.dart';
import 'change_pin_screen.dart';
import 'settings_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          // Pinned Header
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
              boxShadow: [
                BoxShadow(
                  color: Color(0x08000000),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            padding: EdgeInsets.fromLTRB(20, topPadding + 12, 20, 20),
            child: Text(
              AppLocale.tr('profile_title'),
              style: AppTypography.welcomeTitle,
            ),
          ),

          // Body Content
          Expanded(
            child: ListView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                // Top Employee Info Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x06000000),
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: const BoxDecoration(
                              color: AppColors.avatarBg,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              LocalStore.instance.profile.initials,
                              style: AppTypography.fontBase.copyWith(
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                                color: AppColors.avatarText,
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  LocalStore.instance.profile.name,
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'ID ${LocalStore.instance.profile.employeeCode}',
                                  style: AppTypography.dateSubtitle.copyWith(fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppLocale.tr('factory_label'),
                                  style: AppTypography.dateSubtitle.copyWith(fontSize: 12),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  LocalStore.instance.profile.factory,
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppLocale.tr('dept_label'),
                                  style: AppTypography.dateSubtitle.copyWith(fontSize: 12),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  LocalStore.instance.profile.department,
                                  style: AppTypography.fontBase.copyWith(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Option 1: Language
                ListenableBuilder(
                  listenable: AppLocale.instance,
                  builder: (context, _) => _buildMenuCard(
                    icon: Icons.language_rounded,
                    title: AppLocale.tr('menu_language'),
                    subtitle: AppLocale.instance.isArabic ? 'العربية' : 'English',
                    onTap: () => _showLanguageModal(context),
                  ),
                ),
                const SizedBox(height: 12),

                // Option 2: Settings
                _buildMenuCard(
                  icon: Icons.settings_outlined,
                  title: AppLocale.tr('menu_settings'),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    );
                  },
                ),
                const SizedBox(height: 12),

                // Option 3: Change PIN
                _buildMenuCard(
                  icon: Icons.lock_outline_rounded,
                  title: AppLocale.tr('menu_change_pin'),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ChangePinScreen()),
                    );
                  },
                ),
                const SizedBox(height: 12),

                // Option 4: Privacy Policy & Terms
                _buildMenuCard(
                  icon: Icons.privacy_tip_outlined,
                  title: AppLocale.instance.isArabic
                      ? 'سياسة الخصوصية والشروط'
                      : 'Privacy Policy & Terms',
                  subtitle: AppLocale.instance.isArabic
                      ? 'حماية البيانات وحقوق الموظف'
                      : 'Data protection & worker rights',
                  onTap: () => _showPrivacyPolicyModal(context),
                ),
                const SizedBox(height: 12),

                // Option 5: Request Account Deletion
                _buildMenuCard(
                  icon: Icons.person_remove_outlined,
                  title: AppLocale.instance.isArabic
                      ? 'طلب حذف الحساب'
                      : 'Request Account Deletion',
                  subtitle: AppLocale.instance.isArabic
                      ? 'إلغاء تنشيط الحساب ومسح البيانات'
                      : 'Deactivate account & erase data',
                  onTap: () => _confirmAccountDeletion(context),
                ),
                const SizedBox(height: 28),

                // Logout Button
                Container(
                  width: double.infinity,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEECEC),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => _confirmLogout(context),
                      borderRadius: BorderRadius.circular(14),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.logout_rounded,
                            color: AppColors.announcementButton,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            AppLocale.instance.isArabic ? 'تسجيل الخروج' : 'Logout',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppColors.announcementButton,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuCard({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.shiftBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: AppColors.textSecondary,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showLanguageModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Choose Language / اختر اللغة',
                style: AppTypography.fontBase.copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              _buildLanguageOption(
                ctx,
                title: 'English',
                subtitle: 'Default language',
                isSelected: !AppLocale.instance.isArabic,
                onTap: () {
                  AppLocale.instance.setLocale(const Locale('en'));
                  Navigator.of(ctx).pop();
                },
              ),
              const SizedBox(height: 10),
              _buildLanguageOption(
                ctx,
                title: 'العربية (Arabic)',
                subtitle: 'اللغة العربية مع دعم المحاذاة لليمين',
                isSelected: AppLocale.instance.isArabic,
                onTap: () {
                  AppLocale.instance.setLocale(const Locale('ar'));
                  Navigator.of(ctx).pop();
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLanguageOption(
    BuildContext context, {
    required String title,
    required String subtitle,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isSelected ? AppColors.shiftBg : AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected ? AppColors.primary : const Color(0xFFE5E7EB),
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: ListTile(
        onTap: onTap,
        title: Text(
          title,
          style: AppTypography.fontBase.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppColors.primary : AppColors.textPrimary,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: AppTypography.fontBase.copyWith(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
        trailing: isSelected
            ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
            : null,
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.logout_rounded, color: AppColors.announcementButton),
            const SizedBox(width: 8),
            Text(
              isAr ? 'تسجيل الخروج' : 'Log Out',
              style: AppTypography.fontBase.copyWith(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: Text(
          isAr
              ? 'هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟'
              : 'Are you sure you want to log out of Elaraby Connect?',
          style: AppTypography.fontBase.copyWith(fontSize: 14, color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              isAr ? 'إلغاء' : 'Cancel',
              style: const TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await ApiClient.instance.setToken(null);
              await LocalStore.instance.clearSession();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const GetStartedScreen()),
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.announcementButton,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(
              isAr ? 'تأكيد الخروج' : 'Log Out',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  void _showPrivacyPolicyModal(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.78,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.privacy_tip_rounded, color: AppColors.primary, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      isAr ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy & Terms',
                      style: AppTypography.fontBase.copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1, color: Color(0xFFEEEEEE)),
              const SizedBox(height: 12),
              Expanded(
                child: SingleChildScrollView(
                  child: Text(
                    isAr
                        ? '''مرحباً بك في تطبيق Elaraby Connect، المنصة الرسمية لخدمات موظفي مجموعة العربي. نحن نلتزم بأعلى معايير حماية الخصوصية وأمن البيانات.

1. جمع البيانات واستخدامها:
• يقوم التطبيق بجمع البيانات الوظيفية الأساسية مثل: الرقم القومي، كود الموظف، المصنع، القسم، وسجلات الإجازات والورديات.
• تُستخدم هذه البيانات حصرياً لتقديم الخدمات الإدارية، إشعارات الورديات، معالجة طلبات الموارد البشرية، وتسهيل حجز الرحلات.

2. أمان وتشفير المعلومات:
• يتم نقل كافة البيانات عبر اتصالات مشفرة بروتوكول HTTPS المشدد.
• يتم تأمين رموز الجلسة والمفاتيح الحساسة محلياً عبر تقنيات التشفير Hardware-backed (Android KeyStore و Apple Keychain).

3. مشاركة البيانات:
• لا يتم بيع أو مشاركة بياناتك الشخصية مع أي طرف ثالث تجاري أو إعلاني مطلقاً. البيانات مقتصرة تماماً على الأنظمة الداخلية لمجموعة العربي.

4. حقوق الموظف وحذف البيانات:
• يحق لك مراجعة بياناتك المسجلة أو طلب حذف/أرشفة حسابك عبر خيار "طلب حذف الحساب" في شاشة الملف الشخصي، وسيتم معالجة الطلب وفقاً للوائح العمل المنظمة.

لأي استفسارات قانونية أو فنية، يرجى التواصل مع إدارة تكنولوجيا المعلومات والموارد البشرية: workforce-support@elarabygroup.com'''
                        : '''Welcome to Elaraby Connect, the official workforce portal for Elaraby Group employees. We are strictly committed to safeguarding your privacy and personal data.

1. Data Collection & Usage:
• The application processes basic occupational data including: National ID, Employee Code, Factory, Department, vacation balances, and shift records.
• Data is strictly utilized for human resources self-service, shift scheduling notifications, and administrative request workflows.

2. Security & Encryption:
• All communication with servers is encrypted using enforced HTTPS/TLS protocols.
• Authentication tokens and sensitive keys are stored using hardware-backed cryptographic keystores (Android KeyStore and Apple Keychain).

3. Data Sharing:
• Your data is never sold, shared, or monetized with any third-party advertisers. All information stays strictly within authorized Elaraby Group systems.

4. Worker Rights & Account Deletion:
• You hold the right to review your data and request account deactivation/data deletion at any time via the "Request Account Deletion" option under your profile.

For privacy questions or support, contact HR & IT at workforce-support@elarabygroup.com''',
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 14,
                      height: 1.6,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(
                    isAr ? 'فهمت وأوافق' : 'Understood & Agree',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _confirmAccountDeletion(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: AppColors.announcementButton),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                isAr ? 'طلب حذف الحساب' : 'Request Account Deletion',
                style: AppTypography.fontBase.copyWith(fontSize: 18, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        content: Text(
          isAr
              ? 'تنبيه: هذا الإجراء يرسل طلباً رسمياً لإدارة الموارد البشرية لتجميد وحذف بيانات حسابك من التطبيق وإلغاء تسجيل الدخول على هذا الجهاز. هل تود المتابعة؟'
              : 'Notice: This sends a formal request to HR to deactivate your workforce account and erase access credentials on this device. Do you wish to proceed?',
          style: AppTypography.fontBase.copyWith(fontSize: 14, color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              isAr ? 'إلغاء' : 'Cancel',
              style: const TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              // Notify backend if connected
              try {
                await ApiClient.instance.post('/employee/delete-account', {});
              } catch (_) {}
              await ApiClient.instance.setToken(null);
              await LocalStore.instance.clearSession();
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    isAr
                        ? 'تم إرسال طلب الحذف وتسجيل الخروج بنجاح'
                        : 'Deletion request submitted. You have been logged out.',
                  ),
                  backgroundColor: AppColors.textPrimary,
                ),
              );
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const GetStartedScreen()),
                (route) => false,
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.announcementButton,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(
              isAr ? 'تأكيد الحذف' : 'Confirm Deletion',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
