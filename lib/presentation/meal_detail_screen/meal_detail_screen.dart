import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:sizer/sizer.dart';

import '../../core/app_export.dart';
import './widgets/action_buttons.dart';
import './widgets/add_to_plan_bottom_sheet.dart';
import './widgets/ingredients_card.dart';
import './widgets/meal_image_carousel.dart';
import './widgets/meal_info_header.dart';
import './widgets/nutrition_info_card.dart';
import './widgets/restaurant_info_card.dart';
import './widgets/similar_meals_section.dart';

class MealDetailScreen extends StatefulWidget {
  const MealDetailScreen({super.key});

  @override
  State<MealDetailScreen> createState() => _MealDetailScreenState();
}

class _MealDetailScreenState extends State<MealDetailScreen> {
  bool _isFavorite = false;
  bool _isLoading = false;

  // Mock meal data
  final Map<String, dynamic> _mealData = {
    "id": 1,
    "name": "Mediterranean Quinoa Bowl",
    "images": [
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&h=600&fit=crop",
    ],
    "restaurant": {
      "name": "Fresh Garden Bistro",
      "logo":
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=200&h=200&fit=crop",
      "rating": 4.7,
      "reviewCount": 342,
      "cuisine": "Mediterranean, Healthy",
      "deliveryTime": "25-35 min",
      "deliveryFee": "Free delivery",
    },
    "rating": 4.8,
    "reviewCount": 156,
    "price": "QAR 45.00",
    "nutrition": {
      "calories": 520,
      "protein": 18.5,
      "carbs": 65.2,
      "fats": 16.8,
      "fiber": 12.3,
      "sugar": 8.4,
      "sodium": 680,
    },
    "ingredients": [
      {"name": "Quinoa", "quantity": "1 cup cooked"},
      {"name": "Cherry Tomatoes", "quantity": "150g"},
      {"name": "Cucumber", "quantity": "1 medium"},
      {"name": "Red Onion", "quantity": "1/4 cup diced"},
      {"name": "Kalamata Olives", "quantity": "2 tbsp"},
      {"name": "Feta Cheese", "quantity": "50g crumbled"},
      {"name": "Fresh Parsley", "quantity": "2 tbsp chopped"},
      {"name": "Lemon Juice", "quantity": "2 tbsp"},
      {"name": "Extra Virgin Olive Oil", "quantity": "1 tbsp"},
      {"name": "Dried Oregano", "quantity": "1 tsp"},
      {"name": "Sea Salt", "quantity": "to taste"},
      {"name": "Black Pepper", "quantity": "to taste"},
    ],
    "allergens": ["Dairy"],
    "description":
        "A nutritious and flavorful Mediterranean-inspired quinoa bowl packed with fresh vegetables, herbs, and tangy feta cheese. Perfect for a healthy lunch or dinner.",
  };

