import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:sizer/sizer.dart';

import '../../core/app_export.dart';
import '../../widgets/custom_app_bar.dart';
import '../../widgets/custom_bottom_bar.dart';
import './widgets/add_meal_placeholder.dart';
import './widgets/planned_meal_card.dart';
import './widgets/subscription_header_card.dart';
import './widgets/weekly_calendar_widget.dart';
import './widgets/weekly_macro_summary.dart';

class MyPlanScreen extends StatefulWidget {
  const MyPlanScreen({super.key});

  @override
  State<MyPlanScreen> createState() => _MyPlanScreenState();
}

class _MyPlanScreenState extends State<MyPlanScreen> {
  DateTime _selectedDate = DateTime.now();
  bool _isLoading = false;
  final ScrollController _scrollController = ScrollController();

  // Mock subscription data
  final Map<String, dynamic> _subscriptionData = {
    "plan_type": "Weekly",
    "start_date": "2025-08-04T00:00:00.000Z",
    "end_date": "2025-08-11T00:00:00.000Z",
    "remaining_meals": 15,
    "total_meals": 21,
    "status": "active"
  };

  // Mock meal counts for calendar
  final Map<DateTime, int> _mealCounts = {
    DateTime(2025, 8, 4): 3,
    DateTime(2025, 8, 5): 2,
    DateTime(2025, 8, 6): 3,
    DateTime(2025, 8, 7): 1,
    DateTime(2025, 8, 8): 3,
    DateTime(2025, 8, 9): 2,
    DateTime(2025, 8, 10): 3,
  };

  // Mock planned meals data
  final List<Map<String, dynamic>> _plannedMeals = [
    {
      "id": 1,
      "name": "Mediterranean Quinoa Bowl",
      "meal_type": "breakfast",
      "image_url":
          "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500&h=500&fit=crop",
      "calories": 420,
      "protein": 18.5,
      "carbs": 52.0,
      "fat": 16.2,
      "restaurant_name": "Green Garden Cafe",
      "scheduled_date": "2025-08-06T08:00:00.000Z",
    },
    {
      "id": 2,
      "name": "Grilled Salmon with Vegetables",
      "meal_type": "lunch",
      "image_url":
          "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&h=500&fit=crop",
      "calories": 580,
      "protein": 42.0,
      "carbs": 28.5,
      "fat": 32.8,
      "restaurant_name": "Ocean Fresh Kitchen",
      "scheduled_date": "2025-08-06T13:00:00.000Z",
    },
    {
      "id": 3,
      "name": "Chicken Tikka Masala",
      "meal_type": "dinner",
      "image_url":
          "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&h=500&fit=crop",
      "calories": 650,
      "protein": 38.2,
      "carbs": 45.0,
      "fat": 35.5,
      "restaurant_name": "Spice Route",
      "scheduled_date": "2025-08-06T19:00:00.000Z",
    },
  ];

