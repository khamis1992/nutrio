import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../../core/app_export.dart';

class MealsFilterBottomSheet extends StatefulWidget {
  final Function(Map<String, dynamic>) onFiltersApplied;

  const MealsFilterBottomSheet({
    super.key,
    required this.onFiltersApplied,
  });

  @override
  State<MealsFilterBottomSheet> createState() => _MealsFilterBottomSheetState();
}

class _MealsFilterBottomSheetState extends State<MealsFilterBottomSheet> {
  final List<String> _selectedDietaryRestrictions = [];
  final List<String> _selectedRestaurants = [];
  RangeValues _caloriesRange = const RangeValues(200, 800);
  RangeValues _priceRange = const RangeValues(15, 75);
  String _selectedSort = 'Featured';

  final List<String> _dietaryOptions = [
    'Vegan',
    'Vegetarian',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Low-Carb',
    'Keto',
    'High Protein',
    'Mediterranean',
    'Halal',
  ];

  final List<Map<String, dynamic>> _restaurants = [
    {
      'name': 'Green Garden',
      'logo':
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&h=100&fit=crop'
    },
    {
      'name': 'Healthy Bites',
      'logo':
          'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop'
    },
    {
      'name': 'Fresh Kitchen',
      'logo':
          'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=100&fit=crop'
    },
    {
      'name': 'Nutri Bowl',
      'logo':
          'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=100&h=100&fit=crop'
    },
    {
      'name': 'Fit Meals',
      'logo':
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=100&h=100&fit=crop'
    },
  ];

