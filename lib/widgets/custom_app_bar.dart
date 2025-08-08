import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import '../widgets/custom_image_widget.dart';

/// Custom AppBar widget implementing Contemporary Wellness Minimalism design
/// with contextual actions and clean hierarchy for health and nutrition apps
class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool centerTitle;
  final bool showBackButton;
  final bool showLogo;
  final VoidCallback? onBackPressed;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double elevation;
  final PreferredSizeWidget? bottom;

  const CustomAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.centerTitle = true,
    this.showBackButton = true,
    this.showLogo = false,
    this.onBackPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.elevation = 2.0,
    this.bottom,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return AppBar(
        title: showLogo
            ? Row(mainAxisSize: MainAxisSize.min, children: [
                CustomImageWidget(
                    imageUrl: 'assets/images/logo.png',
                    width: 8.w, 
                    height: 8.w, 
                    fit: BoxFit.contain),
                SizedBox(width: 2.w),
                Text(title,
                    style: GoogleFonts.inter(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        color: foregroundColor ?? colorScheme.onSurface)),
              ])
            : Text(title,
                style: GoogleFonts.inter(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: foregroundColor ?? colorScheme.onSurface)),
        centerTitle: centerTitle,
        backgroundColor: backgroundColor ?? colorScheme.surface,
        foregroundColor: foregroundColor ?? colorScheme.onSurface,
        elevation: elevation,
        shadowColor: theme.shadowColor,
        surfaceTintColor: Colors.transparent,
        leading: leading ??
            (showBackButton && Navigator.canPop(context)
                ? IconButton(
                    icon: Icon(Icons.arrow_back_ios_new,
                        size: 20,
                        color: foregroundColor ?? colorScheme.onSurface),
                    onPressed: onBackPressed ?? () => Navigator.pop(context),
                    tooltip: 'Back')
                : null),
        actions: actions,
        bottom: bottom,
        automaticallyImplyLeading: false);
  }

  @override
  Size get preferredSize =>
      Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0.0));
}

/// Specialized AppBar variants for different screens
class CustomAppBarVariants {
  /// Home screen app bar with profile and notifications
  static CustomAppBar home(BuildContext context) {
    return CustomAppBar(
        title: 'NUTRIO',
        showLogo: true,
        showBackButton: false,
        actions: [
          IconButton(
              icon: const Icon(Icons.notifications_outlined, size: 24),
              onPressed: () {
                // Handle notifications
                ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Notifications')));
              },
              tooltip: 'Notifications'),
          IconButton(
              icon: const Icon(Icons.account_circle_outlined, size: 24),
              onPressed: () {
                // Handle profile navigation
                ScaffoldMessenger.of(context)
                    .showSnackBar(const SnackBar(content: Text('Profile')));
              },
              tooltip: 'Profile'),
          const SizedBox(width: 8),
        ]);
  }

  /// Meals screen app bar with search and filter
  static CustomAppBar meals(BuildContext context) {
    return CustomAppBar(title: 'Meals', actions: [
      IconButton(
          icon: const Icon(Icons.search_outlined, size: 24),
          onPressed: () {
            // Handle search
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('Search meals')));
          },
          tooltip: 'Search'),
      IconButton(
          icon: const Icon(Icons.filter_list_outlined, size: 24),
          onPressed: () {
            // Handle filter
            _showFilterBottomSheet(context);
          },
          tooltip: 'Filter'),
      const SizedBox(width: 8),
    ]);
  }

  /// Meal detail screen app bar with favorite and share
  static CustomAppBar mealDetail(BuildContext context,
      {bool isFavorite = false}) {
    return CustomAppBar(title: 'Meal Details', actions: [
      IconButton(
          icon: Icon(isFavorite ? Icons.favorite : Icons.favorite_border,
              size: 24, color: isFavorite ? Colors.red : null),
          onPressed: () {
            // Handle favorite toggle
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text(isFavorite
                    ? 'Removed from favorites'
                    : 'Added to favorites')));
          },
          tooltip: isFavorite ? 'Remove from favorites' : 'Add to favorites'),
      IconButton(
          icon: const Icon(Icons.share_outlined, size: 24),
          onPressed: () {
            // Handle share
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('Share meal')));
          },
          tooltip: 'Share'),
      const SizedBox(width: 8),
    ]);
  }

  /// My plan screen app bar with calendar and settings
  static CustomAppBar myPlan(BuildContext context) {
    return CustomAppBar(title: 'My Plan', actions: [
      IconButton(
          icon: const Icon(Icons.calendar_today_outlined, size: 24),
          onPressed: () {
            // Handle calendar view
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('Calendar view')));
          },
          tooltip: 'Calendar'),
      IconButton(
          icon: const Icon(Icons.settings_outlined, size: 24),
          onPressed: () {
            // Handle settings
            ScaffoldMessenger.of(context)
                .showSnackBar(const SnackBar(content: Text('Plan settings')));
          },
          tooltip: 'Settings'),
      const SizedBox(width: 8),
    ]);
  }

  /// Simple app bar for basic screens
  static CustomAppBar simple(String title) {
    return CustomAppBar(title: title);
  }

  /// Helper method to show filter bottom sheet
  static void _showFilterBottomSheet(BuildContext context) {
    showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) => Container(
            decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(20))),
            padding: const EdgeInsets.all(24),
            child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle bar
                  Center(
                      child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                              color: Theme.of(context).dividerColor,
                              borderRadius: BorderRadius.circular(2)))),
                  const SizedBox(height: 24),
                  Text('Filter Meals',
                      style: GoogleFonts.inter(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface)),
                  const SizedBox(height: 24),
                  // Filter options would go here
                  Text('Dietary Preferences',
                      style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Theme.of(context).colorScheme.onSurface)),
                  const SizedBox(height: 16),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    _FilterChip(label: 'Vegan', isSelected: false),
                    _FilterChip(label: 'Vegetarian', isSelected: true),
                    _FilterChip(label: 'Low Carb', isSelected: false),
                    _FilterChip(label: 'High Protein', isSelected: false),
                  ]),
                  const SizedBox(height: 32),
                  SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Apply Filters'))),
                  SizedBox(height: MediaQuery.of(context).padding.bottom),
                ])));
  }
}

/// Helper widget for filter chips
class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;

  const _FilterChip({
    required this.label,
    required this.isSelected,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return FilterChip(
        label: Text(label,
            style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? colorScheme.onPrimary
                    : colorScheme.onSurface)),
        selected: isSelected,
        onSelected: (selected) {
          // Handle selection
        },
        backgroundColor: colorScheme.surface,
        selectedColor: colorScheme.primary,
        checkmarkColor: colorScheme.onPrimary,
        side: BorderSide(
            color: isSelected ? colorScheme.primary : colorScheme.outline,
            width: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)));
  }
}