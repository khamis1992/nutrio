import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:sizer/sizer.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

import '../../../../core/app_export.dart';
import '../../../theme/app_theme.dart';

class WeeklyMacroSummary extends StatelessWidget {
  final Map<String, dynamic> macroData;

  const WeeklyMacroSummary({
    super.key,
    required this.macroData,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final localizations = AppLocalizations.of(context)!;

    final plannedCalories = macroData['planned_calories'] as int? ?? 0;
    final targetCalories = macroData['target_calories'] as int? ?? 2000;
    final plannedProtein = macroData['planned_protein'] as double? ?? 0.0;
    final targetProtein = macroData['target_protein'] as double? ?? 150.0;
    final plannedCarbs = macroData['planned_carbs'] as double? ?? 0.0;
    final targetCarbs = macroData['target_carbs'] as double? ?? 250.0;
    final plannedFat = macroData['planned_fat'] as double? ?? 0.0;
    final targetFat = macroData['target_fat'] as double? ?? 80.0;

    final caloriesProgress = targetCalories > 0
        ? (plannedCalories / targetCalories).clamp(0.0, 1.0)
        : 0.0;
    final proteinProgress = targetProtein > 0
        ? (plannedProtein / targetProtein).clamp(0.0, 1.0)
        : 0.0;
    final carbsProgress =
        targetCarbs > 0 ? (plannedCarbs / targetCarbs).clamp(0.0, 1.0) : 0.0;
    final fatProgress =
        targetFat > 0 ? (plannedFat / targetFat).clamp(0.0, 1.0) : 0.0;

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4.w, vertical: 1.h),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                localizations.weeklyMacroSummary,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface,
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 2.w, vertical: 0.5.h),
                decoration: BoxDecoration(
                  color: colorScheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  localizations.plannedVsTarget,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 3.h),
          Row(
            children: [
              // Macro chart
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: 25.h,
                  child: PieChart(
                    PieChartData(
                      sectionsSpace: 2,
                      centerSpaceRadius: 8.w,
                      sections: [
                        PieChartSectionData(
                          color: AppTheme.warningColor,
                          value: plannedProtein * 4, // Protein calories
                          title: '${(proteinProgress * 100).toInt()}%',
                          radius: 6.w,
                          titleStyle: theme.textTheme.labelSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        PieChartSectionData(
                          color: AppTheme.successColor,
                          value: plannedCarbs * 4, // Carb calories
                          title: '${(carbsProgress * 100).toInt()}%',
                          radius: 6.w,
                          titleStyle: theme.textTheme.labelSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        PieChartSectionData(
                          color: AppTheme.primaryLight,
                          value: plannedFat * 9, // Fat calories
                          title: '${(fatProgress * 100).toInt()}%',
                          radius: 6.w,
                          titleStyle: theme.textTheme.labelSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(width: 4.w),
              // Macro details
              Expanded(
                flex: 3,
                child: Column(
                  children: [
                    _buildMacroRow(
                      localizations.calories,
                      plannedCalories,
                      targetCalories,
                      localizations.cal,
                      caloriesProgress,
                      AppTheme.errorColor,
                      theme,
                    ),
                    SizedBox(height: 2.h),
                    _buildMacroRow(
                      localizations.protein,
                      plannedProtein.toInt(),
                      targetProtein.toInt(),
                      localizations.gram,
                      proteinProgress,
                      AppTheme.warningColor,
                      theme,
                    ),
                    SizedBox(height: 2.h),
                    _buildMacroRow(
                      localizations.carbs,
                      plannedCarbs.toInt(),
                      targetCarbs.toInt(),
                      localizations.gram,
                      carbsProgress,
                      AppTheme.successColor,
                      theme,
                    ),
                    SizedBox(height: 2.h),
                    _buildMacroRow(
                      localizations.fat,
                      plannedFat.toInt(),
                      targetFat.toInt(),
                      localizations.gram,
                      fatProgress,
                      AppTheme.primaryLight,
                      theme,
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 3.h),
          // Overall progress
          Container(
            padding: EdgeInsets.all(3.w),
            decoration: BoxDecoration(
              color: colorScheme.outline.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.overallProgress,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colorScheme.onSurface.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: 1.h),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${((caloriesProgress + proteinProgress + carbsProgress + fatProgress) / 4 * 100).toInt()}% ${localizations.complete}',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    Text(
                      '${plannedCalories}/${targetCalories} ${localizations.cal}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurface.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 1.h),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (caloriesProgress +
                            proteinProgress +
                            carbsProgress +
                            fatProgress) /
                        4,
                    backgroundColor: colorScheme.outline.withValues(alpha: 0.2),
                    valueColor:
                        AlwaysStoppedAnimation<Color>(colorScheme.primary),
                    minHeight: 6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMacroRow(
    String label,
    int planned,
    int target,
    String unit,
    double progress,
    Color color,
    ThemeData theme,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 3.w,
                  height: 3.w,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: 2.w),
                Text(
                  label,
                  style: theme.textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
              ],
            ),
            Text(
              '$planned/$target$unit',
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
        SizedBox(height: 0.5.h),
        ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: progress,
            backgroundColor: theme.colorScheme.outline.withValues(alpha: 0.2),
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 4,
          ),
        ),
      ],
    );
  }
}
