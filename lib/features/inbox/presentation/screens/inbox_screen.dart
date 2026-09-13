import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/utils/app_network_image.dart';
import 'inbox_ids.dart';
import '../../../../core/navigation/app_navigation.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  String _selectedFilter = 'inbox_filter_all';
  List<ServerNotification> _serverNotes = [];

  @override
  void initState() {
    super.initState();
    _loadFromServer();
  }

  /// Pulls HR notifications and the latest request decisions; silently skips
  /// when the server is unreachable.
  Future<void> _loadFromServer() async {
    final notes = await Backend.instance.fetchInbox();
    if (!mounted) return;
    if (notes != null) {
      setState(() => _serverNotes = notes);
      InboxIds.instance.registerServerNotifications(notes);
      await Backend.instance.syncRequests();
    }
  }

  final List<String> _filters = [
    'inbox_filter_all',
    'inbox_filter_announcements',
    'inbox_filter_approvals',
    'inbox_filter_benefits'
  ];

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      body: Column(
        children: [
          // Pinned App Bar
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
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  AppLocale.tr('inbox_title'),
                  style: AppTypography.welcomeTitle,
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      await InboxIds.instance.markAllRead();
                      await Backend.instance.markInboxRead();
                      if (mounted) await _loadFromServer();
                      messenger.showSnackBar(
                        SnackBar(
                          content: Text(AppLocale.tr('inbox_marked_all')),
                          backgroundColor: AppColors.primary,
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Text(
                        AppLocale.tr('inbox_mark_all_read'),
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Scrollable Notifications List (Virtualized)
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadFromServer,
              color: AppColors.primary,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                    sliver: SliverToBoxAdapter(
                      child: _buildFilterBar(),
                    ),
                  ),
                  if (_serverNotes.isNotEmpty &&
                      (_selectedFilter == 'inbox_filter_all' ||
                          _selectedFilter == 'inbox_filter_announcements')) ...[
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      sliver: SliverToBoxAdapter(
                        child:
                            _buildSectionLabel(AppLocale.tr('inbox_from_hr')),
                      ),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) =>
                              _buildServerCard(_serverNotes[index]),
                          childCount: _serverNotes.length,
                        ),
                      ),
                    ),
                  ],
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate(
                        _buildDemoTimeline(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: _filters.map((filter) {
          final isSelected = _selectedFilter == filter;
          final displayFilter = AppLocale.tr(filter);

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _selectedFilter = filter),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  displayFilter,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  List<Widget> _buildDemoTimeline() {
    final widgets = <Widget>[];
    final showAnnouncements = _selectedFilter == 'inbox_filter_all' ||
        _selectedFilter == 'inbox_filter_announcements';
    final showApprovals = _selectedFilter == 'inbox_filter_all' ||
        _selectedFilter == 'inbox_filter_approvals';
    final showBenefits = _selectedFilter == 'inbox_filter_all' ||
        _selectedFilter == 'inbox_filter_benefits';

    if (showAnnouncements || showApprovals) {
      widgets.add(
          _buildSectionLabel(AppLocale.instance.isArabic ? 'اليوم' : 'Today'));
      widgets.add(const SizedBox(height: 10));
      if (showAnnouncements) {
        widgets.add(_buildNotificationCard(
          icon: Icons.campaign_rounded,
          iconBg: const Color(0xFFFEECEC),
          iconColor: AppColors.announcementButton,
          title: AppLocale.instance.isArabic
              ? 'سياسة الورديات الجديدة'
              : 'New Shift Policy',
          subtitle: AppLocale.instance.isArabic
              ? 'تبدأ في 10 أغسطس — اضغط للقراءة'
              : 'Starting Aug 10 — tap to read',
          time: '9:12 AM',
          hasUnreadDot: !InboxIds.instance.isRead(InboxIds.shiftPolicy),
          onTap: () {
            InboxIds.instance.markRead(InboxIds.shiftPolicy);
            AppNavigation.toAnnouncementDetail(context);
          },
        ));
        widgets.add(const SizedBox(height: 10));
      }
      if (showApprovals) {
        widgets.add(_buildNotificationCard(
          icon: Icons.check_circle_rounded,
          iconBg: AppColors.shiftBg,
          iconColor: AppColors.primary,
          title: AppLocale.instance.isArabic
              ? 'تمت الموافقة على طلب الإجازة'
              : 'Leave Request Approved',
          subtitle: AppLocale.instance.isArabic
              ? 'تم تأكيد إجازة 20 – 22 أغسطس'
              : 'Aug 20 – 22 confirmed',
          time: '9:12 AM',
          hasUnreadDot: !InboxIds.instance.isRead(InboxIds.leaveApproved),
          onTap: () {
            InboxIds.instance.markRead(InboxIds.leaveApproved);
            AppNavigation.toYourRequests(context);
          },
        ));
        widgets.add(const SizedBox(height: 10));
      }
      widgets.add(const SizedBox(height: 14));
    }

    if (showBenefits || showApprovals) {
      widgets.add(_buildSectionLabel(
          AppLocale.instance.isArabic ? 'أمس' : 'Yesterday'));
      widgets.add(const SizedBox(height: 10));
      if (showBenefits) {
        widgets.add(_buildNotificationCard(
          icon: Icons.local_offer_rounded,
          iconBg: const Color(0xFFFEF3E2),
          iconColor: const Color(0xFFD97706),
          title: AppLocale.instance.isArabic ? 'خصم جديد متاح' : 'New Discount',
          subtitle: AppLocale.instance.isArabic
              ? 'خصم 15% لدى صيدليات سيف'
              : '15% off at Seif Pharmacies',
          time: '4:04 PM',
          hasUnreadDot: !InboxIds.instance.isRead(InboxIds.newDiscount),
          onTap: () {
            InboxIds.instance.markRead(InboxIds.newDiscount);
            AppNavigation.toBenefitDetail(
              context,
              title: 'Seif Pharmacies',
              discount: '15% OFF',
              category: 'Health Care',
              imagePath: 'assets/images/benefit_pharmacy.png',
              validity: 'Valid through 30 Jun 2027',
            );
          },
        ));
        widgets.add(const SizedBox(height: 10));
      }
      if (showApprovals) {
        widgets.add(_buildNotificationCard(
          icon: Icons.payments_rounded,
          iconBg: const Color(0xFFEAF8F0),
          iconColor: AppColors.statusGreen,
          title: AppLocale.instance.isArabic
              ? 'مفردات المرتب متاحة'
              : 'Salary Slip Available',
          subtitle: AppLocale.instance.isArabic
              ? 'راتب شهر يوليو جاهز للاطلاع'
              : 'July payroll is ready',
          time: '11:22 AM',
          hasUnreadDot: !InboxIds.instance.isRead(InboxIds.salarySlip),
          onTap: () {
            InboxIds.instance.markRead(InboxIds.salarySlip);
            AppNavigation.toSalarySlip(context);
          },
        ));
        widgets.add(const SizedBox(height: 10));
      }
    }
    return widgets;
  }

  Widget _buildServerCard(ServerNotification note) {
    final time = TimeOfDay.fromDateTime(note.createdAt).format(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: AppColors.shiftBg,
                borderRadius: BorderRadius.all(Radius.circular(12)),
              ),
              child: const Icon(Icons.badge_outlined,
                  color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (note.imageUrl != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: AppNetworkImage(
                        imageUrl: ApiClient.instance.resolveUrl(note.imageUrl!),
                        width: double.infinity,
                        height: 170,
                        fit: BoxFit.cover,
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  Text(
                    note.title,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    note.body,
                    style: AppTypography.fontBase.copyWith(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  time,
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 11,
                    color: note.read
                        ? AppColors.textSecondary
                        : const Color(0xFFB13A3A),
                    fontWeight: note.read ? FontWeight.w400 : FontWeight.w600,
                  ),
                ),
                if (!note.read) ...[
                  const SizedBox(height: 6),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: Color(0xFFD64545),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Text(
      label,
      style: AppTypography.fontBase.copyWith(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
      ),
    );
  }

  Widget _buildNotificationCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String time,
    required bool hasUnreadDot,
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
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
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
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: AppTypography.fontBase.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          time,
                          style: AppTypography.fontBase.copyWith(
                            fontSize: 11,
                            color: hasUnreadDot
                                ? const Color(0xFFB13A3A)
                                : AppColors.textSecondary,
                            fontWeight: hasUnreadDot
                                ? FontWeight.w600
                                : FontWeight.w400,
                          ),
                        ),
                        if (hasUnreadDot) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFFD64545),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
