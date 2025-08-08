import '../models/restaurant_model.dart';
import '../models/meal_model.dart';
import './supabase_service.dart';

class RestaurantService {
  static RestaurantService? _instance;
  static RestaurantService get instance => _instance ??= RestaurantService._();

  RestaurantService._();

  final _client = SupabaseService.instance.client;

  // Get all active restaurants
  Future<List<RestaurantModel>> getAllRestaurants() async {
    try {
      final response = await _client
          .from('restaurants')
          .select()
          .eq('active', true)
          .order('name', ascending: true);

      return (response as List)
          .map((restaurant) => RestaurantModel.fromMap(restaurant))
          .toList();
    } catch (error) {
      throw Exception('Failed to fetch restaurants: $error');
    }
  }

  // Get restaurants with filtering
  Future<List<RestaurantModel>> getFilteredRestaurants({
    String? searchQuery,
    String? cuisineType,
    List<String>? dietaryTags,
    double? minRating,
  }) async {
    try {
      var query = _client.from('restaurants').select().eq('active', true);

      // Apply search filter
      if (searchQuery != null && searchQuery.isNotEmpty) {
        query = query.ilike('name', '%$searchQuery%');
      }

      // Apply cuisine filter
      if (cuisineType != null &&
          cuisineType.isNotEmpty &&
          cuisineType != 'All') {
        query = query.eq('cuisine_type', cuisineType);
      }

      // Apply dietary tags filter
      if (dietaryTags != null && dietaryTags.isNotEmpty) {
        for (String tag in dietaryTags) {
          query = query.contains('dietary_tags', [tag]);
        }
      }

      // Apply rating filter
      if (minRating != null) {
        query = query.gte('rating', minRating);
      }

      final response = await query.order('rating', ascending: false);

      return (response as List)
          .map((restaurant) => RestaurantModel.fromMap(restaurant))
          .toList();
    } catch (error) {
      throw Exception('Failed to fetch filtered restaurants: $error');
    }
  }

  // Get restaurant by ID
  Future<RestaurantModel?> getRestaurantById(String restaurantId) async {
    try {
      final response = await _client
          .from('restaurants')
          .select()
          .eq('id', restaurantId)
          .eq('active', true)
          .single();

      return RestaurantModel.fromMap(response);
    } catch (error) {
      throw Exception('Failed to fetch restaurant details: $error');
    }
  }

  // Get restaurant with its meals
  Future<Map<String, dynamic>> getRestaurantWithMeals(
      String restaurantId) async {
    try {
      // Get restaurant details
      final restaurant = await getRestaurantById(restaurantId);

      if (restaurant == null) {
        throw Exception('Restaurant not found');
      }

      // Get restaurant meals
      final mealsResponse = await _client
          .from('meals')
          .select()
          .eq('restaurant_id', restaurantId)
          .eq('available', true)
          .order('name', ascending: true);

      final meals = (mealsResponse as List)
          .map((meal) => MealModel.fromMap(meal))
          .toList();

      return {
        'restaurant': restaurant,
        'meals': meals,
      };
    } catch (error) {
      throw Exception('Failed to fetch restaurant with meals: $error');
    }
  }

  // Get unique cuisine types for filtering
  Future<List<String>> getCuisineTypes() async {
    try {
      final response = await _client
          .from('restaurants')
          .select('cuisine_type')
          .eq('active', true)
          .not('cuisine_type', 'is', null);

      final uniqueCuisines = <String>{};
      for (var item in response as List) {
        final cuisine = item['cuisine_type'] as String?;
        if (cuisine != null && cuisine.isNotEmpty) {
          uniqueCuisines.add(cuisine);
        }
      }

      final cuisineList = uniqueCuisines.toList()..sort();
      return ['All', ...cuisineList];
    } catch (error) {
      throw Exception('Failed to fetch cuisine types: $error');
    }
  }

  // Get unique dietary tags for filtering
  Future<List<String>> getDietaryTags() async {
    try {
      final response = await _client
          .from('restaurants')
          .select('dietary_tags')
          .eq('active', true)
          .not('dietary_tags', 'is', null);

      final uniqueTags = <String>{};
      for (var item in response as List) {
        final tags = item['dietary_tags'] as List?;
        if (tags != null) {
          for (var tag in tags) {
            if (tag != null && tag.toString().isNotEmpty) {
              uniqueTags.add(tag.toString());
            }
          }
        }
      }

      return uniqueTags.toList()..sort();
    } catch (error) {
      throw Exception('Failed to fetch dietary tags: $error');
    }
  }

  // Search restaurants by name
  Future<List<RestaurantModel>> searchRestaurants(String query) async {
    try {
      final response = await _client
          .from('restaurants')
          .select()
          .eq('active', true)
          .ilike('name', '%$query%')
          .order('rating', ascending: false);

      return (response as List)
          .map((restaurant) => RestaurantModel.fromMap(restaurant))
          .toList();
    } catch (error) {
      throw Exception('Failed to search restaurants: $error');
    }
  }
}
