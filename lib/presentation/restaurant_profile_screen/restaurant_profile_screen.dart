import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../core/app_export.dart';
import '../../models/meal_model.dart';
import '../../models/restaurant_model.dart';
import '../../services/restaurant_service.dart';
import '../../widgets/custom_bottom_bar.dart';
import './widgets/restaurant_hero_section.dart';
import './widgets/restaurant_info_card.dart';
import './widgets/restaurant_location_card.dart';
import './widgets/restaurant_meals_section.dart';

class RestaurantProfileScreen extends StatefulWidget {
  const RestaurantProfileScreen({super.key});

  @override
  State<RestaurantProfileScreen> createState() =>
      _RestaurantProfileScreenState();
}

class _RestaurantProfileScreenState extends State<RestaurantProfileScreen> {
  String? _restaurantId;
  RestaurantModel? _restaurant;
  List<MealModel> _meals = [];
  bool _isLoading = true;
  bool _isFavorite = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_restaurantId == null) {
      _restaurantId = ModalRoute.of(context)!.settings.arguments as String?;
      if (_restaurantId != null) {
        _loadRestaurantData();
      }
    }
  }

  Future<void> _loadRestaurantData() async {
    if (_restaurantId == null) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final data = await RestaurantService.instance
          .getRestaurantWithMeals(_restaurantId!);

      if (mounted) {
        setState(() {
          _restaurant = data['restaurant'] as RestaurantModel;
          _meals = data['meals'] as List<MealModel>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading restaurant: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _refreshData() async {
    await _loadRestaurantData();
  }

  void _onBackPressed() {
    Navigator.pop(context);
  }

  void _onSharePressed() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Sharing ${_restaurant?.name ?? 'restaurant'}...'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _onFavoriteToggle() {
    setState(() {
      _isFavorite = !_isFavorite;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isFavorite ? 'Added to favorites' : 'Removed from favorites',
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _onMealTap(MealModel meal) {
    Navigator.pushNamed(
      context,
      '/meal-detail-screen',
      arguments: meal.id,
    );
  }

  void _onAddToPlan(MealModel meal) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${meal.name} added to your meal plan'),
        duration: const Duration(seconds: 2),
        action: SnackBarAction(
          label: 'View Plan',
          onPressed: () {
            Navigator.pushNamed(context, '/my-plan-screen');
          },
        ),
      ),
    );
  }

  void _onGetDirections() {
    if (_restaurant?.location != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Opening directions to ${_restaurant!.location}...'),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
        body: _buildLoadingState(),
        bottomNavigationBar: const CustomBottomBar(currentIndex: 1),
      );
    }

    if (_restaurant == null) {
      return Scaffold(
        backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: AppTheme.lightTheme.colorScheme.surface,
          leading: IconButton(
            icon: CustomIconWidget(
              iconName: 'arrow_back',
              color: AppTheme.lightTheme.colorScheme.onSurface,
              size: 24,
            ),
            onPressed: _onBackPressed,
          ),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CustomIconWidget(
                iconName: 'error_outline',
                color: AppTheme.textSecondaryLight,
                size: 48,
              ),
              SizedBox(height: 2.h),
              Text(
                'Restaurant not found',
                style: TextStyle(
                  fontSize: 18.sp,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.lightTheme.colorScheme.onSurface,
                ),
              ),
              SizedBox(height: 1.h),
              Text(
                'The restaurant you are looking for might have been removed.',
                style: TextStyle(
                  fontSize: 14.sp,
                  color: AppTheme.textSecondaryLight,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: 4.h),
              ElevatedButton(
                onPressed: _onBackPressed,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.lightTheme.colorScheme.primary,
                ),
                child: Text(
                  'Go Back',
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.lightTheme.colorScheme.onPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: const CustomBottomBar(currentIndex: 1),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
      body: RefreshIndicator(
        onRefresh: _refreshData,
        color: AppTheme.lightTheme.colorScheme.primary,
        child: CustomScrollView(
          slivers: [
            _buildSliverAppBar(),
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RestaurantHeroSection(
                    restaurant: _restaurant!,
                  ),
                  SizedBox(height: 2.h),
                  RestaurantInfoCard(
                    restaurant: _restaurant!,
                  ),
                  SizedBox(height: 2.h),
                  if (_restaurant!.location != null)
                    RestaurantLocationCard(
                      restaurant: _restaurant!,
                      onGetDirections: _onGetDirections,
                    ),
                  SizedBox(height: 2.h),
                  RestaurantMealsSection(
                    restaurant: _restaurant!,
                    meals: _meals,
                    onMealTap: _onMealTap,
                    onAddToPlan: _onAddToPlan,
                  ),
                  SizedBox(height: 10.h),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const CustomBottomBar(currentIndex: 1),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 25.h,
      floating: false,
      pinned: true,
      backgroundColor: AppTheme.lightTheme.colorScheme.surface,
      leading: Container(
        margin: EdgeInsets.all(2.w),
        decoration: BoxDecoration(
          color: AppTheme.lightTheme.colorScheme.surface.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(20),
        ),
        child: IconButton(
          icon: CustomIconWidget(
            iconName: 'arrow_back',
            color: AppTheme.lightTheme.colorScheme.onSurface,
            size: 20,
          ),
          onPressed: _onBackPressed,
        ),
      ),
      actions: [
        Container(
          margin: EdgeInsets.all(2.w),
          decoration: BoxDecoration(
            color:
                AppTheme.lightTheme.colorScheme.surface.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(20),
          ),
          child: IconButton(
            icon: CustomIconWidget(
              iconName: 'share',
              color: AppTheme.lightTheme.colorScheme.onSurface,
              size: 20,
            ),
            onPressed: _onSharePressed,
          ),
        ),
        Container(
          margin: EdgeInsets.only(right: 4.w, top: 2.w, bottom: 2.w),
          decoration: BoxDecoration(
            color:
                AppTheme.lightTheme.colorScheme.surface.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(20),
          ),
          child: IconButton(
            icon: CustomIconWidget(
              iconName: _isFavorite ? 'favorite' : 'favorite_border',
              color: _isFavorite
                  ? AppTheme.errorColor
                  : AppTheme.lightTheme.colorScheme.onSurface,
              size: 20,
            ),
            onPressed: _onFavoriteToggle,
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: CustomImageWidget(
          imageUrl: _restaurant?.imageUrl ??
              'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
          width: double.infinity,
          height: 25.h,
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 25.h,
          backgroundColor: AppTheme.lightTheme.colorScheme.surface,
          leading: IconButton(
            icon: CustomIconWidget(
              iconName: 'arrow_back',
              color: AppTheme.lightTheme.colorScheme.onSurface,
              size: 24,
            ),
            onPressed: _onBackPressed,
          ),
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              color: AppTheme.lightTheme.colorScheme.outline
                  .withValues(alpha: 0.2),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Column(
            children: List.generate(
              5,
              (index) => Container(
                margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
                height: 15.h,
                decoration: BoxDecoration(
                  color: AppTheme.lightTheme.colorScheme.outline
                      .withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
