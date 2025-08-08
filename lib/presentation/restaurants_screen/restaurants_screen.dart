import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:sizer/sizer.dart';

import '../../core/app_export.dart';
import '../../models/restaurant_model.dart';
import '../../services/restaurant_service.dart';
import '../../widgets/custom_bottom_bar.dart';
import './widgets/restaurant_card.dart';
import './widgets/restaurant_filter_chips.dart';
import './widgets/restaurants_empty_state.dart';
import './widgets/restaurants_filter_bottom_sheet.dart';
import './widgets/restaurants_search_bar.dart';

class RestaurantsScreen extends StatefulWidget {
  const RestaurantsScreen({super.key});

  @override
  State<RestaurantsScreen> createState() => _RestaurantsScreenState();
}

class _RestaurantsScreenState extends State<RestaurantsScreen>
    with TickerProviderStateMixin {
  final ScrollController _scrollController = ScrollController();
  late List<String> _recentSearches;

  String _searchQuery = '';
  String _selectedCuisine = '';
  bool _isLoading = false;
  bool _isLoadingMore = false;
  int _currentPage = 1;
  final int _itemsPerPage = 10;

  List<String> _cuisineTypes = [];
  List<RestaurantModel> _allRestaurants = [];
  List<RestaurantModel> _filteredRestaurants = [];
  Map<String, dynamic> _currentFilters = {};

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadRestaurants();
    _loadCuisineTypes();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final localizations = AppLocalizations.of(context)!;
    _recentSearches = [
      localizations.mediterranean,
      localizations.vegan,
      localizations.highProtein,
      localizations.healthy
    ];
    _selectedCuisine = localizations.all;
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
          _filteredRestaurants.length >= _currentPage * _itemsPerPage) {
        _loadMoreRestaurants();
      }
    }
  }

  Future<void> _loadRestaurants() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final restaurants = await RestaurantService.instance.getAllRestaurants();

      if (mounted) {
        setState(() {
          _allRestaurants = restaurants;
          _filteredRestaurants = List.from(_allRestaurants);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        final localizations = AppLocalizations.of(context)!;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                '${localizations.errorLoadingRestaurants} ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _loadCuisineTypes() async {
    try {
      final localizations = AppLocalizations.of(context)!;
      final cuisines = await RestaurantService.instance.getCuisineTypes();
      if (mounted) {
        setState(() {
          _cuisineTypes = [localizations.all, ...cuisines];
        });
      }
    } catch (e) {
      // Fallback cuisine types if service fails
      if (mounted) {
        final localizations = AppLocalizations.of(context)!;
        setState(() {
          _cuisineTypes = [
            localizations.all,
            localizations.mediterranean,
            localizations.vegan,
            localizations.sportsNutrition,
            localizations.healthy,
            localizations.middleEastern
          ];
        });
      }
    }
  }

  Future<void> _loadMoreRestaurants() async {
    setState(() {
      _isLoadingMore = true;
    });

    await Future.delayed(const Duration(milliseconds: 500));

    setState(() {
      _currentPage++;
      _isLoadingMore = false;
    });
  }

  Future<void> _refreshRestaurants() async {
    setState(() {
      _currentPage = 1;
    });
    await _loadRestaurants();
  }

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
    });
    _filterRestaurants();
  }

  void _onCuisineSelected(String cuisine) {
    setState(() {
      _selectedCuisine = cuisine;
    });
    _filterRestaurants();
  }

  void _onFiltersApplied(Map<String, dynamic> filters) {
    setState(() {
      _currentFilters = filters;
    });
    _filterRestaurants();
  }

  void _filterRestaurants() {
    final localizations = AppLocalizations.of(context)!;
    List<RestaurantModel> filtered = List.from(_allRestaurants);

    // Apply search filter
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((restaurant) {
        final name = restaurant.name.toLowerCase();
        final cuisine = (restaurant.cuisineType ?? '').toLowerCase();
        final description = (restaurant.description ?? '').toLowerCase();
        final query = _searchQuery.toLowerCase();
        return name.contains(query) ||
            cuisine.contains(query) ||
            description.contains(query);
      }).toList();
    }

    // Apply cuisine filter
    if (_selectedCuisine != localizations.all) {
      filtered = filtered.where((restaurant) {
        return restaurant.cuisineType?.toLowerCase() ==
            _selectedCuisine.toLowerCase();
      }).toList();
    }

    // Apply advanced filters
    if (_currentFilters.isNotEmpty) {
      // Rating filter
      final minRating = _currentFilters['minRating'] as double?;
      if (minRating != null) {
        filtered = filtered.where((restaurant) {
          final rating = restaurant.rating?.toDouble() ?? 0.0;
          return rating >= minRating;
        }).toList();
      }

      // Dietary tags filter
      final selectedTags =
          _currentFilters['dietaryTags'] as List<String>? ?? [];
      if (selectedTags.isNotEmpty) {
        filtered = filtered.where((restaurant) {
          final restaurantTags = restaurant.dietaryTags ?? [];
          return selectedTags.any((tag) => restaurantTags.contains(tag));
        }).toList();
      }

      // Sort filter
      final sort = _currentFilters['sort'] as String? ?? localizations.featured;
      switch (sort) {
        case 'Rating (High to Low)':
          filtered.sort((a, b) {
            final aRating = a.rating?.toDouble() ?? 0.0;
            final bRating = b.rating?.toDouble() ?? 0.0;
            return bRating.compareTo(aRating);
          });
          break;
        case 'Rating (Low to High)':
          filtered.sort((a, b) {
            final aRating = a.rating?.toDouble() ?? 0.0;
            final bRating = b.rating?.toDouble() ?? 0.0;
            return aRating.compareTo(bRating);
          });
          break;
        case 'Name (A-Z)':
          filtered.sort((a, b) => a.name.compareTo(b.name));
          break;
        case 'Name (Z-A)':
          filtered.sort((a, b) => b.name.compareTo(a.name));
          break;
        default:
          // Keep original order for 'Featured'
          break;
      }
    }

    setState(() {
      _filteredRestaurants = filtered;
    });
  }

  void _clearAllFilters() {
    final localizations = AppLocalizations.of(context)!;
    setState(() {
      _searchQuery = '';
      _selectedCuisine = localizations.all;
      _currentFilters = {};
      _filteredRestaurants = List.from(_allRestaurants);
    });
  }

  void _showFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RestaurantsFilterBottomSheet(
        onFiltersApplied: _onFiltersApplied,
      ),
    );
  }

  void _onRestaurantTap(RestaurantModel restaurant) {
    Navigator.pushNamed(
      context,
      '/restaurant-profile-screen',
      arguments: restaurant.id,
    );
  }

  void _onFavoriteToggle(RestaurantModel restaurant) {
    final localizations = AppLocalizations.of(context)!;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(localizations.favoriteComingSoon),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          localizations.restaurants,
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
            tooltip: localizations.sortAndFilter,
          ),
          SizedBox(width: 2.w),
        ],
      ),
      body: Column(
        children: [
          RestaurantsSearchBar(
            searchQuery: _searchQuery,
            onSearchChanged: _onSearchChanged,
            onFilterTap: _showFilterBottomSheet,
            recentSearches: _recentSearches,
          ),
          RestaurantFilterChips(
            cuisineTypes: _cuisineTypes,
            selectedCuisine: _selectedCuisine,
            onCuisineSelected: _onCuisineSelected,
          ),
          Expanded(
            child: _buildRestaurantsList(),
          ),
        ],
      ),
      bottomNavigationBar: const CustomBottomBar(currentIndex: 1),
    );
  }

  Widget _buildRestaurantsList() {
    if (_isLoading) {
      return _buildLoadingState();
    }

    if (_filteredRestaurants.isEmpty) {
      return RestaurantsEmptyState.noResults(
        onClearFilters: _clearAllFilters,
      );
    }

    return RefreshIndicator(
      onRefresh: _refreshRestaurants,
      color: AppTheme.lightTheme.colorScheme.primary,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _filteredRestaurants.length + (_isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _filteredRestaurants.length) {
            return _buildLoadingMoreIndicator();
          }

          final restaurant = _filteredRestaurants[index];

          return RestaurantCard(
            restaurant: restaurant,
            onTap: () => _onRestaurantTap(restaurant),
            onFavoriteToggle: () => _onFavoriteToggle(restaurant),
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
          height: 35.h,
          decoration: BoxDecoration(
            color: AppTheme.lightTheme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Container(
                height: 20.h,
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
                      Row(
                        children: List.generate(
                          3,
                          (index) => Container(
                            margin: EdgeInsets.only(right: 2.w),
                            height: 2.5.h,
                            width: 15.w,
                            decoration: BoxDecoration(
                              color: AppTheme.lightTheme.colorScheme.outline
                                  .withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
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