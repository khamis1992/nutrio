import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';

import '../../../../core/app_export.dart';

class PlannedMealCard extends StatefulWidget {
  final Map<String, dynamic> mealData;
  final VoidCallback onMarkAsEaten;
  final VoidCallback onRemove;
  final VoidCallback onSwap;
  final VoidCallback onViewDetails;

  const PlannedMealCard({
    super.key,
    required this.mealData,
    required this.onMarkAsEaten,
    required this.onRemove,
    required this.onSwap,
    required this.onViewDetails,
  });

  @override
  State<PlannedMealCard> createState() => _PlannedMealCardState();
}

class _PlannedMealCardState extends State<PlannedMealCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<Offset> _slideAnimation;
  bool _isSwipeActive = false;
  double _swipeOffset = 0.0;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _slideAnimation = Tween<Offset>(
      begin: Offset.zero,
      end: const Offset(0.3, 0),
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final mealName = widget.mealData['name'] as String? ?? 'Unknown Meal';
    final mealType = widget.mealData['meal_type'] as String? ?? 'lunch';
    final imageUrl = widget.mealData['image_url'] as String? ?? '';
    final calories = widget.mealData['calories'] as int? ?? 0;
    final protein = widget.mealData['protein'] as double? ?? 0.0;
    final carbs = widget.mealData['carbs'] as double? ?? 0.0;
    final fat = widget.mealData['fat'] as double? ?? 0.0;
    final restaurantName =
        widget.mealData['restaurant_name'] as String? ?? 'Unknown Restaurant';

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
      child: Stack(
        children: [
          // Background action buttons
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: colorScheme.surface,
              ),
              child: Row(
                children: [
                  // Mark as eaten (left swipe action)
                  Expanded(
                    child: GestureDetector(
                      onTap: widget.onMarkAsEaten,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppTheme.successColor,
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(16),
                            bottomLeft: Radius.circular(16),
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            CustomIconWidget(
                              iconName: 'check_circle',
                              size: 24,
                              color: Colors.white,
                            ),
                            SizedBox(height: 0.5.h),
                            Text(
                              'Mark as\nEaten',
                              textAlign: TextAlign.center,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Remove and swap actions (right side)
                  Expanded(
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: widget.onSwap,
                            child: Container(
                              color: colorScheme.primary,
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CustomIconWidget(
                                    iconName: 'swap_horiz',
                                    size: 24,
                                    color: Colors.white,
                                  ),
                                  SizedBox(height: 0.5.h),
                                  Text(
                                    'Swap',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: widget.onRemove,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppTheme.errorColor,
                                borderRadius: const BorderRadius.only(
                                  topRight: Radius.circular(16),
                                  bottomRight: Radius.circular(16),
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CustomIconWidget(
                                    iconName: 'delete',
                                    size: 24,
                                    color: Colors.white,
                                  ),
                                  SizedBox(height: 0.5.h),
                                  Text(
                                    'Remove',
                                    style: theme.textTheme.labelSmall?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Main meal card
          GestureDetector(
            onPanUpdate: (details) {
              setState(() {
                _swipeOffset += details.delta.dx;
                _swipeOffset = _swipeOffset.clamp(-100.0, 100.0);
              });
            },
            onPanEnd: (details) {
              if (_swipeOffset.abs() > 50) {
                if (_swipeOffset > 0) {
                  // Swiped right - mark as eaten
                  widget.onMarkAsEaten();
                } else {
                  // Swiped left - show remove/swap options
                  _animationController.forward();
                  setState(() {
                    _isSwipeActive = true;
                  });
                }
              }
              setState(() {
                _swipeOffset = 0.0;
              });
            },
            onTap: widget.onViewDetails,
            onLongPress: _showContextMenu,
            child: Transform.translate(
              offset: Offset(_swipeOffset, 0),
              child: Container(
                padding: EdgeInsets.all(4.w),
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: theme.shadowColor,
                      offset: const Offset(0, 2),
                      blurRadius: 8,
                      spreadRadius: 0,
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Meal image
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: CustomImageWidget(
                        imageUrl: imageUrl,
                        width: 20.w,
                        height: 20.w,
                        fit: BoxFit.cover,
                      ),
                    ),
                    SizedBox(width: 4.w),
                    // Meal details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: EdgeInsets.symmetric(
                                    horizontal: 2.w, vertical: 0.5.h),
                                decoration: BoxDecoration(
                                  color: _getMealTypeColor(mealType)
                                      .withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  _getMealTypeLabel(mealType),
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: _getMealTypeColor(mealType),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                              const Spacer(),
                              CustomIconWidget(
                                iconName: 'more_vert',
                                size: 20,
                                color: colorScheme.onSurface
                                    .withValues(alpha: 0.5),
                              ),
                            ],
                          ),
                          SizedBox(height: 1.h),
                          Text(
                            mealName,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: colorScheme.onSurface,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 0.5.h),
                          Text(
                            restaurantName,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color:
                                  colorScheme.onSurface.withValues(alpha: 0.6),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: 1.h),
                          Row(
                            children: [
                              _buildMacroChip(
                                '${calories}cal',
                                CustomIconWidget(
                                  iconName: 'local_fire_department',
                                  size: 14,
                                  color: AppTheme.warningColor,
                                ),
                                theme,
                              ),
                              SizedBox(width: 2.w),
                              _buildMacroChip(
                                '${protein.toInt()}g P',
                                null,
                                theme,
                              ),
                              SizedBox(width: 2.w),
                              _buildMacroChip(
                                '${carbs.toInt()}g C',
                                null,
                                theme,
                              ),
                              SizedBox(width: 2.w),
                              _buildMacroChip(
                                '${fat.toInt()}g F',
                                null,
                                theme,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMacroChip(String text, Widget? icon, ThemeData theme) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 2.w, vertical: 0.5.h),
      decoration: BoxDecoration(
        color: theme.colorScheme.outline.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            icon,
            SizedBox(width: 1.w),
          ],
          Text(
            text,
            style: theme.textTheme.labelSmall?.copyWith(
              fontWeight: FontWeight.w500,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Color _getMealTypeColor(String mealType) {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return AppTheme.warningColor;
      case 'lunch':
        return AppTheme.successColor;
      case 'dinner':
        return AppTheme.primaryLight;
      case 'snack':
        return AppTheme.secondaryLight;
      default:
        return AppTheme.primaryLight;
    }
  }

  String _getMealTypeLabel(String mealType) {
    return mealType.substring(0, 1).toUpperCase() +
        mealType.substring(1).toLowerCase();
  }

  void _showContextMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: EdgeInsets.all(4.w),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 10.w,
              height: 0.5.h,
              decoration: BoxDecoration(
                color: Theme.of(context).dividerColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            SizedBox(height: 2.h),
            _buildContextMenuItem(
              'View Details',
              'visibility',
              widget.onViewDetails,
            ),
            _buildContextMenuItem(
              'Mark as Eaten',
              'check_circle',
              widget.onMarkAsEaten,
            ),
            _buildContextMenuItem(
              'Swap Meal',
              'swap_horiz',
              widget.onSwap,
            ),
            _buildContextMenuItem(
              'Remove from Plan',
              'delete',
              widget.onRemove,
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom),
          ],
        ),
      ),
    );
  }

  Widget _buildContextMenuItem(
      String title, String iconName, VoidCallback onTap) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return ListTile(
      leading: CustomIconWidget(
        iconName: iconName,
        size: 24,
        color: colorScheme.onSurface,
      ),
      title: Text(
        title,
        style: theme.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
      onTap: () {
        Navigator.pop(context);
        onTap();
      },
    );
  }
}
