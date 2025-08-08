import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/health_goal_model.dart';
import './supabase_service.dart';

class HealthGoalsService {
  static HealthGoalsService? _instance;
  static HealthGoalsService get instance =>
      _instance ??= HealthGoalsService._();

  HealthGoalsService._();

  SupabaseClient get _client => SupabaseService.instance.client;

  // Save user health goal
  Future<HealthGoalModel> saveHealthGoal({
    required String userId,
    required String goal,
    double? currentWeight,
    int? height,
    String? gender,
    int? age,
    double? targetWeight,
    String? activityLevel,
  }) async {
    try {
      final response = await _client
          .from('user_goals')
          .insert({
            'user_id': userId,
            'goal': goal,
            'current_weight': currentWeight,
            'height': height,
            'gender': gender,
            'age': age,
            'target_weight': targetWeight,
            'activity_level': activityLevel ?? 'moderate',
          })
          .select()
          .single();

      return HealthGoalModel.fromJson(response);
    } catch (error) {
      throw Exception('Failed to save health goal: $error');
    }
  }

  // Get user's current health goal
  Future<HealthGoalModel?> getUserHealthGoal(String userId) async {
    try {
      final response = await _client
          .from('user_goals')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(1);

      if (response.isEmpty) return null;

      return HealthGoalModel.fromJson(response.first);
    } catch (error) {
      throw Exception('Failed to fetch health goal: $error');
    }
  }

  // Update existing health goal
  Future<HealthGoalModel> updateHealthGoal({
    required String goalId,
    String? goal,
    double? currentWeight,
    int? height,
    String? gender,
    int? age,
    double? targetWeight,
    String? activityLevel,
  }) async {
    try {
      final updateData = <String, dynamic>{};

      if (goal != null) updateData['goal'] = goal;
      if (currentWeight != null) updateData['current_weight'] = currentWeight;
      if (height != null) updateData['height'] = height;
      if (gender != null) updateData['gender'] = gender;
      if (age != null) updateData['age'] = age;
      if (targetWeight != null) updateData['target_weight'] = targetWeight;
      if (activityLevel != null) updateData['activity_level'] = activityLevel;

      final response = await _client
          .from('user_goals')
          .update(updateData)
          .eq('id', goalId)
          .select()
          .single();

      return HealthGoalModel.fromJson(response);
    } catch (error) {
      throw Exception('Failed to update health goal: $error');
    }
  }

  // Check if user has completed health goal setup
  Future<bool> hasUserCompletedOnboarding(String userId) async {
    try {
      final response = await _client
          .from('user_goals')
          .select('id')
          .eq('user_id', userId)
          .limit(1);

      return response.isNotEmpty;
    } catch (error) {
      throw Exception('Failed to check onboarding status: $error');
    }
  }

  // Calculate BMI if weight and height are available
  double? calculateBMI(double? weight, int? height) {
    if (weight == null || height == null || height <= 0) return null;

    final heightInMeters = height / 100.0;
    return weight / (heightInMeters * heightInMeters);
  }

  // Get recommended calorie intake based on goal and user data
  int? calculateRecommendedCalories({
    required String goal,
    required String gender,
    required int age,
    required double weight,
    required int height,
    String activityLevel = 'moderate',
  }) {
    try {
      // Base Metabolic Rate calculation using Mifflin-St Jeor Equation
      double bmr;
      if (gender == 'male') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
      } else {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
      }

      // Activity level multipliers
      double activityMultiplier;
      switch (activityLevel) {
        case 'sedentary':
          activityMultiplier = 1.2;
          break;
        case 'light':
          activityMultiplier = 1.375;
          break;
        case 'moderate':
          activityMultiplier = 1.55;
          break;
        case 'active':
          activityMultiplier = 1.725;
          break;
        case 'very_active':
          activityMultiplier = 1.9;
          break;
        default:
          activityMultiplier = 1.55;
      }

      double totalCalories = bmr * activityMultiplier;

      // Adjust based on goal
      switch (goal) {
        case 'weight_loss':
          totalCalories -= 500; // 500 calorie deficit for weight loss
          break;
        case 'build_muscle':
          totalCalories += 300; // 300 calorie surplus for muscle building
          break;
        case 'maintain_weight':
        case 'medical_diet':
          // Keep calculated calories as is
          break;
      }

      return totalCalories.round();
    } catch (error) {
      return null;
    }
  }
}
