import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../../../services/localization_service.dart';
import '../../../services/delivery_service.dart';

class NextDeliveryCard extends StatefulWidget {
  final VoidCallback? onTap;

  const NextDeliveryCard({
    Key? key,
    this.onTap,
  }) : super(key: key);

  @override
  State<NextDeliveryCard> createState() => _NextDeliveryCardState();
}

class _NextDeliveryCardState extends State<NextDeliveryCard> {
  Map<String, dynamic>? _nextDelivery;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNextDelivery();
  }

  Future<void> _loadNextDelivery() async {
    try {
      final nextDelivery = await DeliveryService.instance.getNextDelivery();
      if (mounted) {
        setState(() {
          _nextDelivery = nextDelivery;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isArabic = LocalizationService.instance.isArabic;

    if (_isLoading) {
      return Container(
        margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
        height: 12.h,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF4CD1A1).withAlpha(26),
              const Color(0xFF4CD1A1).withAlpha(13),
            ],
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFF4CD1A1).withAlpha(51),
            width: 1,
          ),
        ),
        child: const Center(
          child: CircularProgressIndicator(
            color: Color(0xFF4CD1A1),
          ),
        ),
      );
    }

    if (_nextDelivery == null) {
      return const SizedBox
          .shrink(); // Don't show card if no delivery scheduled
    }

    final deliveryTime = _nextDelivery!['delivery_scheduled_at'] as String?;
    final windowStart = _nextDelivery!['delivery_window_start'] as String?;
    final windowEnd = _nextDelivery!['delivery_window_end'] as String?;
    final restaurantName =
        _nextDelivery!['restaurants']?['name'] as String? ?? 'Restaurant';

    final timeUntil =
        DeliveryService.instance.getTimeUntilDelivery(deliveryTime);
    final timeWindow =
        DeliveryService.instance.formatDeliveryWindow(windowStart, windowEnd);

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF4CD1A1).withAlpha(26),
            const Color(0xFF4CD1A1).withAlpha(13),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF4CD1A1).withAlpha(51),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            offset: const Offset(0, 2),
            blurRadius: 8,
          ),
        ],
      ),
      child: InkWell(
        onTap: widget.onTap,
        borderRadius: BorderRadius.circular(12),
        child: Row(
          textDirection: isArabic ? TextDirection.rtl : TextDirection.ltr,
          children: [
            Container(
              padding: EdgeInsets.all(2.w),
              decoration: BoxDecoration(
                color: const Color(0xFF4CD1A1).withAlpha(26),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.local_shipping_outlined,
                color: const Color(0xFF4CD1A1),
                size: 20.sp,
              ),
            ),
            SizedBox(width: 3.w),
            Expanded(
              child: Column(
                crossAxisAlignment: isArabic
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  Text(
                    localizations.nextDeliveryTime,
                    style: TextStyle(
                      fontSize: 12.sp,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF4CD1A1),
                    ),
                    textDirection:
                        isArabic ? TextDirection.rtl : TextDirection.ltr,
                  ),
                  SizedBox(height: 0.5.h),
                  Text(
                    timeUntil.isNotEmpty
                        ? '${localizations.inTime} $timeUntil'
                        : restaurantName,
                    style: TextStyle(
                      fontSize: 14.sp,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textDirection:
                        isArabic ? TextDirection.rtl : TextDirection.ltr,
                  ),
                  if (timeWindow.isNotEmpty) ...[
                    SizedBox(height: 0.5.h),
                    Text(
                      timeWindow,
                      style: TextStyle(
                        fontSize: 12.sp,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey[600],
                      ),
                      textDirection:
                          isArabic ? TextDirection.rtl : TextDirection.ltr,
                    ),
                  ],
                ],
              ),
            ),
            if (widget.onTap != null)
              Icon(
                isArabic ? Icons.arrow_back_ios : Icons.arrow_forward_ios,
                size: 16.sp,
                color: Colors.grey[400],
              ),
          ],
        ),
      ),
    );
  }
}