  final List<Map<String, dynamic>> _similarMeals = [
    {
      "id": 2,
      "name": "Greek Chicken Salad",
      "image":
          "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop",
      "restaurant": "Mediterranean Delights",
      "calories": 420,
      "protein": 32.0,
      "price": "QAR 38.00",
      "rating": 4.6,
    },
    {
      "id": 3,
      "name": "Hummus Power Bowl",
      "image":
          "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
      "restaurant": "Healthy Bites",
      "calories": 380,
      "protein": 15.5,
      "price": "QAR 32.00",
      "rating": 4.4,
    },
    {
      "id": 4,
      "name": "Falafel Buddha Bowl",
      "image":
          "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
      "restaurant": "Green Garden",
      "calories": 465,
      "protein": 20.2,
      "price": "QAR 42.00",
      "rating": 4.5,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
      body: Column(
        children: [
          // Custom app bar
          _buildCustomAppBar(),

          // Scrollable content
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Hero image carousel
                  MealImageCarousel(
                    imageUrls: (_mealData['images'] as List).cast<String>(),
                    mealName: _mealData['name'] as String,
                  ),

                  // Meal info header
                  MealInfoHeader(
                    mealName: _mealData['name'] as String,
                    restaurantName: (_mealData['restaurant']
                        as Map<String, dynamic>)['name'] as String,
                    rating: (_mealData['rating'] as num).toDouble(),
                    reviewCount: _mealData['reviewCount'] as int,
                    isFavorite: _isFavorite,
                    onFavoriteToggle: _toggleFavorite,
                  ),

                  SizedBox(height: 2.h),

                  // Nutrition information
                  NutritionInfoCard(
                    nutritionData:
                        _mealData['nutrition'] as Map<String, dynamic>,
                  ),

                  // Ingredients and allergens
                  IngredientsCard(
                    ingredients: (_mealData['ingredients'] as List)
                        .cast<Map<String, dynamic>>(),
                    allergens: (_mealData['allergens'] as List).cast<String>(),
                  ),

                  // Restaurant information
                  RestaurantInfoCard(
                    restaurantData:
                        _mealData['restaurant'] as Map<String, dynamic>,
                    onViewMenu: _handleViewMenu,
                  ),

                  // Similar meals
                  SimilarMealsSection(
                    similarMeals: _similarMeals,
                    onMealTap: _handleSimilarMealTap,
                  ),

                  // Bottom padding for action buttons
                  SizedBox(height: 20.h),
                ],
              ),
            ),
          ),
        ],
      ),

      // Floating action buttons
      bottomNavigationBar: ActionButtons(
        onAddToPlan: _handleAddToPlan,
        onLogAsEaten: _handleLogAsEaten,
        isLoading: _isLoading,
      ),
    );
  }

  Widget _buildCustomAppBar() {
    return Container(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top,
        left: 4.w,
        right: 4.w,
        bottom: 2.h,
      ),
      decoration: BoxDecoration(
        color: AppTheme.lightTheme.colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: AppTheme.lightTheme.shadowColor,
            offset: const Offset(0, 2),
            blurRadius: 4,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Row(
        children: [
          // Back button
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: CustomIconWidget(
              iconName: 'arrow_back_ios',
              color: AppTheme.lightTheme.colorScheme.onSurface,
              size: 5.w,
            ),
            style: IconButton.styleFrom(
              backgroundColor: AppTheme.lightTheme.colorScheme.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(2.w),
                side: BorderSide(
                  color: AppTheme.lightTheme.dividerColor,
                  width: 1,
                ),
              ),
            ),
          ),

          const Spacer(),

          // Share button
          IconButton(
            onPressed: _handleShare,
            icon: CustomIconWidget(
              iconName: 'share',
              color: AppTheme.lightTheme.colorScheme.onSurface,
              size: 5.w,
            ),
            style: IconButton.styleFrom(
              backgroundColor: AppTheme.lightTheme.colorScheme.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(2.w),
                side: BorderSide(
                  color: AppTheme.lightTheme.dividerColor,
                  width: 1,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _toggleFavorite() {
    HapticFeedback.lightImpact();
    setState(() {
      _isFavorite = !_isFavorite;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isFavorite ? 'Added to favorites' : 'Removed from favorites',
        ),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(2.w),
        ),
      ),
    );
  }

  void _handleShare() {
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            CustomIconWidget(
              iconName: 'share',
              color: Colors.white,
              size: 4.w,
            ),
            SizedBox(width: 3.w),
            const Text('Meal shared successfully!'),
          ],
        ),
        backgroundColor: AppTheme.successColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(2.w),
        ),
      ),
    );
  }

  void _handleViewMenu() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            CustomIconWidget(
              iconName: 'restaurant_menu',
              color: Colors.white,
              size: 4.w,
            ),
            SizedBox(width: 3.w),
            const Text('Opening restaurant menu...'),
          ],
        ),
        backgroundColor: AppTheme.lightTheme.colorScheme.primary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(2.w),
        ),
      ),
    );
  }

  void _handleSimilarMealTap(Map<String, dynamic> meal) {
    HapticFeedback.lightImpact();

    // Navigate to meal detail with new meal data
    Navigator.pushNamed(context, '/meal-detail-screen');
  }

  void _handleAddToPlan() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddToPlanBottomSheet(
        mealName: _mealData['name'] as String,
        onAddToPlan: (date, mealType) {
          _addMealToPlan(date, mealType);
        },
      ),
    );
  }

  void _addMealToPlan(DateTime date, String mealType) {
    // Simulate adding meal to plan
    HapticFeedback.mediumImpact();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            CustomIconWidget(
              iconName: 'check_circle',
              color: Colors.white,
              size: 4.w,
            ),
            SizedBox(width: 3.w),
            Expanded(
              child: Text(
                'Added to ${_formatDate(date)} $mealType',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        backgroundColor: AppTheme.successColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(2.w),
        ),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _handleLogAsEaten() {
    // Simulate logging meal as eaten
    HapticFeedback.mediumImpact();

    // Mock nutrition log entry
    final nutritionLog = {
      "meal_id": _mealData['id'],
      "meal_name": _mealData['name'],
      "calories": (_mealData['nutrition'] as Map)['calories'],
      "protein": (_mealData['nutrition'] as Map)['protein'],
      "carbs": (_mealData['nutrition'] as Map)['carbs'],
      "fats": (_mealData['nutrition'] as Map)['fats'],
      "logged_at": DateTime.now().toIso8601String(),
    };

    // In a real app, this would be saved to Supabase user_nutrition_log table
    debugPrint('Nutrition log entry: $nutritionLog');
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final selectedDay = DateTime(date.year, date.month, date.day);

    if (selectedDay == today) {
      return 'Today';
    } else if (selectedDay == tomorrow) {
      return 'Tomorrow';
    } else {
      final months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ];
      return '${date.day} ${months[date.month - 1]}';
    }
  }
}
