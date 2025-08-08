import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../../core/app_export.dart';

class MealsEmptyState extends StatelessWidget {
  final String title;
  final String subtitle;
  final String actionText;
  final VoidCallback onActionPressed;
  final bool showClearFilters;

  const MealsEmptyState({
    super.key,
    required this.title,
    required this.subtitle,
    required this.actionText,
    required this.onActionPressed,
    this.showClearFilters = false,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(8.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildIllustration(),
            SizedBox(height: 4.h),
            Text(
              title,
              style: TextStyle(
                fontSize: 20.sp,
                fontWeight: FontWeight.w600,
                color: AppTheme.lightTheme.colorScheme.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 2.h),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 14.sp,
                fontWeight: FontWeight.w400,
                color: AppTheme.textSecondaryLight,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 4.h),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onActionPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.lightTheme.colorScheme.primary,
                  foregroundColor: AppTheme.lightTheme.colorScheme.onPrimary,
                  padding: EdgeInsets.symmetric(vertical: 2.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  actionText,
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            if (showClearFilters) ...[
              SizedBox(height: 2.h),
              TextButton(
                onPressed: () {
                  // Clear filters functionality would be handled by parent
                  onActionPressed();
                },
                child: Text(
                  'Clear All Filters',
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.lightTheme.colorScheme.primary,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildIllustration() {
    return Container(
      width: 40.w,
      height: 40.w,
      decoration: BoxDecoration(
        color: AppTheme.lightTheme.colorScheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20.w),
      ),
      child: Center(
        child: CustomIconWidget(
          iconName: 'restaurant_menu',
          color: AppTheme.lightTheme.colorScheme.primary,
          size: 60,
        ),
      ),
    );
  }

  // Factory methods for different empty states
  static MealsEmptyState noResults({
    required VoidCallback onClearFilters,
  }) {
    return MealsEmptyState(
      title: 'No meals found',
      subtitle:
          'We couldn\'t find any meals matching your search criteria. Try adjusting your filters or search terms.',
      actionText: 'Clear Filters',
      onActionPressed: onClearFilters,
      showClearFilters: true,
    );
  }

  static MealsEmptyState noMeals({
    required VoidCallback onRefresh,
  }) {
    return MealsEmptyState(
      title: 'No meals available',
      subtitle:
          'It looks like there are no meals available right now. Please check back later or try refreshing.',
      actionText: 'Refresh',
      onActionPressed: onRefresh,
    );
  }

  static MealsEmptyState networkError({
    required VoidCallback onRetry,
  }) {
    return MealsEmptyState(
      title: 'Connection Error',
      subtitle:
          'Unable to load meals. Please check your internet connection and try again.',
      actionText: 'Try Again',
      onActionPressed: onRetry,
    );
  }
}
