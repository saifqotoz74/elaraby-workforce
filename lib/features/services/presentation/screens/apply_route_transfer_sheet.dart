import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/localization/app_locale.dart';
import '../../../../core/network/backend.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../controllers/transport_controller.dart';
import 'package:elaraby_workforce/features/services/data/transport_model.dart';

class ApplyRouteTransferSheet extends ConsumerStatefulWidget {
  final List<BusRoute> routes;
  final String? currentRouteId;

  const ApplyRouteTransferSheet({
    super.key,
    required this.routes,
    this.currentRouteId,
  });

  static Future<bool?> show(
    BuildContext context, {
    required List<BusRoute> routes,
    String? currentRouteId,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ApplyRouteTransferSheet(
        routes: routes,
        currentRouteId: currentRouteId,
      ),
    );
  }

  @override
  ConsumerState<ApplyRouteTransferSheet> createState() => _ApplyRouteTransferSheetState();
}

class _ApplyRouteTransferSheetState extends ConsumerState<ApplyRouteTransferSheet> {
  late BusRoute _selectedRoute;
  BusStop? _selectedStop;
  final TextEditingController _reasonCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _selectedRoute = widget.routes.firstWhere(
      (r) => r.id != widget.currentRouteId,
      orElse: () => widget.routes.first,
    );
    if (_selectedRoute.stops.isNotEmpty) {
      _selectedStop = _selectedRoute.stops.first;
    }
    _reasonCtrl.text = 'تبديل وردية مع زميل / عمل إضافي بالخط';
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitTransfer() async {
    if (_selectedStop == null) return;
    setState(() => _submitting = true);

    final today = DateTime.now();
    final dateStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';

    final success = await Backend.instance.requestRouteTransfer(
      targetRouteId: _selectedRoute.id,
      targetStopId: _selectedStop!.id,
      date: dateStr,
      reason: _reasonCtrl.text.trim(),
    );

    setState(() => _submitting = false);

    if (mounted) {
      if (success) {
        ref.read(myCommuteProvider.notifier).loadCommute();
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocale.instance.isArabic
                  ? 'تم تأكيد تحويل خط الأتوبيس بنجاح'
                  : 'Bus route transfer confirmed successfully',
            ),
            backgroundColor: const Color(0xFF16A34A),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              AppLocale.instance.isArabic
                  ? 'تعذر تأكيد تحويل الخط، يرجى المحاولة ثانية'
                  : 'Failed to submit route transfer',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAr = AppLocale.instance.isArabic;

    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 16,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 48,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.directions_bus_filled, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      AppLocale.tr('request_transfer_btn'),
                      style: AppTypography.welcomeTitle.copyWith(fontSize: 18),
                    ),
                    Text(
                      isAr ? 'للورديات البديلة والعمل الإضافي' : 'For shift swaps & overtime commute',
                      style: AppTypography.bodySmall,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 20),

          Expanded(
            child: ListView(
              children: [
                // Route selector
                Text(
                  isAr ? 'اختر خط الأتوبيس الجديد:' : 'Select Target Bus Line:',
                  style: AppTypography.labelBold,
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<BusRoute>(
                      isExpanded: true,
                      value: _selectedRoute,
                      items: widget.routes.map((r) {
                        return DropdownMenuItem<BusRoute>(
                          value: r,
                          child: Text(
                            r.localizedName(isAr),
                            style: AppTypography.bodyMedium,
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _selectedRoute = val;
                            if (val.stops.isNotEmpty) {
                              _selectedStop = val.stops.first;
                            }
                          });
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                // Stop selector
                Text(
                  isAr ? 'اختر محطة الركوب:' : 'Select Pickup Stop:',
                  style: AppTypography.labelBold,
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<BusStop>(
                      isExpanded: true,
                      value: _selectedStop,
                      items: _selectedRoute.stops.map((s) {
                        return DropdownMenuItem<BusStop>(
                          value: s,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(s.localizedName(isAr), style: AppTypography.bodyMedium),
                              Text(s.scheduledTime, style: AppTypography.bodySmall.copyWith(color: AppColors.primary)),
                            ],
                          ),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedStop = val);
                        }
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                // Driver & Bus Info card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(0xFFE2E8F0),
                        child: Icon(Icons.person, color: AppColors.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selectedRoute.driver.localizedName(isAr),
                              style: AppTypography.labelBold,
                            ),
                            Text(
                              '${_selectedRoute.busModel} • ${_selectedRoute.vehiclePlate}',
                              style: AppTypography.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Reason input
                Text(
                  AppLocale.tr('transfer_reason_label'),
                  style: AppTypography.labelBold,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _reasonCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: isAr ? 'أدخل سبب التحويل...' : 'Reason for transfer...',
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Submit Button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _submitting ? null : _submitTransfer,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text(
                      AppLocale.tr('submit_transfer_request'),
                      style: AppTypography.buttonText,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
