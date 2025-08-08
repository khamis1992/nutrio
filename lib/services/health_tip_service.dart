import '../models/health_tip_model.dart';
import './supabase_service.dart';
import './localization_service.dart';
import 'dart:math';

class HealthTipService {
  static HealthTipService? _instance;
  static HealthTipService get instance => _instance ??= HealthTipService._();

  HealthTipService._();

  final _client = SupabaseService.instance.client;

  // Get all active health tips based on current language
  Future<List<HealthTipModel>> getAllHealthTips() async {
    try {
      final currentLanguage = LocalizationService.instance.currentLanguageCode;

      final response = await _client
          .from('health_tips')
          .select()
          .eq('is_active', true)
          .eq('language', currentLanguage)
          .order('display_order', ascending: true);

      return (response as List)
          .map((tip) => HealthTipModel.fromMap(tip))
          .toList();
    } catch (error) {
      throw Exception('Failed to fetch health tips: $error');
    }
  }

  // Get health tip of the day (random tip) based on current language
  Future<HealthTipModel?> getHealthTipOfTheDay() async {
    try {
      final currentLanguage = LocalizationService.instance.currentLanguageCode;

      final response = await _client
          .from('health_tips')
          .select()
          .eq('is_active', true)
          .eq('language', currentLanguage);

      final tips =
          (response as List).map((tip) => HealthTipModel.fromMap(tip)).toList();

      if (tips.isEmpty) return null;

      // Get a random tip based on current day to ensure consistency throughout the day
      final dayOfYear =
          DateTime.now().difference(DateTime(DateTime.now().year, 1, 1)).inDays;
      final random = Random(dayOfYear);
      return tips[random.nextInt(tips.length)];
    } catch (error) {
      throw Exception('Failed to fetch health tip of the day: $error');
    }
  }

  // Get health tip with localized content based on current language
  Future<HealthTipModel?> getLocalizedHealthTip(String tipId) async {
    try {
      final currentLanguage = LocalizationService.instance.currentLanguageCode;

      final response = await _client
          .from('health_tips')
          .select()
          .eq('id', tipId)
          .eq('is_active', true)
          .single();

      return HealthTipModel.fromMap(response,
          preferredLanguage: currentLanguage);
          return null;
    } catch (error) {
      throw Exception('Failed to fetch localized health tip: $error');
    }
  }

  // Get health tips by category based on current language
  Future<List<HealthTipModel>> getHealthTipsByCategory(String category) async {
    try {
      final currentLanguage = LocalizationService.instance.currentLanguageCode;

      final response = await _client
          .from('health_tips')
          .select()
          .eq('is_active', true)
          .eq('language', currentLanguage)
          .eq('category', category)
          .order('display_order', ascending: true);

      return (response as List)
          .map((tip) => HealthTipModel.fromMap(tip))
          .toList();
    } catch (error) {
      throw Exception('Failed to fetch health tips by category: $error');
    }
  }

  // Get random health tips based on current language
  Future<List<HealthTipModel>> getRandomHealthTips(int count) async {
    try {
      final allTips = await getAllHealthTips();

      if (allTips.isEmpty) return [];

      final random = Random();
      final shuffledTips = List<HealthTipModel>.from(allTips);
      shuffledTips.shuffle(random);

      return shuffledTips.take(count).toList();
    } catch (error) {
      throw Exception('Failed to fetch random health tips: $error');
    }
  }

  // Get available categories based on current language
  Future<List<String>> getCategories() async {
    try {
      final currentLanguage = LocalizationService.instance.currentLanguageCode;

      final response = await _client
          .from('health_tips')
          .select('category')
          .eq('is_active', true)
          .eq('language', currentLanguage);

      final categories = <String>{};
      for (var item in response as List) {
        final category = item['category'] as String?;
        if (category != null && category.isNotEmpty) {
          categories.add(category);
        }
      }

      return categories.toList()..sort();
    } catch (error) {
      throw Exception('Failed to fetch categories: $error');
    }
  }

  // Add new health tip (admin function)
  Future<HealthTipModel> addHealthTip(HealthTipModel tip) async {
    try {
      final response = await _client
          .from('health_tips')
          .insert(tip.toMap())
          .select()
          .single();

      return HealthTipModel.fromMap(response);
    } catch (error) {
      throw Exception('Failed to add health tip: $error');
    }
  }

  // Update health tip (admin function)
  Future<HealthTipModel> updateHealthTip(HealthTipModel tip) async {
    try {
      final response = await _client
          .from('health_tips')
          .update(tip.toMap())
          .eq('id', tip.id)
          .select()
          .single();

      return HealthTipModel.fromMap(response);
    } catch (error) {
      throw Exception('Failed to update health tip: $error');
    }
  }

  // Delete health tip (admin function)
  Future<bool> deleteHealthTip(String tipId) async {
    try {
      await _client.from('health_tips').delete().eq('id', tipId);

      return true;
    } catch (error) {
      throw Exception('Failed to delete health tip: $error');
    }
  }

  // Refresh health tips when language changes
  Future<void> refreshHealthTipsForLanguage() async {
    // This method can be called when language changes to refresh cached data
    // The actual fetching will be done by the UI components
  }
}
