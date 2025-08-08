import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../../../models/subscription_model.dart';
import '../../../routes/app_routes.dart';

class SubscriptionStatusCard extends StatelessWidget {
  final SubscriptionModel? subscription;

  const SubscriptionStatusCard({
    Key? key,
    required this.subscription,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (subscription == null || subscription!.active != true) {
      return _buildNoSubscriptionCard(context);
    }

    return _buildActiveSubscriptionCard(context);
  }

  Widget _buildNoSubscriptionCard(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Container(
      margin: EdgeInsets.symmetric(vertical: 2.h),
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2E7D32), Color(0xFF4CAF50)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(26),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.stars,
                color: Colors.white,
                size: 6.w,
              ),
              SizedBox(width: 3.w),
              Text(
                localizations.noActivePlan,
                style: GoogleFonts.inter(
                  fontSize: 18.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          SizedBox(height: 2.h),
          Text(
            localizations.startHealthyJourney,
            style: GoogleFonts.inter(
              fontSize: 14.sp,
              color: Colors.white.withAlpha(230),
            ),
          ),
          SizedBox(height: 2.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    localizations.fromQrPerMonth,
                    style: GoogleFonts.inter(
                      fontSize: 16.sp,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    localizations.healthyMealPlans,
                    style: GoogleFonts.inter(
                      fontSize: 12.sp,
                      color: Colors.white.withAlpha(204),
                    ),
                  ),
                ],
              ),
              ElevatedButton(
                onPressed: () =>
                    Navigator.pushNamed(context, AppRoutes.subscription),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF2E7D32),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
                child: Text(
                  localizations.subscribe,
                  style: GoogleFonts.inter(
                    fontSize: 12.sp,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActiveSubscriptionCard(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final daysLeft =
        subscription!.endDate?.difference(DateTime.now()).inDays ?? 0;
    final isExpiringSoon = daysLeft <= 7;

    return Container(
      margin: EdgeInsets.symmetric(vertical: 2.h),
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: const Color(0xFFF6F6F6),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(26),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
        border:
            isExpiringSoon ? Border.all(color: Colors.orange, width: 2) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.verified,
                color: const Color(0xFF2E7D32),
                size: 6.w,
              ),
              SizedBox(width: 3.w),
              Text(
                '${subscription!.planType ?? localizations.activePlan} ${localizations.activePlan}',
                style: GoogleFonts.inter(
                  fontSize: 18.sp,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2E7D32),
                ),
              ),
              const Spacer(),
              if (isExpiringSoon)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.orange,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    localizations.expiresSoon,
                    style: GoogleFonts.inter(
                      fontSize: 10.sp,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
          SizedBox(height: 2.h),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.validUntil,
                      style: GoogleFonts.inter(
                        fontSize: 12.sp,
                        color: Colors.grey[600],
                      ),
                    ),
                    Text(
                      subscription!.endDate != null
                          ? _formatDate(subscription!.endDate!, localizations)
                          : localizations.unknown,
                      style: GoogleFonts.inter(
                        fontSize: 14.sp,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
              if (subscription!.includesGym == true)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2E7D32).withAlpha(26),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.fitness_center,
                        size: 4.w,
                        color: const Color(0xFF2E7D32),
                      ),
                      SizedBox(width: 1.w),
                      Text(
                        localizations.gymAccessIncluded,
                        style: GoogleFonts.inter(
                          fontSize: 10.sp,
                          color: const Color(0xFF2E7D32),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          SizedBox(height: 2.h),
          Row(
            children: [
              Text(
                '$daysLeft ${localizations.daysRemaining}',
                style: GoogleFonts.inter(
                  fontSize: 14.sp,
                  color: isExpiringSoon ? Colors.orange : Colors.grey[600],
                  fontWeight:
                      isExpiringSoon ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: () =>
                    Navigator.pushNamed(context, AppRoutes.subscription),
                child: Text(
                  localizations.managePlan,
                  style: GoogleFonts.inter(
                    fontSize: 12.sp,
                    color: const Color(0xFF2E7D32),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date, AppLocalizations localizations) {
    final months = [
      localizations.jan,
      localizations.feb,
      localizations.mar,
      localizations.apr,
      localizations.may,
      localizations.jun,
      localizations.jul,
      localizations.aug,
      localizations.sep,
      localizations.oct,
      localizations.nov,
      localizations.dec
    ];

    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}
