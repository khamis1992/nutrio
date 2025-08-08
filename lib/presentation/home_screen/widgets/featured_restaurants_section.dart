import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:sizer/sizer.dart';

import '../../../core/app_export.dart';
import '../../../models/restaurant_model.dart';

class FeaturedRestaurantsSection extends StatelessWidget {
  final List<RestaurantModel> restaurants;
  final Function(RestaurantModel) onRestaurantTap;
  final bool isLoading;

  const FeaturedRestaurantsSection({
    Key? key,
    required this.restaurants,
    required this.onRestaurantTap,
    this.isLoading = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    if (isLoading) {
      return _buildLoadingState();
    }

    if (restaurants.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Section Header
      Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.w),
          child:
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(localizations.featuredRestaurants,
                style: TextStyle(
                    fontSize: 18.sp,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.lightTheme.colorScheme.onSurface)),
            TextButton(
                onPressed: () {
                  Navigator.pushNamed(context, '/restaurants-screen');
                },
                child: Text(localizations.seeAll,
                    style: TextStyle(
                        fontSize: 14.sp,
                        color: AppTheme.lightTheme.colorScheme.primary,
                        fontWeight: FontWeight.w500))),
          ])),
      SizedBox(height: 1.h),

      // Restaurants List
      SizedBox(
          height: 25.h,
          child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.only(left: 4.w),
              itemCount: restaurants.length,
              itemBuilder: (context, index) {
                final restaurant = restaurants[index];
                return _buildRestaurantCard(restaurant);
              })),
    ]);
  }

  Widget _buildRestaurantCard(RestaurantModel restaurant) {
    return GestureDetector(
        onTap: () => onRestaurantTap(restaurant),
        child: Container(
            width: 45.w,
            margin: EdgeInsets.only(right: 3.w),
            decoration: BoxDecoration(
                color: AppTheme.lightTheme.colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2)),
                ]),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Restaurant Image
              ClipRRect(
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(16)),
                  child: CustomImageWidget(
                      imageUrl: restaurant.imageUrl ?? '',
                      height: 15.h, width: double.infinity, fit: BoxFit.cover)),

              // Restaurant Info
              Expanded(
                  child: Padding(
                      padding: EdgeInsets.all(3.w),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(restaurant.name,
                                style: TextStyle(
                                    fontSize: 12.sp,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme
                                        .lightTheme.colorScheme.onSurface),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                            SizedBox(height: 0.5.h),

                            if (restaurant.cuisineType != null)
                              Text(restaurant.cuisineType!,
                                  style: TextStyle(
                                      fontSize: 10.sp,
                                      color: AppTheme
                                          .lightTheme.colorScheme.onSurface
                                          .withValues(alpha: 0.7)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis),

                            const Spacer(),

                            // Rating info
                            Row(children: [
                              Icon(Icons.star,
                                  size: 12.sp, color: Colors.orange),
                              SizedBox(width: 1.w),
                              Text(restaurant.rating?.toString() ?? '0.0',
                                  style: TextStyle(
                                      fontSize: 10.sp,
                                      fontWeight: FontWeight.w500,
                                      color: AppTheme
                                          .lightTheme.colorScheme.onSurface)),
                              const Spacer(),
                            ]),
                          ]))),
            ])));
  }

  Widget _buildLoadingState() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Section Header Skeleton
      Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.w),
          child:
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Container(
                height: 2.h,
                width: 40.w,
                decoration: BoxDecoration(
                    color: AppTheme.lightTheme.colorScheme.outline
                        .withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4))),
            Container(
                height: 1.8.h,
                width: 15.w,
                decoration: BoxDecoration(
                    color: AppTheme.lightTheme.colorScheme.outline
                        .withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(4))),
          ])),
      SizedBox(height: 1.h),

      // Restaurants List Skeleton
      SizedBox(
          height: 25.h,
          child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.only(left: 4.w),
              itemCount: 3,
              itemBuilder: (context, index) {
                return Container(
                    width: 45.w,
                    margin: EdgeInsets.only(right: 3.w),
                    decoration: BoxDecoration(
                        color: AppTheme.lightTheme.colorScheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 2)),
                        ]),
                    child: Column(children: [
                      Container(
                          height: 15.h,
                          decoration: BoxDecoration(
                              color: AppTheme.lightTheme.colorScheme.outline
                                  .withValues(alpha: 0.2),
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(16)))),
                      Expanded(
                          child: Padding(
                              padding: EdgeInsets.all(3.w),
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                        height: 1.5.h,
                                        width: 35.w,
                                        decoration: BoxDecoration(
                                            color: AppTheme
                                                .lightTheme.colorScheme.outline
                                                .withValues(alpha: 0.2),
                                            borderRadius:
                                                BorderRadius.circular(4))),
                                    SizedBox(height: 0.5.h),
                                    Container(
                                        height: 1.2.h,
                                        width: 25.w,
                                        decoration: BoxDecoration(
                                            color: AppTheme
                                                .lightTheme.colorScheme.outline
                                                .withValues(alpha: 0.2),
                                            borderRadius:
                                                BorderRadius.circular(4))),
                                    const Spacer(),
                                    Row(children: [
                                      Container(
                                          height: 1.2.h,
                                          width: 8.w,
                                          decoration: BoxDecoration(
                                              color: AppTheme.lightTheme
                                                  .colorScheme.outline
                                                  .withValues(alpha: 0.2),
                                              borderRadius:
                                                  BorderRadius.circular(4))),
                                      const Spacer(),
                                      Container(
                                          height: 1.2.h,
                                          width: 12.w,
                                          decoration: BoxDecoration(
                                              color: AppTheme.lightTheme
                                                  .colorScheme.outline
                                                  .withValues(alpha: 0.2),
                                              borderRadius:
                                                  BorderRadius.circular(4))),
                                    ]),
                                  ]))),
                    ]));
              })),
    ]);
  }
}