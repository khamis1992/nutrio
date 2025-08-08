import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../../core/app_export.dart';

class SimilarMealsSection extends StatelessWidget {
  final List<Map<String, dynamic>> similarMeals;
  final Function(Map<String, dynamic>) onMealTap;

  const SimilarMealsSection({
    super.key,
    required this.similarMeals,
    required this.onMealTap,
  });

  @override
  Widget build(BuildContext context) {
    if (similarMeals.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 2.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header
          Row(
            children: [
              CustomIconWidget(
                iconName: 'recommend',
                color: AppTheme.lightTheme.colorScheme.primary,
                size: 5.w,
              ),
              SizedBox(width: 3.w),
              Text(
                'Similar Meals',
                style: AppTheme.lightTheme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.lightTheme.colorScheme.onSurface,
                ),
              ),
            ],
          ),

          SizedBox(height: 2.h),

          // Horizontal scrollable list
          SizedBox(
            height: 35.h,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.only(right: 2.w),
              itemCount: similarMeals.length,
              itemBuilder: (context, index) {
                final meal = similarMeals[index];
                return _SimilarMealCard(
                  meal: meal,
                  onTap: () => onMealTap(meal),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SimilarMealCard extends StatelessWidget {
  final Map<String, dynamic> meal;
  final VoidCallback onTap;

  const _SimilarMealCard({
    required this.meal,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = meal['name'] as String? ?? '';
    final image = meal['image'] as String? ?? '';
    final restaurant = meal['restaurant'] as String? ?? '';
    final calories = (meal['calories'] as num?)?.toInt() ?? 0;
    final protein = (meal['protein'] as num?)?.toDouble() ?? 0.0;
    final price = meal['price'] as String? ?? '';
    final rating = (meal['rating'] as num?)?.toDouble() ?? 0.0;

    return Container(
      width: 45.w,
      margin: EdgeInsets.only(right: 3.w),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(3.w),
        child: Container(
          decoration: BoxDecoration(
            color: AppTheme.lightTheme.colorScheme.surface,
            borderRadius: BorderRadius.circular(3.w),
            border: Border.all(
              color: AppTheme.lightTheme.dividerColor,
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: AppTheme.lightTheme.shadowColor,
                offset: const Offset(0, 2),
                blurRadius: 4,
                spreadRadius: 0,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Meal image
              ClipRRect(
                borderRadius: BorderRadius.vertical(top: Radius.circular(3.w)),
                child: SizedBox(
                  height: 20.h,
                  width: double.infinity,
                  child: image.isNotEmpty
                      ? CustomImageWidget(
                          imageUrl: image,
                          width: double.infinity,
                          height: 20.h,
                          fit: BoxFit.cover,
                        )
                      : Container(
                          color: AppTheme.lightTheme.colorScheme.primary
                              .withValues(alpha: 0.1),
                          child: Center(
                            child: CustomIconWidget(
                              iconName: 'restaurant_menu',
                              color: AppTheme.lightTheme.colorScheme.primary,
                              size: 8.w,
                            ),
                          ),
                        ),
                ),
              ),

              // Meal info
              Expanded(
                child: Padding(
                  padding: EdgeInsets.all(3.w),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Meal name
                      Text(
                        name,
                        style:
                            AppTheme.lightTheme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppTheme.lightTheme.colorScheme.onSurface,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),

                      SizedBox(height: 1.h),

                      // Restaurant name
                      if (restaurant.isNotEmpty)
                        Text(
                          restaurant,
                          style:
                              AppTheme.lightTheme.textTheme.bodySmall?.copyWith(
                            color: AppTheme.lightTheme.colorScheme.onSurface
                                .withValues(alpha: 0.7),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),

                      const Spacer(),

                      // Nutrition info
                      Row(
                        children: [
                          _NutritionChip(
                            label: '${calories}cal',
                            color: AppTheme.errorColor,
                          ),
                          SizedBox(width: 1.w),
                          _NutritionChip(
                            label: '${protein.toStringAsFixed(0)}g',
                            color: AppTheme.lightTheme.colorScheme.primary,
                          ),
                        ],
                      ),

                      SizedBox(height: 1.h),

                      // Price and rating
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (price.isNotEmpty)
                            Text(
                              price,
                              style: AppTheme.lightTheme.textTheme.titleSmall
                                  ?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppTheme.lightTheme.colorScheme.primary,
                              ),
                            ),
                          Row(
                            children: [
                              CustomIconWidget(
                                iconName: 'star',
                                color: Colors.amber,
                                size: 3.w,
                              ),
                              SizedBox(width: 0.5.w),
                              Text(
                                rating.toStringAsFixed(1),
                                style: AppTheme.lightTheme.textTheme.labelSmall
                                    ?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color:
                                      AppTheme.lightTheme.colorScheme.onSurface,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NutritionChip extends StatelessWidget {
  final String label;
  final Color color;

  const _NutritionChip({
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 2.w, vertical: 0.5.h),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(1.h),
        border: Border.all(
          color: color.withValues(alpha: 0.3),
          width: 0.5,
        ),
      ),
      child: Text(
        label,
        style: AppTheme.lightTheme.textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 9.sp,
        ),
      ),
    );
  }
}
