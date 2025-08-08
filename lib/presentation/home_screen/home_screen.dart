import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

import '../../models/meal_model.dart';
import '../../models/restaurant_model.dart';
import '../../models/health_tip_model.dart';
import '../../models/subscription_model.dart';
import '../../services/auth_service.dart';
import '../../services/gym_service.dart';
import '../../services/meal_service.dart';
import '../../services/restaurant_service.dart';
import '../../services/health_tip_service.dart';
import '../../services/subscription_service.dart';
import '../../services/localization_service.dart';
import '../../widgets/custom_bottom_bar.dart';
import './widgets/featured_meal_card.dart';
import './widgets/gym_access_card.dart';
import './widgets/home_header.dart';
import './widgets/meal_category_chips.dart';
import './widgets/quick_action_button.dart';
import './widgets/subscription_status_card.dart';
import './widgets/health_tip_card.dart';
import './widgets/featured_restaurants_section.dart';
import './widgets/next_delivery_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<MealModel> _featuredMeals = [];
  List<RestaurantModel> _featuredRestaurants = [];
  HealthTipModel? _healthTipOfTheDay;
  SubscriptionModel? _currentSubscription;
  bool _hasGymAccess = false;
  bool _isLoading = true;
  String _selectedCategory = 'All';
  String _userName = '';

  @override
  void initState() {
    super.initState();
    _loadData();

    // Listen for language changes and reload health tips
    LocalizationService.instance.localeNotifier.addListener(_onLanguageChanged);
  }

  @override
  void dispose() {
    LocalizationService.instance.localeNotifier
        .removeListener(_onLanguageChanged);
    super.dispose();
  }

  void _onLanguageChanged() {
    // Reload health tips when language changes
    _loadHealthTips();
  }

  Future<void> _loadData() async {
    try {
      final futures = await Future.wait([
        MealService.instance.getFeaturedMeals(limit: 10),
        SubscriptionService.instance.getCurrentSubscription(),
        GymService.instance.hasActiveGymAccess(),
        RestaurantService.instance.getAllRestaurants(),
        HealthTipService.instance.getHealthTipOfTheDay(),
      ]);

      if (mounted) {
        setState(() {
          _featuredMeals = futures[0] as List<MealModel>;
          _currentSubscription = futures[1] as SubscriptionModel?;
          _hasGymAccess = futures[2] as bool;
          _featuredRestaurants =
              (futures[3] as List<RestaurantModel>).take(8).toList();
          _healthTipOfTheDay = futures[4] as HealthTipModel?;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _loadHealthTips() async {
    try {
      final healthTip = await HealthTipService.instance.getHealthTipOfTheDay();
      if (mounted) {
        setState(() {
          _healthTipOfTheDay = healthTip;
        });
      }
    } catch (e) {
      // Handle error silently
    }
  }

  Future<void> _onRefresh() async {
    await _loadData();
  }

  List<MealModel> get _filteredMeals {
    final localizations = AppLocalizations.of(context)!;
    if (_selectedCategory == localizations.all) return _featuredMeals;

    // Filter based on diet categories
    return _featuredMeals.where((meal) {
      // Check if meal has diet tags or categories that match the selected filter
      final mealName = meal.name.toLowerCase() ?? '';
      final mealDescription = meal.description?.toLowerCase() ?? '';
      final selectedLower = _selectedCategory.toLowerCase();

      // Basic keyword matching for diet categories
      if (selectedLower.contains('keto') || selectedLower.contains('كيتو')) {
        return mealName.contains('keto') ||
            mealDescription.contains('keto') ||
            mealName.contains('ketogenic') ||
            mealDescription.contains('low carb');
      } else if (selectedLower.contains('vegan') ||
          selectedLower.contains('نباتي')) {
        return mealName.contains('vegan') ||
            mealDescription.contains('vegan') ||
            mealName.contains('plant') ||
            mealDescription.contains('plant');
      } else if (selectedLower.contains('protein') ||
          selectedLower.contains('بروتين')) {
        return mealName.contains('protein') ||
            mealDescription.contains('protein') ||
            mealName.contains('lean') ||
            mealDescription.contains('muscle');
      } else if (selectedLower.contains('mediterranean') ||
          selectedLower.contains('متوسطي')) {
        return mealName.contains('mediterranean') ||
            mealDescription.contains('mediterranean') ||
            mealName.contains('olive') ||
            mealDescription.contains('greek');
      } else if (selectedLower.contains('low carb') ||
          selectedLower.contains('كربوهيدرات')) {
        return mealName.contains('low carb') ||
            mealDescription.contains('low carb') ||
            mealName.contains('keto') ||
            mealDescription.contains('atkins');
      } else if (selectedLower.contains('paleo') ||
          selectedLower.contains('باليو')) {
        return mealName.contains('paleo') ||
            mealDescription.contains('paleo') ||
            mealName.contains('caveman') ||
            mealDescription.contains('stone age');
      } else if (selectedLower.contains('gluten') ||
          selectedLower.contains('جلوتين')) {
        return mealName.contains('gluten free') ||
            mealDescription.contains('gluten free') ||
            mealName.contains('celiac') ||
            mealDescription.contains('wheat free');
      } else if (selectedLower.contains('diabetic') ||
          selectedLower.contains('سكري')) {
        return mealName.contains('diabetic') ||
            mealDescription.contains('diabetic') ||
            mealName.contains('sugar free') ||
            mealDescription.contains('low sugar');
      } else if (selectedLower.contains('heart') ||
          selectedLower.contains('قلب')) {
        return mealName.contains('heart') ||
            mealDescription.contains('heart') ||
            mealName.contains('cardiac') ||
            mealDescription.contains('low sodium');
      } else if (selectedLower.contains('healthy') ||
          selectedLower.contains('صحي')) {
        return mealName.contains('healthy') ||
            mealDescription.contains('healthy') ||
            mealName.contains('nutritious') ||
            mealDescription.contains('balanced');
      }

      return true; // Return all meals if no specific filter matches
    }).toList();
  }

  void _onRestaurantTap(RestaurantModel restaurant) {
    Navigator.pushNamed(
      context,
      '/restaurant-profile-screen',
      arguments: restaurant.id,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.currentUser;
    final localizations = AppLocalizations.of(context)!;
    _userName = user?.userMetadata?['full_name'] ??
        user?.email?.split('@')[0] ??
        'User';

    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _onRefresh,
              child: CustomScrollView(
                slivers: [
                  // Home header
                  SliverToBoxAdapter(
                    child: HomeHeader(
                      userName: _userName,
                      currentDate: DateTime.now().toString().split(' ')[0],
                      onNotificationTap: () {},
                    ),
                  ),

                  // Subscription Status Card
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4.w),
                      child: SubscriptionStatusCard(
                          subscription: _currentSubscription),
                    ),
                  ),
                  SliverToBoxAdapter(child: SizedBox(height: 2.h)),

                  // Quick Actions
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4.w),
                      child: Row(
                        children: [
                          Expanded(
                            child: QuickActionButton(
                              icon: Icons.restaurant_menu,
                              title: localizations.browseMeals,
                              onTap: () =>
                                  Navigator.pushNamed(context, '/meals-screen'),
                            ),
                          ),
                          SizedBox(width: 3.w),
                          Expanded(
                            child: QuickActionButton(
                              icon: Icons.calendar_today,
                              title: localizations.myPlan,
                              onTap: () => Navigator.pushNamed(
                                  context, '/my-plan-screen'),
                            ),
                          ),
                          SizedBox(width: 3.w),
                          Expanded(
                            child: QuickActionButton(
                              icon: Icons.trending_up,
                              title: localizations.progress,
                              onTap: () => Navigator.pushNamed(
                                  context, '/progress-screen'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(child: SizedBox(height: 2.h)),

                  // Gym Access Card (if has access)
                  if (_hasGymAccess)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4.w),
                        child: GymAccessCard(
                          gymData: {},
                          onViewAccess: () =>
                              Navigator.pushNamed(context, '/gym-access'),
                        ),
                      ),
                    ),
                  if (_hasGymAccess)
                    SliverToBoxAdapter(child: SizedBox(height: 2.h)),

                  // Diet Category Filter - Updated with diet-specific categories
                  SliverToBoxAdapter(
                    child: MealCategoryChips(
                      categories: [
                        localizations.all,
                        localizations.keto,
                        localizations.vegan,
                        localizations.highProtein,
                        localizations.mediterranean,
                        localizations.lowCarb,
                        localizations.paleo,
                        localizations.glutenFree,
                        localizations.diabeticFriendly,
                        localizations.heartHealthy,
                      ],
                      selectedCategory: _selectedCategory,
                      onCategorySelected: (category) {
                        setState(() => _selectedCategory = category);
                      },
                    ),
                  ),

                  // Health Tip of the Day (positioned directly below filter chips)
                  if (_healthTipOfTheDay != null)
                    SliverToBoxAdapter(
                      child: HealthTipCard(
                        content: _healthTipOfTheDay!.localizedContent,
                        onTap: () {
                          // Could navigate to health tips screen in the future
                        },
                      ),
                    ),

                  // Next Delivery Time Card (NEW - positioned below health tip)
                  SliverToBoxAdapter(
                    child: NextDeliveryCard(
                      onTap: () {
                        // Navigate to delivery tracking or orders screen
                        Navigator.pushNamed(context, '/my-plan-screen');
                      },
                    ),
                  ),

                  SliverToBoxAdapter(child: SizedBox(height: 1.h)),

                  // Featured Restaurants Section
                  SliverToBoxAdapter(
                    child: FeaturedRestaurantsSection(
                      restaurants: _featuredRestaurants,
                      onRestaurantTap: _onRestaurantTap,
                      isLoading: _isLoading,
                    ),
                  ),

                  SliverToBoxAdapter(child: SizedBox(height: 2.h)),

                  // Featured Meals
                  SliverPadding(
                    padding: EdgeInsets.symmetric(horizontal: 4.w),
                    sliver: SliverGrid(
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.75,
                        crossAxisSpacing: 3.w,
                        mainAxisSpacing: 3.w,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final meal = _filteredMeals[index];
                          return FeaturedMealCard(
                            meal: meal,
                            onTap: () => Navigator.pushNamed(
                              context,
                              '/meal-detail-screen',
                              arguments: meal.id,
                            ),
                          );
                        },
                        childCount: _filteredMeals.length,
                      ),
                    ),
                  ),

                  // Bottom Padding
                  SliverToBoxAdapter(child: SizedBox(height: 10.h)),
                ],
              ),
            ),
      bottomNavigationBar: const CustomBottomBar(currentIndex: 0),
    );
  }
}