  // Mock macro summary data
  final Map<String, dynamic> _macroSummaryData = {
    "planned_calories": 1650,
    "target_calories": 2000,
    "planned_protein": 98.7,
    "target_protein": 150.0,
    "planned_carbs": 125.5,
    "target_carbs": 250.0,
    "planned_fat": 84.5,
    "target_fat": 80.0,
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      appBar: CustomAppBarVariants.myPlan(context),
      body: RefreshIndicator(
        onRefresh: _refreshPlanData,
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            // Subscription header
            SliverToBoxAdapter(
              child: SubscriptionHeaderCard(
                subscriptionData: _subscriptionData,
              ),
            ),

            // Weekly calendar
            SliverToBoxAdapter(
              child: WeeklyCalendarWidget(
                selectedDate: _selectedDate,
                onDateSelected: _onDateSelected,
                mealCounts: _mealCounts,
              ),
            ),

            // Selected date meals header
            SliverToBoxAdapter(
              child: Container(
                margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 2.h),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${localizations.mealsFor} ${_formatSelectedDate()}',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface,
                          ),
                        ),
                        SizedBox(height: 0.5.h),
                        Text(
                          '${_getSelectedDateMeals().length} ${localizations.mealsPlanned}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ),
                    ElevatedButton.icon(
                      onPressed: _showPlanMealsDialog,
                      icon: CustomIconWidget(
                        iconName: 'add',
                        size: 18,
                        color: Colors.white,
                      ),
                      label: Text(localizations.planMeals),
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(
                            horizontal: 4.w, vertical: 1.h),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Planned meals list
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final selectedDateMeals = _getSelectedDateMeals();
                  final mealTypes = [
                    localizations.breakfast,
                    localizations.lunch,
                    localizations.dinner
                  ];

                  if (index < mealTypes.length) {
                    final mealType = mealTypes[index];
                    final meal = selectedDateMeals
                        .where((m) =>
                            (m['meal_type'] as String).toLowerCase() ==
                            _getMealTypeKey(mealType))
                        .firstOrNull;

                    if (meal != null) {
                      return PlannedMealCard(
                        mealData: meal,
                        onMarkAsEaten: () => _markMealAsEaten(meal),
                        onRemove: () => _removeMealFromPlan(meal),
                        onSwap: () => _swapMeal(meal),
                        onViewDetails: () => _viewMealDetails(meal),
                      );
                    } else {
                      return AddMealPlaceholder(
                        mealType: mealType,
                        onAddMeal: () =>
                            _addMealToPlan(_getMealTypeKey(mealType)),
                      );
                    }
                  }
                  return null;
                },
                childCount: 3, // breakfast, lunch, dinner
              ),
            ),

            // Weekly macro summary
            SliverToBoxAdapter(
              child: WeeklyMacroSummary(
                macroData: _macroSummaryData,
              ),
            ),