  final List<String> _sortOptions = [
    'Featured',
    'Newest',
    'Calories (Low to High)',
    'Calories (High to Low)',
    'Price (Low to High)',
    'Price (High to Low)',
    'Rating',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 90.h,
      decoration: BoxDecoration(
        color: AppTheme.lightTheme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.symmetric(horizontal: 6.w),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSortSection(),
                  SizedBox(height: 3.h),
                  _buildDietaryRestrictionsSection(),
                  SizedBox(height: 3.h),
                  _buildCaloriesRangeSection(),
                  SizedBox(height: 3.h),
                  _buildPriceRangeSection(),
                  SizedBox(height: 3.h),
                  _buildRestaurantsSection(),
                  SizedBox(height: 4.h),
                ],
              ),
            ),
          ),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.all(6.w),
      child: Column(
        children: [
          Container(
            width: 10.w,
            height: 0.5.h,
            decoration: BoxDecoration(
              color: AppTheme.lightTheme.colorScheme.outline,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          SizedBox(height: 2.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Filter Meals',
                style: TextStyle(
                  fontSize: 20.sp,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.lightTheme.colorScheme.onSurface,
                ),
              ),
              TextButton(
                onPressed: _clearAllFilters,
                child: Text(
                  'Clear All',
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.lightTheme.colorScheme.primary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSortSection() {
    return _buildExpandableSection(
      title: 'Sort By',
      child: Column(
        children: _sortOptions.map((option) {
          return RadioListTile<String>(
            title: Text(
              option,
              style: TextStyle(
                fontSize: 14.sp,
                fontWeight: FontWeight.w400,
                color: AppTheme.lightTheme.colorScheme.onSurface,
              ),
            ),
            value: option,
            groupValue: _selectedSort,
            onChanged: (value) {
              setState(() {
                _selectedSort = value!;
              });
            },
            activeColor: AppTheme.lightTheme.colorScheme.primary,
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDietaryRestrictionsSection() {
    return _buildExpandableSection(
      title: 'Dietary Preferences',
      child: Wrap(
        spacing: 2.w,
        runSpacing: 1.h,
        children: _dietaryOptions.map((option) {
          final isSelected = _selectedDietaryRestrictions.contains(option);
          return FilterChip(
            label: Text(
              option,
              style: TextStyle(
                fontSize: 12.sp,
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? AppTheme.lightTheme.colorScheme.onPrimary
                    : AppTheme.lightTheme.colorScheme.onSurface,
              ),
            ),
            selected: isSelected,
            onSelected: (selected) {
              setState(() {
                if (selected) {
                  _selectedDietaryRestrictions.add(option);
                } else {
                  _selectedDietaryRestrictions.remove(option);
                }
              });
            },
            backgroundColor: AppTheme.lightTheme.colorScheme.surface,
            selectedColor: AppTheme.lightTheme.colorScheme.primary,
            checkmarkColor: AppTheme.lightTheme.colorScheme.onPrimary,
            side: BorderSide(
              color: isSelected
                  ? AppTheme.lightTheme.colorScheme.primary
                  : AppTheme.lightTheme.colorScheme.outline,
              width: 1,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildCaloriesRangeSection() {
    return _buildExpandableSection(
      title: 'Calories Range',
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_caloriesRange.start.round()} cal',
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.lightTheme.colorScheme.primary,
                ),
              ),
              Text(
                '${_caloriesRange.end.round()} cal',
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.lightTheme.colorScheme.primary,
                ),
              ),
            ],
          ),
          RangeSlider(
            values: _caloriesRange,
            min: 100,
            max: 1000,
            divisions: 18,
            activeColor: AppTheme.lightTheme.colorScheme.primary,
            inactiveColor:
                AppTheme.lightTheme.colorScheme.primary.withValues(alpha: 0.3),
            onChanged: (values) {
              setState(() {
                _caloriesRange = values;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildPriceRangeSection() {
    return _buildExpandableSection(
      title: 'Price Range (QAR)',
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'QAR ${_priceRange.start.round()}',
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.lightTheme.colorScheme.primary,
                ),
              ),
              Text(
                'QAR ${_priceRange.end.round()}',
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.lightTheme.colorScheme.primary,
                ),
              ),
            ],
          ),
          RangeSlider(
            values: _priceRange,
            min: 10,
            max: 100,
            divisions: 18,
            activeColor: AppTheme.lightTheme.colorScheme.primary,
            inactiveColor:
                AppTheme.lightTheme.colorScheme.primary.withValues(alpha: 0.3),
            onChanged: (values) {
              setState(() {
                _priceRange = values;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildRestaurantsSection() {
    return _buildExpandableSection(
      title: 'Restaurants',
      child: Column(
        children: _restaurants.map((restaurant) {
          final isSelected = _selectedRestaurants.contains(restaurant['name']);
          return CheckboxListTile(
            title: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CustomImageWidget(
                    imageUrl: restaurant['logo'] as String,
                    width: 10.w,
                    height: 10.w,
                    fit: BoxFit.cover,
                  ),
                ),
                SizedBox(width: 3.w),
                Expanded(
                  child: Text(
                    restaurant['name'] as String,
                    style: TextStyle(
                      fontSize: 14.sp,
                      fontWeight: FontWeight.w400,
                      color: AppTheme.lightTheme.colorScheme.onSurface,
                    ),
                  ),
                ),
              ],
            ),
            value: isSelected,
            onChanged: (value) {
              setState(() {
                if (value == true) {
                  _selectedRestaurants.add(restaurant['name'] as String);
                } else {
                  _selectedRestaurants.remove(restaurant['name']);
                }
              });
            },
            activeColor: AppTheme.lightTheme.colorScheme.primary,
            controlAffinity: ListTileControlAffinity.trailing,
          );
        }).toList(),
      ),
    );
  }

  Widget _buildExpandableSection({
    required String title,
    required Widget child,
  }) {
    return ExpansionTile(
      title: Text(
        title,
        style: TextStyle(
          fontSize: 16.sp,
          fontWeight: FontWeight.w600,
          color: AppTheme.lightTheme.colorScheme.onSurface,
        ),
      ),
      iconColor: AppTheme.lightTheme.colorScheme.primary,
      collapsedIconColor: AppTheme.lightTheme.colorScheme.onSurface,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
          child: child,
        ),
      ],
    );
  }

  Widget _buildActionButtons() {
    return Container(
      padding: EdgeInsets.all(6.w),
      decoration: BoxDecoration(
        color: AppTheme.lightTheme.colorScheme.surface,
        border: Border(
          top: BorderSide(
            color:
                AppTheme.lightTheme.colorScheme.outline.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: 2.h),
                  side: BorderSide(
                    color: AppTheme.lightTheme.colorScheme.outline,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            SizedBox(width: 4.w),
            Expanded(
              flex: 2,
              child: ElevatedButton(
                onPressed: _applyFilters,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.lightTheme.colorScheme.primary,
                  foregroundColor: AppTheme.lightTheme.colorScheme.onPrimary,
                  padding: EdgeInsets.symmetric(vertical: 2.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Apply Filters',
                  style: TextStyle(
                    fontSize: 14.sp,
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

  void _clearAllFilters() {
    setState(() {
      _selectedDietaryRestrictions.clear();
      _selectedRestaurants.clear();
      _caloriesRange = const RangeValues(200, 800);
      _priceRange = const RangeValues(15, 75);
      _selectedSort = 'Featured';
    });
  }

  void _applyFilters() {
    final filters = {
      'sort': _selectedSort,
      'dietaryRestrictions': _selectedDietaryRestrictions,
      'restaurants': _selectedRestaurants,
      'caloriesRange': {
        'min': _caloriesRange.start.round(),
        'max': _caloriesRange.end.round(),
      },
      'priceRange': {
        'min': _priceRange.start.round(),
        'max': _priceRange.end.round(),
      },
    };

    widget.onFiltersApplied(filters);
    Navigator.pop(context);
  }
}
