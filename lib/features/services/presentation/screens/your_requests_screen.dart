import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/requests_store.dart';
import 'hr_request_screen.dart';

class YourRequestsScreen extends StatefulWidget {
  const YourRequestsScreen({super.key});

  @override
  State<YourRequestsScreen> createState() => _YourRequestsScreenState();
}

class _YourRequestsScreenState extends State<YourRequestsScreen> {
  String _selectedFilter = 'All';
  final List<String> _filters = ['All', 'In Review', 'Approved', 'Rejected'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.scaffoldBackground,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          'Your Requests',
          style: AppTypography.sectionHeading.copyWith(fontSize: 18),
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filter Pills
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: _filters.map((filter) {
                    final isSelected = _selectedFilter == filter;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedFilter = filter;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primary : AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? AppColors.primary : Colors.transparent,
                            ),
                          ),
                          child: Text(
                            filter,
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isSelected ? Colors.white : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

            // Dynamic Requests List
            Expanded(
              child: ListenableBuilder(
                listenable: RequestsStore.instance,
                builder: (context, _) {
                  final all = RequestsStore.instance.allRequests;
                  List<EmployeeRequest> filtered;
                  if (_selectedFilter == 'In Review') {
                    filtered = RequestsStore.instance.inReviewRequests;
                  } else if (_selectedFilter == 'Approved') {
                    filtered = RequestsStore.instance.approvedRequests;
                  } else if (_selectedFilter == 'Rejected') {
                    filtered = RequestsStore.instance.rejectedRequests;
                  } else {
                    filtered = all;
                  }

                  if (filtered.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inbox_outlined, size: 48, color: AppColors.textSecondary.withValues(alpha: 0.5)),
                          const SizedBox(height: 12),
                          Text(
                            'No $_selectedFilter requests found',
                            style: AppTypography.fontBase.copyWith(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final req = filtered[index];
                      return _buildDynamicRequestCard(context, req);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDynamicRequestCard(BuildContext context, EmployeeRequest req) {
    Color dotColor;
    Color pillBg;
    Color pillTextColor;

    switch (req.status) {
      case RequestStatus.inReview:
        dotColor = AppColors.primary;
        pillBg = AppColors.shiftBg;
        pillTextColor = AppColors.primary;
        break;
      case RequestStatus.approved:
        dotColor = AppColors.statusGreen;
        pillBg = const Color(0xFFEAF8F0);
        pillTextColor = AppColors.statusGreen;
        break;
      case RequestStatus.rejected:
        dotColor = AppColors.announcementButton;
        pillBg = AppColors.announcementBg;
        pillTextColor = AppColors.announcementButton;
        break;
    }

    return _buildCardWrapper(
      dotColor: dotColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                req.title,
                style: AppTypography.fontBase.copyWith(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              _buildStatusPill(req.statusLabel, bg: pillBg, text: pillTextColor),
            ],
          ),
          const SizedBox(height: 2),
          Text('Ref: ${req.refNumber}', style: AppTypography.dateSubtitle.copyWith(fontSize: 12)),
          const SizedBox(height: 14),

          // Detail lines
          ...req.details.entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: _buildDetailRow(e.key, e.value),
              )),

          const SizedBox(height: 8),
          Text(
            req.summary,
            style: AppTypography.fontBase.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: req.status == RequestStatus.rejected
                  ? AppColors.announcementButton
                  : AppColors.shiftTextBlue,
            ),
          ),

          if (req.rejectionReason != null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.announcementBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                req.rejectionReason!,
                style: AppTypography.fontBase.copyWith(
                  fontSize: 13,
                  color: AppColors.announcementButton,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],

          const SizedBox(height: 14),

          // Actions based on status
          if (req.status == RequestStatus.inReview)
            SizedBox(
              width: double.infinity,
              height: 38,
              child: ElevatedButton(
                onPressed: () => _showRequestActions(context, req),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.shiftBg,
                  foregroundColor: AppColors.primary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Actions', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
            )
          else if (req.status == RequestStatus.approved)
            SizedBox(
              width: double.infinity,
              height: 40,
              child: ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('${req.refNumber}.pdf downloaded successfully!'),
                      backgroundColor: AppColors.statusGreen,
                    ),
                  );
                },
                icon: const Icon(Icons.file_download_outlined, color: Colors.white, size: 18),
                label: const Text('Download PDF', style: TextStyle(fontWeight: FontWeight.w600)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.statusGreen,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            )
          else if (req.status == RequestStatus.rejected)
            Center(
              child: TextButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const HrRequestScreen()),
                  );
                },
                icon: const Icon(Icons.refresh_rounded, size: 18, color: AppColors.primary),
                label: Text(
                  'Resubmit Request',
                  style: AppTypography.fontBase.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showRequestActions(BuildContext context, EmployeeRequest req) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
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
              req.title,
              style: AppTypography.fontBase.copyWith(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            Text('Reference: ${req.refNumber}', style: AppTypography.dateSubtitle.copyWith(fontSize: 12)),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.timeline_rounded, color: AppColors.primary),
              title: const Text('View Approval Timeline', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              subtitle: Text('Reviewer: ${req.reviewer ?? 'HR'}', style: const TextStyle(fontSize: 12)),
              onTap: () {
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Request is currently with: ${req.reviewer ?? 'Line Manager'}')),
                );
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.cancel_outlined, color: Color(0xFFDC2626)),
              title: const Text('Cancel Request', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600, fontSize: 14)),
              subtitle: const Text('Withdraw this submission immediately', style: TextStyle(fontSize: 12)),
              onTap: () {
                RequestsStore.instance.cancelRequest(req.id);
                Navigator.of(ctx).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Request has been cancelled.')),
                );
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildCardWrapper({required Color dotColor, required Widget child}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 18, right: 10),
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x06000000),
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: child,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill(String label, {required Color bg, required Color text}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.fontBase.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: text,
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.fontBase.copyWith(fontSize: 13, color: AppColors.textSecondary)),
        Text(value, style: AppTypography.fontBase.copyWith(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      ],
    );
  }
}