            // Bottom spacing
            SliverToBoxAdapter(
              child: SizedBox(height: 10.h),
            ),
          ],
        ),
      ),
      bottomNavigationBar: CustomBottomBar(
        currentIndex: 2, // My Plan tab
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showPlanMealsDialog,
        icon: CustomIconWidget(
          iconName: 'restaurant_menu',
          size: 20,
          color: Colors.white,
        ),
        label: Text(
          localizations.planWeek,
          style: theme.textTheme.labelMedium?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Future<void> _refreshPlanData() async {
    setState(() {
      _isLoading = true;
    });

    // Simulate API call
    await Future.delayed(const Duration(seconds: 1));

    setState(() {
      _isLoading = false;
    });

    if (mounted) {
      final localizations = AppLocalizations.of(context)!;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(localizations.planRefreshed),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _onDateSelected(DateTime date) {
    setState(() {
      _selectedDate = date;
    });
  }

  void _onBottomNavTap(int index) {
    switch (index) {
      case 0:
        Navigator.pushNamedAndRemoveUntil(
            context, '/home-screen', (route) => false);
        break;
      case 1:
        Navigator.pushNamedAndRemoveUntil(
            context, '/meals-screen', (route) => false);
        break;
      case 2:
        // Already on My Plan screen
        break;
    }
  }

  List<Map<String, dynamic>> _getSelectedDateMeals() {
    final selectedDateKey =
        DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
    return _plannedMeals.where((meal) {
      final mealDate = DateTime.parse(meal['scheduled_date'] as String);
      final mealDateKey = DateTime(mealDate.year, mealDate.month, mealDate.day);
      return mealDateKey == selectedDateKey;
    }).toList();
  }

  String _getMealTypeKey(String localizedMealType) {
    final localizations = AppLocalizations.of(context)!;
    if (localizedMealType == localizations.breakfast) return 'breakfast';
    if (localizedMealType == localizations.lunch) return 'lunch';
    if (localizedMealType == localizations.dinner) return 'dinner';
    return localizedMealType.toLowerCase();
  }

  String _formatSelectedDate() {
    final localizations = AppLocalizations.of(context)!;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final selectedDateKey =
        DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);

    if (selectedDateKey == today) {
      return localizations.today;
    } else if (selectedDateKey == today.add(const Duration(days: 1))) {
      return localizations.tomorrow;
    } else if (selectedDateKey == today.subtract(const Duration(days: 1))) {
      return localizations.yesterday;
    } else {
      const months = [
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
      return '${_selectedDate.day} ${months[_selectedDate.month - 1]}';
    }
  }

  void _markMealAsEaten(Map<String, dynamic> meal) {
    final localizations = AppLocalizations.of(context)!;
    // Simulate logging meal as eaten
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${meal['name']} ${localizations.markedAsEaten}'),
        action: SnackBarAction(
          label: localizations.undo,
          onPressed: () {
            // Handle undo action
          },
        ),
      ),
    );
  }

  void _removeMealFromPlan(Map<String, dynamic> meal) {
    final localizations = AppLocalizations.of(context)!;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(localizations.removeMeal),
        content: Text(
            '${localizations.areYouSureRemove} "${meal['name']}" ${localizations.fromYourPlan}'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(localizations.cancel),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                _plannedMeals.removeWhere((m) => m['id'] == meal['id']);
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                    content: Text(
                        '${meal['name']} ${localizations.removedFromPlan}')),
              );
            },
            child: Text(localizations.remove),
          ),
        ],
      ),
    );
  }

  void _swapMeal(Map<String, dynamic> meal) {
    final localizations = AppLocalizations.of(context)!;
    Navigator.pushNamed(context, '/meals-screen').then((result) {
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(localizations.mealSwappedSuccessfully)),
        );
      }
    });
  }

  void _viewMealDetails(Map<String, dynamic> meal) {
    Navigator.pushNamed(
      context,
      '/meal-detail-screen',
      arguments: meal,
    );
  }

  void _addMealToPlan(String mealType) {
    final localizations = AppLocalizations.of(context)!;
    Navigator.pushNamed(
      context,
      '/meals-screen',
      arguments: {
        'filter': mealType,
        'selectedDate': _selectedDate,
      },
    ).then((result) {
      if (result != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$mealType ${localizations.mealAddedToPlan}')),
        );
      }
    });
  }

  void _showPlanMealsDialog() {
    final localizations = AppLocalizations.of(context)!;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: 60.h,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.all(4.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 10.w,
                height: 0.5.h,
                decoration: BoxDecoration(
                  color: Theme.of(context).dividerColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            SizedBox(height: 2.h),
            Text(
              localizations.planYourWeek,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            SizedBox(height: 1.h),
            Text(
              localizations.chooseHowToPlan,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.7),
                  ),
            ),
            SizedBox(height: 3.h),
            Expanded(
              child: Column(
                children: [
                  _buildPlanOption(
                    localizations.autoGeneratePlan,
                    localizations.autoGenerateDescription,
                    'auto_awesome',
                    () {
                      Navigator.pop(context);
                      _autoGeneratePlan();
                    },
                  ),
                  SizedBox(height: 2.h),
                  _buildPlanOption(
                    localizations.browseAndSelect,
                    localizations.browseDescription,
                    'restaurant_menu',
                    () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, '/meals-screen');
                    },
                  ),
                  SizedBox(height: 2.h),
                  _buildPlanOption(
                    localizations.copyPreviousWeek,
                    localizations.copyDescription,
                    'content_copy',
                    () {
                      Navigator.pop(context);
                      _copyPreviousWeek();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanOption(
      String title, String description, String iconName, VoidCallback onTap) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(4.w),
        decoration: BoxDecoration(
          color: colorScheme.outline.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: colorScheme.outline.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: EdgeInsets.all(3.w),
              decoration: BoxDecoration(
                color: colorScheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: CustomIconWidget(
                iconName: iconName,
                size: 24,
                color: colorScheme.primary,
              ),
            ),
            SizedBox(width: 4.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 0.5.h),
                  Text(
                    description,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurface.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
            CustomIconWidget(
              iconName: 'arrow_forward_ios',
              size: 16,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }

  void _autoGeneratePlan() {
    final localizations = AppLocalizations.of(context)!;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(localizations.generatingPlan),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _copyPreviousWeek() {
    final localizations = AppLocalizations.of(context)!;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(localizations.previousWeekCopied),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
