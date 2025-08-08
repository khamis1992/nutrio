import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:sizer/sizer.dart';

import '../../../../core/app_export.dart';

class NutritionInfoCard extends StatefulWidget {
  final Map<String, dynamic> nutritionData;

  const NutritionInfoCard({
    super.key,
    required this.nutritionData,
  });

  @override
  State<NutritionInfoCard> createState() => _NutritionInfoCardState();
}

class _NutritionInfoCardState extends State<NutritionInfoCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final calories =
        (widget.nutritionData['calories'] as num?)?.toDouble() ?? 0.0;
    final protein =
        (widget.nutritionData['protein'] as num?)?.toDouble() ?? 0.0;
    final carbs = (widget.nutritionData['carbs'] as num?)?.toDouble() ?? 0.0;
    final fats = (widget.nutritionData['fats'] as num?)?.toDouble() ?? 0.0;
    final fiber = (widget.nutritionData['fiber'] as num?)?.toDouble() ?? 0.0;
    final sugar = (widget.nutritionData['sugar'] as num?)?.toDouble() ?? 0.0;
    final sodium = (widget.nutritionData['sodium'] as num?)?.toDouble() ?? 0.0;

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
      decoration: BoxDecoration(
        color: AppTheme.lightTheme.colorScheme.surface,
        borderRadius: BorderRadius.circular(3.w),
        border: Border.all(
          color: AppTheme.lightTheme.dividerColor,
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // Header
          InkWell(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            borderRadius: BorderRadius.circular(3.w),
            child: Padding(
              padding: EdgeInsets.all(4.w),
              child: Row(
                children: [
                  CustomIconWidget(
                    iconName: 'local_dining',
                    color: AppTheme.lightTheme.colorScheme.primary,
                    size: 5.w,
                  ),
                  SizedBox(width: 3.w),
                  Expanded(
                    child: Text(
                      localizations.nutritionInformation,
                      style:
                          AppTheme.lightTheme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppTheme.lightTheme.colorScheme.onSurface,
                      ),
                    ),
                  ),
                  CustomIconWidget(
                    iconName: _isExpanded ? 'expand_less' : 'expand_more',
                    color: AppTheme.lightTheme.colorScheme.onSurface
                        .withValues(alpha: 0.6),
                    size: 5.w,
                  ),
                ],
              ),
            ),
          ),

          // Main macros (always visible)
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 4.w),
            child: Row(
              children: [
                Expanded(
                  child: _MacroCard(
                    label: localizations.calories,
                    value: calories.toInt().toString(),
                    unit: localizations.kcal,
                    color: AppTheme.errorColor,
                    percentage:
                        (calories / 2000 * 100).clamp(0, 100).toDouble(),
                    localizations: localizations,
                  ),
                ),
                SizedBox(width: 2.w),
                Expanded(
                  child: _MacroCard(
                    label: localizations.protein,
                    value: protein.toStringAsFixed(1),
                    unit: localizations.gram,
                    color: AppTheme.lightTheme.colorScheme.primary,
                    percentage: (protein / 50 * 100).clamp(0, 100).toDouble(),
                    localizations: localizations,
                  ),
                ),
                SizedBox(width: 2.w),
                Expanded(
                  child: _MacroCard(
                    label: localizations.carbs,
                    value: carbs.toStringAsFixed(1),
                    unit: localizations.gram,
                    color: AppTheme.warningColor,
                    percentage: (carbs / 300 * 100).clamp(0, 100).toDouble(),
                    localizations: localizations,
                  ),
                ),
                SizedBox(width: 2.w),
                Expanded(
                  child: _MacroCard(
                    label: localizations.fats,
                    value: fats.toStringAsFixed(1),
                    unit: localizations.gram,
                    color: AppTheme.successColor,
                    percentage: (fats / 65 * 100).clamp(0, 100).toDouble(),
                    localizations: localizations,
                  ),
                ),
              ],
            ),
          ),

          // Expanded details
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            height: _isExpanded ? null : 0,
            child: _isExpanded
                ? Padding(
                    padding: EdgeInsets.all(4.w),
                    child: Column(
                      children: [
                        Divider(
                          color: AppTheme.lightTheme.dividerColor,
                          height: 3.h,
                        ),
                        _DetailRow(
                            label: localizations.dietaryFiber,
                            value:
                                '${fiber.toStringAsFixed(1)}${localizations.gram}'),
                        _DetailRow(
                            label: localizations.totalSugars,
                            value:
                                '${sugar.toStringAsFixed(1)}${localizations.gram}'),
                        _DetailRow(
                            label: localizations.sodium,
                            value:
                                '${sodium.toStringAsFixed(0)}${localizations.mg}'),
                        SizedBox(height: 2.h),
                        Container(
                          padding: EdgeInsets.all(3.w),
                          decoration: BoxDecoration(
                            color: AppTheme.lightTheme.colorScheme.primary
                                .withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(2.w),
                          ),
                          child: Text(
                            localizations.dailyValueDisclaimer,
                            style: AppTheme.lightTheme.textTheme.bodySmall
                                ?.copyWith(
                              color: AppTheme.lightTheme.colorScheme.onSurface
                                  .withValues(alpha: 0.7),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),

          SizedBox(height: 2.h),
        ],
      ),
    );
  }
}

class _MacroCard extends StatelessWidget {
  final String label;
  final String value;
  final String unit;
  final Color color;
  final double percentage;
  final AppLocalizations localizations;

  const _MacroCard({
    required this.label,
    required this.value,
    required this.unit,
    required this.color,
    required this.percentage,
    required this.localizations,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(3.w),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(2.w),
        border: Border.all(
          color: color.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: AppTheme.lightTheme.textTheme.labelSmall?.copyWith(
              color: AppTheme.lightTheme.colorScheme.onSurface
                  .withValues(alpha: 0.7),
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: 1.h),
          RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: value,
                  style: AppTheme.lightTheme.textTheme.titleMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                TextSpan(
                  text: unit,
                  style: AppTheme.lightTheme.textTheme.labelSmall?.copyWith(
                    color: color.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 1.h),
          LinearProgressIndicator(
            value: percentage / 100,
            backgroundColor: color.withValues(alpha: 0.1),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 0.5.h,
          ),
          SizedBox(height: 0.5.h),
          Text(
            '${percentage.toStringAsFixed(0)}% ${localizations.dailyValue}',
            style: AppTheme.lightTheme.textTheme.labelSmall?.copyWith(
              color: AppTheme.lightTheme.colorScheme.onSurface
                  .withValues(alpha: 0.6),
              fontSize: 10.sp,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 1.h),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTheme.lightTheme.textTheme.bodyMedium?.copyWith(
              color: AppTheme.lightTheme.colorScheme.onSurface,
            ),
          ),
          Text(
            value,
            style: AppTheme.lightTheme.textTheme.bodyMedium?.copyWith(
              color: AppTheme.lightTheme.colorScheme.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
