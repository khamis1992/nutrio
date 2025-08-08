import '../models/meal_model.dart';
import '../models/nutrition_log_model.dart';
import './auth_service.dart';
import './supabase_service.dart';

class NutritionService {
  static NutritionService? _instance;
  static NutritionService get instance => _instance ??= NutritionService._();

  NutritionService._();

  final _client = SupabaseService.instance.client;

  // Log meal as eaten
  Future<NutritionLogModel> logMealAsEaten(MealModel meal) async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final logData = {
        'user_id': userId,
        'meal_id': meal.id,
        'date': DateTime.now().toIso8601String().split('T')[0],
        'calories': meal.calories ?? 0,
        'protein': meal.protein ?? 0,
        'carbs': meal.carbs ?? 0,
        'fats': meal.fats ?? 0,
      };

      final response = await _client
          .from('user_nutrition_log')
          .insert(logData)
          .select()
          .single();

      return NutritionLogModel.fromMap(response);
    } catch (error) {
      throw Exception('Failed to log meal: $error');
    }
  }

  // Get nutrition log for a specific date
  Future<List<NutritionLogModel>> getNutritionLogByDate(DateTime date) async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final dateString = date.toIso8601String().split('T')[0];

      final response = await _client
          .from('user_nutrition_log')
          .select()
          .eq('user_id', userId)
          .eq('date', dateString)
          .order('created_at', ascending: false);

      return (response as List)
          .map((log) => NutritionLogModel.fromMap(log))
          .toList();
    } catch (error) {
      throw Exception('Failed to fetch nutrition log: $error');
    }
  }

  // Get weekly nutrition summary
  Future<Map<String, dynamic>> getWeeklyNutritionSummary(
      DateTime weekStart) async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final weekEnd = weekStart.add(const Duration(days: 6));

      final response = await _client
          .from('user_nutrition_log')
          .select()
          .eq('user_id', userId)
          .gte('date', weekStart.toIso8601String().split('T')[0])
          .lte('date', weekEnd.toIso8601String().split('T')[0])
          .order('date', ascending: true);

      final logs = (response as List)
          .map((log) => NutritionLogModel.fromMap(log))
          .toList();

      // Group by date and calculate daily totals
      final dailyTotals = <String, Map<String, int>>{};
      for (final log in logs) {
        final dateKey = log.date.toIso8601String().split('T')[0];
        dailyTotals[dateKey] = dailyTotals[dateKey] ??
            {
              'calories': 0,
              'protein': 0,
              'carbs': 0,
              'fats': 0,
            };

        dailyTotals[dateKey]!['calories'] =
            (dailyTotals[dateKey]!['calories']! + log.calories);
        dailyTotals[dateKey]!['protein'] =
            (dailyTotals[dateKey]!['protein']! + log.protein);
        dailyTotals[dateKey]!['carbs'] =
            (dailyTotals[dateKey]!['carbs']! + log.carbs);
        dailyTotals[dateKey]!['fats'] =
            (dailyTotals[dateKey]!['fats']! + log.fats);
      }

      // Calculate week totals and averages
      int totalCalories = 0;
      int totalProtein = 0;
      int totalCarbs = 0;
      int totalFats = 0;
      int daysLogged = dailyTotals.length;

      for (final daily in dailyTotals.values) {
        totalCalories += daily['calories']!;
        totalProtein += daily['protein']!;
        totalCarbs += daily['carbs']!;
        totalFats += daily['fats']!;
      }

      return {
        'daily_totals': dailyTotals,
        'week_summary': {
          'total_calories': totalCalories,
          'total_protein': totalProtein,
          'total_carbs': totalCarbs,
          'total_fats': totalFats,
          'avg_calories':
              daysLogged > 0 ? (totalCalories / daysLogged).round() : 0,
          'avg_protein':
              daysLogged > 0 ? (totalProtein / daysLogged).round() : 0,
          'avg_carbs': daysLogged > 0 ? (totalCarbs / daysLogged).round() : 0,
          'avg_fats': daysLogged > 0 ? (totalFats / daysLogged).round() : 0,
          'days_logged': daysLogged,
        },
      };
    } catch (error) {
      throw Exception('Failed to fetch weekly summary: $error');
    }
  }

  // Get daily totals for today
  Future<Map<String, int>> getTodaysTotals() async {
    try {
      final today = DateTime.now();
      final logs = await getNutritionLogByDate(today);

      int calories = 0;
      int protein = 0;
      int carbs = 0;
      int fats = 0;

      for (final log in logs) {
        calories += log.calories;
        protein += log.protein;
        carbs += log.carbs;
        fats += log.fats;
      }

      return {
        'calories': calories,
        'protein': protein,
        'carbs': carbs,
        'fats': fats,
      };
    } catch (error) {
      throw Exception('Failed to fetch today\'s totals: $error');
    }
  }
}
