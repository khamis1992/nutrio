import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../core/app_export.dart';

class RestaurantsEmptyState extends StatelessWidget {
  final VoidCallback? onClearFilters;
  final String? title;
  final String? subtitle;
  final String? buttonText;
  final VoidCallback? onButtonPressed;

  const RestaurantsEmptyState({
    super.key,
    this.onClearFilters,
    this.title,
    this.subtitle,
    this.buttonText,
    this.onButtonPressed,
  });

  const RestaurantsEmptyState.noResults({
    super.key,
    required VoidCallback this.onClearFilters,
  })  : title = 'No restaurants found',
        subtitle =
            'Try adjusting your search or filters to find more restaurants',
        buttonText = 'Clear Filters',
        onButtonPressed = null;

  const RestaurantsEmptyState.noRestaurants({
    super.key,
    VoidCallback? this.onButtonPressed,
  })  : title = 'No restaurants available',
        subtitle = 'Check back later for new restaurant partners',
        buttonText = 'Refresh',
        onClearFilters = null;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(8.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 30.w,
              height: 30.w,
              decoration: BoxDecoration(
                color: AppTheme.lightTheme.colorScheme.primary
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(15.w),
              ),
              child: CustomIconWidget(
                iconName: 'restaurant',
                color: AppTheme.lightTheme.colorScheme.primary,
                size: 48,
              ),
            ),
            SizedBox(height: 4.h),
            Text(
              title ?? 'No restaurants found',
              style: TextStyle(
                fontSize: 20.sp,
                fontWeight: FontWeight.w600,
                color: AppTheme.lightTheme.colorScheme.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 2.h),
            Text(
              subtitle ?? 'Try adjusting your search or filters',
              style: TextStyle(
                fontSize: 14.sp,
                fontWeight: FontWeight.w400,
                color: AppTheme.textSecondaryLight,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 4.h),
            if (onClearFilters != null || onButtonPressed != null)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onClearFilters ?? onButtonPressed,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.lightTheme.colorScheme.primary,
                    foregroundColor: AppTheme.lightTheme.colorScheme.onPrimary,
                    padding: EdgeInsets.symmetric(vertical: 2.h),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    buttonText ?? 'Clear Filters',
                    style: TextStyle(
                      fontSize: 16.sp,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
