import '../models/meal_model.dart';
import '../models/restaurant_model.dart';
import './supabase_service.dart';

class MealService {
  static MealService? _instance;
  static MealService get instance => _instance ??= MealService._();

  MealService._();

  final _client = SupabaseService.instance.client;

  // Get all meals
  Future<List<MealModel>> getAllMeals() async {
    try {
      final response = await _client
          .from('meals')
          .select()
          .eq('available', true)
          .order('created_at', ascending: false);

      return (response as List).map((meal) => MealModel.fromMap(meal)).toList();
    } catch (error) {
      throw Exception('Failed to fetch meals: $error');
    }
  }

  // Get meals by category
  Future<List<MealModel>> getMealsByCategory(String categoryId) async {
    try {
      final response = await _client
          .from('meals')
          .select()
          .eq('category_id', categoryId)
          .eq('available', true)
          .order('created_at', ascending: false);

      return (response as List).map((meal) => MealModel.fromMap(meal)).toList();
    } catch (error) {
      throw Exception('Failed to fetch meals by category: $error');
    }
  }

  // Get meal by ID with restaurant info
  Future<Map<String, dynamic>> getMealWithRestaurant(String mealId) async {
    try {
      final response = await _client.from('meals').select('''
            *,
            restaurants (
              id,
              name,
              rating,
              location,
              image_url
            )
          ''').eq('id', mealId).single();

      return {
        'meal': MealModel.fromMap(response),
        'restaurant': response['restaurants'] != null
            ? RestaurantModel.fromMap(response['restaurants'])
            : null,
      };
    } catch (error) {
      throw Exception('Failed to fetch meal details: $error');
    }
  }

  // Get featured meals (top rated or recent)
  Future<List<MealModel>> getFeaturedMeals({int limit = 10}) async {
    try {
      final response = await _client
          .from('meals')
          .select()
          .eq('available', true)
          .order('created_at', ascending: false)
          .limit(limit);

      return (response as List).map((meal) => MealModel.fromMap(meal)).toList();
    } catch (error) {
      throw Exception('Failed to fetch featured meals: $error');
    }
  }

  // Search meals
  Future<List<MealModel>> searchMeals(String query) async {
    try {
      final response = await _client
          .from('meals')
          .select()
          .eq('available', true)
          .ilike('name', '%$query%')
          .order('created_at', ascending: false);

      return (response as List).map((meal) => MealModel.fromMap(meal)).toList();
    } catch (error) {
      throw Exception('Failed to search meals: $error');
    }
  }

  // Get meals by restaurant
  Future<List<MealModel>> getMealsByRestaurant(String restaurantId) async {
    try {
      final response = await _client
          .from('meals')
          .select()
          .eq('restaurant_id', restaurantId)
          .eq('available', true)
          .order('name', ascending: true);

      return (response as List).map((meal) => MealModel.fromMap(meal)).toList();
    } catch (error) {
      throw Exception('Failed to fetch restaurant meals: $error');
    }
  }
}
