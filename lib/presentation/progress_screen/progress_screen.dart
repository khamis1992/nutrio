import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sizer/sizer.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../../services/nutrition_service.dart';
import '../../widgets/custom_bottom_bar.dart';

class ProgressScreen extends StatefulWidget {
  const ProgressScreen({Key? key}) : super(key: key);

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  Map<String, dynamic> _weeklyData = {};
  Map<String, int> _todaysTotals = {};
  bool _isLoading = true;
  DateTime _selectedWeek = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadNutritionData();
  }

  Future<void> _loadNutritionData() async {
    try {
      final weekStart = _getWeekStart(_selectedWeek);
      final futures = await Future.wait([
        NutritionService.instance.getWeeklyNutritionSummary(weekStart),
        NutritionService.instance.getTodaysTotals(),
      ]);

      if (mounted) {
        setState(() {
          _weeklyData = futures[0];
          _todaysTotals = futures[1] as Map<String, int>;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  DateTime _getWeekStart(DateTime date) {
    return date.subtract(Duration(days: date.weekday - 1));
  }

  void _previousWeek() {
    setState(() {
      _selectedWeek = _selectedWeek.subtract(const Duration(days: 7));
      _isLoading = true;
    });
    _loadNutritionData();
  }

  void _nextWeek() {
    final now = DateTime.now();
    final nextWeek = _selectedWeek.add(const Duration(days: 7));
    if (nextWeek.isBefore(now.add(const Duration(days: 1)))) {
      setState(() {
        _selectedWeek = nextWeek;
        _isLoading = true;
      });
      _loadNutritionData();
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final weekSummary = _weeklyData['week_summary'] ?? {};
    final dailyTotals =
        _weeklyData['daily_totals'] ?? <String, Map<String, int>>{};

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(
          localizations.progressDashboard,
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(4.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Today's Summary
                    _buildTodaysSummaryCard(localizations),
                    SizedBox(height: 3.h),

                    // Week Navigation
                    _buildWeekNavigation(localizations),
                    SizedBox(height: 2.h),

                    // Weekly Chart
                    _buildWeeklyChart(dailyTotals, localizations),
                    SizedBox(height: 3.h),

                    // Week Summary Stats
                    _buildWeekSummaryStats(weekSummary, localizations),
                    SizedBox(height: 3.h),

                    // Progress Insights
                    _buildProgressInsights(weekSummary, localizations),

                    SizedBox(height: 10.h), // Bottom padding
                  ],
                ),
              ),
            ),
      bottomNavigationBar: const CustomBottomBar(currentIndex: 3),
    );
  }

  Widget _buildTodaysSummaryCard(AppLocalizations localizations) {
    final calories = _todaysTotals['calories'] ?? 0;
    final protein = _todaysTotals['protein'] ?? 0;
    final carbs = _todaysTotals['carbs'] ?? 0;
    final fats = _todaysTotals['fats'] ?? 0;

    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2E7D32), Color(0xFF4CAF50)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.today,
                color: Colors.white,
                size: 6.w,
              ),
              SizedBox(width: 3.w),
              Text(
                localizations.todaysProgress,
                style: GoogleFonts.inter(
                  fontSize: 18.sp,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          SizedBox(height: 3.h),
          Row(
            children: [
              Expanded(
                child: _buildNutrientColumn(localizations.calories, calories,
                    localizations.kcal, Colors.white),
              ),
              Expanded(
                child: _buildNutrientColumn(localizations.protein, protein,
                    localizations.gram, Colors.white),
              ),
              Expanded(
                child: _buildNutrientColumn(localizations.carbs, carbs,
                    localizations.gram, Colors.white),
              ),
              Expanded(
                child: _buildNutrientColumn(
                    localizations.fats, fats, localizations.gram, Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWeekNavigation(AppLocalizations localizations) {
    final weekStart = _getWeekStart(_selectedWeek);
    final weekEnd = weekStart.add(const Duration(days: 6));

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          onPressed: _previousWeek,
          icon: const Icon(Icons.arrow_back_ios),
          color: const Color(0xFF2E7D32),
        ),
        Text(
          '${_formatShortDate(weekStart, localizations)} - ${_formatShortDate(weekEnd, localizations)}',
          style: GoogleFonts.inter(
            fontSize: 16.sp,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        IconButton(
          onPressed: _nextWeek,
          icon: const Icon(Icons.arrow_forward_ios),
          color: const Color(0xFF2E7D32),
        ),
      ],
    );
  }

  Widget _buildWeeklyChart(Map<String, Map<String, int>> dailyTotals,
      AppLocalizations localizations) {
    final weekStart = _getWeekStart(_selectedWeek);
    final chartData = <FlSpot>[];

    for (int i = 0; i < 7; i++) {
      final date = weekStart.add(Duration(days: i));
      final dateKey = date.toIso8601String().split('T')[0];
      final calories = dailyTotals[dateKey]?['calories'] ?? 0;
      chartData.add(FlSpot(i.toDouble(), calories.toDouble()));
    }

    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.weeklyCaloris,
            style: GoogleFonts.inter(
              fontSize: 16.sp,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          SizedBox(height: 2.h),
          SizedBox(
            height: 200,
            child: LineChart(
              LineChartData(
                lineBarsData: [
                  LineChartBarData(
                    spots: chartData,
                    isCurved: true,
                    color: const Color(0xFF2E7D32),
                    barWidth: 3,
                    dotData: const FlDotData(show: true),
                    belowBarData: BarAreaData(
                      show: true,
                      color: const Color(0xFF2E7D32).withAlpha(26),
                    ),
                  ),
                ],
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 40,
                      getTitlesWidget: (value, meta) {
                        return Text(
                          '${value.toInt()}',
                          style: GoogleFonts.inter(fontSize: 10.sp),
                        );
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (value, meta) {
                        final days = [
                          localizations.mon,
                          localizations.tue,
                          localizations.wed,
                          localizations.thu,
                          localizations.fri,
                          localizations.sat,
                          localizations.sun
                        ];
                        return Text(
                          days[value.toInt()],
                          style: GoogleFonts.inter(fontSize: 10.sp),
                        );
                      },
                    ),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                ),
                borderData: FlBorderData(show: false),
                gridData: const FlGridData(show: true),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeekSummaryStats(
      Map<String, dynamic> weekSummary, AppLocalizations localizations) {
    final avgCalories = weekSummary['avg_calories'] ?? 0;
    final avgProtein = weekSummary['avg_protein'] ?? 0;
    final avgCarbs = weekSummary['avg_carbs'] ?? 0;
    final avgFats = weekSummary['avg_fats'] ?? 0;
    final daysLogged = weekSummary['days_logged'] ?? 0;

    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                localizations.weeklyAverages,
                style: GoogleFonts.inter(
                  fontSize: 16.sp,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF2E7D32).withAlpha(26),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$daysLogged/7 ${localizations.daysLogged}',
                  style: GoogleFonts.inter(
                    fontSize: 11.sp,
                    color: const Color(0xFF2E7D32),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 3.h),
          Row(
            children: [
              Expanded(
                child: _buildNutrientColumn(localizations.avgCalories,
                    avgCalories, localizations.kcal, Colors.black87),
              ),
              Expanded(
                child: _buildNutrientColumn(localizations.avgProtein,
                    avgProtein, localizations.gram, Colors.black87),
              ),
              Expanded(
                child: _buildNutrientColumn(localizations.avgCarbs, avgCarbs,
                    localizations.gram, Colors.black87),
              ),
              Expanded(
                child: _buildNutrientColumn(localizations.avgFats, avgFats,
                    localizations.gram, Colors.black87),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProgressInsights(
      Map<String, dynamic> weekSummary, AppLocalizations localizations) {
    final daysLogged = weekSummary['days_logged'] ?? 0;
    final avgCalories = weekSummary['avg_calories'] ?? 0;

    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.insights,
            style: GoogleFonts.inter(
              fontSize: 16.sp,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
            ),
          ),
          SizedBox(height: 2.h),
          _buildInsightRow(
            Icons.calendar_today,
            localizations.consistency,
            '${localizations.yourLoggedText} $daysLogged ${localizations.outOf7DaysThisWeek}',
            daysLogged >= 5
                ? Colors.green
                : daysLogged >= 3
                    ? Colors.orange
                    : Colors.red,
          ),
          SizedBox(height: 2.h),
          _buildInsightRow(
            Icons.local_fire_department,
            localizations.dailyAverage,
            avgCalories > 0
                ? '$avgCalories ${localizations.caloriesPerDay}'
                : localizations.noCaloriesLoggedYet,
            avgCalories > 1500
                ? Colors.green
                : avgCalories > 1000
                    ? Colors.orange
                    : Colors.grey,
          ),
          SizedBox(height: 2.h),
          _buildInsightRow(
            Icons.trending_up,
            localizations.progress,
            daysLogged >= 5
                ? localizations.greatJobStayingConsistent
                : localizations.tryToLogMealsRegularly,
            daysLogged >= 5 ? Colors.green : Colors.orange,
          ),
        ],
      ),
    );
  }

  Widget _buildInsightRow(
      IconData icon, String title, String subtitle, Color color) {
    return Row(
      children: [
        Icon(
          icon,
          color: color,
          size: 5.w,
        ),
        SizedBox(width: 3.w),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
                ),
              ),
              Text(
                subtitle,
                style: GoogleFonts.inter(
                  fontSize: 12.sp,
                  color: Colors.grey[600],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildNutrientColumn(
      String label, int value, String unit, Color textColor) {
    return Column(
      children: [
        Text(
          '$value',
          style: GoogleFonts.inter(
            fontSize: 18.sp,
            fontWeight: FontWeight.bold,
            color: textColor,
          ),
        ),
        Text(
          unit,
          style: GoogleFonts.inter(
            fontSize: 10.sp,
            color: textColor.withAlpha(179),
          ),
        ),
        SizedBox(height: 1.h),
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 11.sp,
            color: textColor.withAlpha(204),
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildProgressCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
  }) {
    return Container(
      padding: EdgeInsets.all(4.w),
      decoration: BoxDecoration(
        color: const Color(0xFFF6F6F6),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(13),
            blurRadius: 5,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: const Color(0xFF2E7D32),
            size: 8.w,
          ),
          SizedBox(height: 2.w),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 24.sp,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 12.sp,
              fontWeight: FontWeight.w500,
              color: Colors.black87,
            ),
          ),
          Text(
            subtitle,
            style: GoogleFonts.inter(
              fontSize: 10.sp,
              color: Colors.grey[600],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  String _formatShortDate(DateTime date, AppLocalizations localizations) {
    final months = [
      localizations.jan,
      localizations.feb,
      localizations.mar,
      localizations.apr,
      localizations.may,
      localizations.jun,
      localizations.jul,
      localizations.aug,
      localizations.sep,
      localizations.oct,
      localizations.nov,
      localizations.dec
    ];

    return '${date.day} ${months[date.month - 1]}';
  }
}

extension on AppLocalizations {
  String get yourLoggedText => "You logged";
  String get outOf7DaysThisWeek => "out of 7 days this week";
}
