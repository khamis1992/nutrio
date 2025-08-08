import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../core/app_export.dart';
import '../../models/meal_model.dart';
import '../../services/meal_service.dart';
import '../../widgets/custom_bottom_bar.dart';
import './widgets/meal_card.dart';
import './widgets/meal_filter_chips.dart';
import './widgets/meals_empty_state.dart';
import './widgets/meals_filter_bottom_sheet.dart';
import './widgets/meals_search_bar.dart';

class MealsScreen extends StatefulWidget {
  const MealsScreen({super.key});

  @override
  State<MealsScreen> createState() => _MealsScreenState();
}

class _MealsScreenState extends State<MealsScreen>
    with TickerProviderStateMixin {
  final ScrollController _scrollController = ScrollController();
  final List<String> _recentSearches = [
    'Grilled Chicken',
    'Vegan Bowl',
    'Protein Shake',
    'Quinoa Salad'
  ];

  String _searchQuery = '';
  String _selectedCategory = 'All';
  bool _isLoading = false;
  bool _isLoadingMore = false;
  int _currentPage = 1;
  final int _itemsPerPage = 10;

  final List<String> _categories = [
    'All',
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snack',
  ];

  List<MealModel> _allMeals = [];
  List<MealModel> _filteredMeals = [];
  Map<String, dynamic> _currentFilters = {};

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadMeals();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoadingMore &&
          _filteredMeals.length >= _currentPage * _itemsPerPage) {
        _loadMoreMeals();
      }
    }
  }

  Future<void> _loadMeals() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final meals = await MealService.instance.getAllMeals();

      if (mounted) {
        setState(() {
          _allMeals = meals;
          _filteredMeals = List.from(_allMeals);
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
            content: Text('Error loading meals: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _loadMoreMeals() async {
    setState(() {
      _isLoadingMore = true;
    });

    // Simulate pagination - in real app, you'd fetch next page from API
    await Future.delayed(const Duration(milliseconds: 500));

    setState(() {
      _currentPage++;
      _isLoadingMore = false;
    });
  }

  Future<void> _refreshMeals() async {
    setState(() {
      _currentPage = 1;
    });
    await _loadMeals();
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
    });
    _filterMeals();
  }

  void _onCategorySelected(String category) {
    setState(() {
      _selectedCategory = category;
    });
    _filterMeals();
  }

  void _onFiltersApplied(Map<String, dynamic> filters) {
    setState(() {
      _currentFilters = filters;
    });
    _filterMeals();
  }

  void _filterMeals() {
    List<MealModel> filtered = List.from(_allMeals);

    // Apply search filter
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((meal) {
        final name = meal.name.toLowerCase();
        final vendor = (meal.vendor ?? '').toLowerCase();
        final query = _searchQuery.toLowerCase();
        return name.contains(query) || vendor.contains(query);
      }).toList();
    }

    // Apply category filter
    if (_selectedCategory != 'All') {
      filtered = filtered.where((meal) {
        return meal.mealType?.toLowerCase() == _selectedCategory.toLowerCase();
      }).toList();
    }

    // Apply advanced filters
    if (_currentFilters.isNotEmpty) {
      // Calories range filter
      final caloriesRange =
          _currentFilters['caloriesRange'] as Map<String, dynamic>?;
      if (caloriesRange != null) {
        final minCal = caloriesRange['min'] as int;
        final maxCal = caloriesRange['max'] as int;
        filtered = filtered.where((meal) {
          final calories = meal.calories ?? 0;
          return calories >= minCal && calories <= maxCal;
        }).toList();
      }

      // Price range filter
      final priceRange = _currentFilters['priceRange'] as Map<String, dynamic>?;
      if (priceRange != null) {
        final minPrice = priceRange['min'] as int;
        final maxPrice = priceRange['max'] as int;
        filtered = filtered.where((meal) {
          final price = (meal.price ?? 0).toInt();
          return price >= minPrice && price <= maxPrice;
        }).toList();
      }

      // Sort filter
      final sort = _currentFilters['sort'] as String? ?? 'Featured';
      switch (sort) {
        case 'Calories (Low to High)':
          filtered.sort((a, b) {
            final aCalories = a.calories ?? 0;
            final bCalories = b.calories ?? 0;
            return aCalories.compareTo(bCalories);
          });
          break;
        case 'Calories (High to Low)':
          filtered.sort((a, b) {
            final aCalories = a.calories ?? 0;
            final bCalories = b.calories ?? 0;
            return bCalories.compareTo(aCalories);
          });
          break;
        case 'Price (Low to High)':
          filtered.sort((a, b) {
            final aPrice = (a.price ?? 0).toInt();
            final bPrice = (b.price ?? 0).toInt();
            return aPrice.compareTo(bPrice);
          });
          break;
        case 'Price (High to Low)':
          filtered.sort((a, b) {
            final aPrice = (a.price ?? 0).toInt();
            final bPrice = (b.price ?? 0).toInt();
            return bPrice.compareTo(aPrice);
          });
          break;
        case 'Name':
          filtered.sort((a, b) => a.name.compareTo(b.name));
          break;
        default:
          // Keep original order for 'Featured'
          break;
      }
    }

    setState(() {
      _filteredMeals = filtered;
    });
  }

  void _clearAllFilters() {
    setState(() {
      _searchQuery = '';
      _selectedCategory = 'All';
      _currentFilters = {};
      _filteredMeals = List.from(_allMeals);
    });
  }

  void _showFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => MealsFilterBottomSheet(
        onFiltersApplied: _onFiltersApplied,
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

  void _onFavoriteToggle(MealModel meal) {
    // TODO: Implement favorite functionality with Supabase
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Favorite functionality coming soon!'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _onAddToPlan(MealModel meal) {
    // TODO: Implement add to plan functionality with Supabase
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          'Meals',
          style: TextStyle(
            fontSize: 20.sp,
            fontWeight: FontWeight.w600,
            color: AppTheme.lightTheme.colorScheme.onSurface,
          ),
        ),
        backgroundColor: AppTheme.lightTheme.colorScheme.surface,
        elevation: 2,
        centerTitle: true,
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: CustomIconWidget(
              iconName: 'sort',
              color: AppTheme.lightTheme.colorScheme.onSurface,
              size: 24,
            ),
            onPressed: _showFilterBottomSheet,
            tooltip: 'Sort & Filter',
          ),
          SizedBox(width: 2.w),
        ],
      ),
      body: Column(
        children: [
          MealsSearchBar(
            searchQuery: _searchQuery,
            onSearchChanged: _onSearchChanged,
            onFilterTap: _showFilterBottomSheet,
            recentSearches: _recentSearches,
          ),
          MealFilterChips(
            categories: _categories,
            selectedCategory: _selectedCategory,
            onCategorySelected: _onCategorySelected,
          ),
          Expanded(
            child: _buildMealsList(),
          ),
        ],
      ),
      bottomNavigationBar: const CustomBottomBar(currentIndex: 1),
    );
  }

  Widget _buildMealsList() {
    if (_isLoading) {
      return _buildLoadingState();
    }

    if (_filteredMeals.isEmpty) {
      return MealsEmptyState.noResults(
        onClearFilters: _clearAllFilters,
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshMeals,
      color: AppTheme.lightTheme.colorScheme.primary,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _filteredMeals.length + (_isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _filteredMeals.length) {
            return _buildLoadingMoreIndicator();
          }

          final meal = _filteredMeals[index];

          // Convert MealModel to Map for compatibility with existing MealCard widget
          final mealData = {
            'id': meal.id,
            'name': meal.name,
            'restaurant': meal.vendor ?? 'Unknown Restaurant',
            'restaurantLogo':
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&h=100&fit=crop',
            'image': meal.imageUrl ??
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
            'price': meal.price != null ? 'QAR ${meal.price}' : 'QAR 0',
            'category': meal.mealType ?? 'Other',
            'macros': {
              'calories': meal.calories ?? 0,
              'protein': meal.protein ?? 0,
              'carbs': meal.carbs ?? 0,
              'fat': meal.fats ?? 0,
            },
            'dietary': [], // TODO: Add dietary info to MealModel
            'isFavorite': false, // TODO: Add favorite functionality
            'rating': 4.5, // TODO: Add rating to MealModel
          };

          return MealCard(
            meal: mealData,
            onTap: () => _onMealTap(meal),
            onFavoriteToggle: () => _onFavoriteToggle(meal),
            onAddToPlan: () => _onAddToPlan(meal),
          );
        },
      ),
    );
  }

  Widget _buildLoadingState() {
    return ListView.builder(
      itemCount: 6,
      itemBuilder: (context, index) {
        return Container(
          margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
          height: 45.h,
          decoration: BoxDecoration(
            color: AppTheme.lightTheme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Container(
                height: 25.h,
                decoration: BoxDecoration(
                  color: AppTheme.lightTheme.colorScheme.outline
                      .withValues(alpha: 0.2),
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(16)),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.all(4.w),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 2.h,
                        width: 60.w,
                        decoration: BoxDecoration(
                          color: AppTheme.lightTheme.colorScheme.outline
                              .withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      SizedBox(height: 1.h),
                      Container(
                        height: 1.5.h,
                        width: 40.w,
                        decoration: BoxDecoration(
                          color: AppTheme.lightTheme.colorScheme.outline
                              .withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const Spacer(),
                      Container(
                        height: 5.h,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: AppTheme.lightTheme.colorScheme.outline
                              .withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLoadingMoreIndicator() {
    return Container(
      padding: EdgeInsets.all(4.w),
      child: Center(
        child: CircularProgressIndicator(
          color: AppTheme.lightTheme.colorScheme.primary,
        ),
      ),
    );
  }
}
