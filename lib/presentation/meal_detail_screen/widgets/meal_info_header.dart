import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../../core/app_export.dart';

class MealInfoHeader extends StatelessWidget {
  final String mealName;
  final String restaurantName;
  final double rating;
  final int reviewCount;
  final bool isFavorite;
  final VoidCallback onFavoriteToggle;

  const MealInfoHeader({
    super.key,
    required this.mealName,
    required this.restaurantName,
    required this.rating,
    required this.reviewCount,
    required this.isFavorite,
    required this.onFavoriteToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(4.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Meal name and favorite button
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  mealName,
                  style: AppTheme.lightTheme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.lightTheme.colorScheme.onSurface,
                  ),
                ),
              ),
              SizedBox(width: 3.w),
              GestureDetector(
                onTap: onFavoriteToggle,
                child: Container(
                  padding: EdgeInsets.all(2.w),
                  decoration: BoxDecoration(
                    color: isFavorite
                        ? AppTheme.errorColor.withValues(alpha: 0.1)
                        : AppTheme.lightTheme.colorScheme.surface,
                    borderRadius: BorderRadius.circular(2.w),
                    border: Border.all(
                      color: isFavorite
                          ? AppTheme.errorColor
                          : AppTheme.lightTheme.dividerColor,
                      width: 1,
                    ),
                  ),
                  child: CustomIconWidget(
                    iconName: isFavorite ? 'favorite' : 'favorite_border',
                    color: isFavorite
                        ? AppTheme.errorColor
                        : AppTheme.lightTheme.colorScheme.onSurface
                            .withValues(alpha: 0.6),
                    size: 5.w,
                  ),
                ),
              ),
            ],
          ),

          SizedBox(height: 2.h),

          // Restaurant badge
          Container(
            padding: EdgeInsets.symmetric(horizontal: 3.w, vertical: 1.h),
            decoration: BoxDecoration(
              color: AppTheme.lightTheme.colorScheme.primary
                  .withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(1.5.h),
              border: Border.all(
                color: AppTheme.lightTheme.colorScheme.primary
                    .withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CustomIconWidget(
                  iconName: 'restaurant',
                  color: AppTheme.lightTheme.colorScheme.primary,
                  size: 4.w,
                ),
                SizedBox(width: 2.w),
                Text(
                  restaurantName,
                  style: AppTheme.lightTheme.textTheme.labelMedium?.copyWith(
                    color: AppTheme.lightTheme.colorScheme.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: 2.h),

          // Rating and reviews
          Row(
            children: [
              ...List.generate(5, (index) {
                return CustomIconWidget(
                  iconName: index < rating.floor() ? 'star' : 'star_border',
                  color: index < rating.floor()
                      ? Colors.amber
                      : AppTheme.lightTheme.colorScheme.onSurface
                          .withValues(alpha: 0.3),
                  size: 4.w,
                );
              }),
              SizedBox(width: 2.w),
              Text(
                rating.toStringAsFixed(1),
                style: AppTheme.lightTheme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.lightTheme.colorScheme.onSurface,
                ),
              ),
              SizedBox(width: 1.w),
              Text(
                '($reviewCount reviews)',
                style: AppTheme.lightTheme.textTheme.labelMedium?.copyWith(
                  color: AppTheme.lightTheme.colorScheme.onSurface
                      .withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
