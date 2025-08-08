import '../models/gym_model.dart';
import './auth_service.dart';
import './supabase_service.dart';

class GymService {
  static GymService? _instance;
  static GymService get instance => _instance ??= GymService._();

  GymService._();

  final _client = SupabaseService.instance.client;

  // Get all active gyms
  Future<List<GymModel>> getAllGyms() async {
    try {
      final response = await _client
          .from('gyms')
          .select()
          .eq('active', true)
          .order('name', ascending: true);

      return (response as List).map((gym) => GymModel.fromMap(gym)).toList();
    } catch (error) {
      throw Exception('Failed to fetch gyms: $error');
    }
  }

  // Get user's gym access
  Future<List<Map<String, dynamic>>> getUserGymAccess() async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final response = await _client.from('gym_access').select('''
            *,
            gyms (
              id,
              name,
              location,
              image_url
            )
          ''').eq('user_id', userId).order('from_date', ascending: false);

      return (response as List).cast<Map<String, dynamic>>();
    } catch (error) {
      throw Exception('Failed to fetch gym access: $error');
    }
  }

  // Grant gym access to user
  Future<Map<String, dynamic>> grantGymAccess({
    required String gymId,
    required DateTime fromDate,
    required DateTime toDate,
  }) async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final accessData = {
        'user_id': userId,
        'gym_id': gymId,
        'from_date': fromDate.toIso8601String().split('T')[0],
        'to_date': toDate.toIso8601String().split('T')[0],
      };

      final response =
          await _client.from('gym_access').insert(accessData).select('''
            *,
            gyms (
              id,
              name,
              location,
              image_url
            )
          ''').single();

      return response;
    } catch (error) {
      throw Exception('Failed to grant gym access: $error');
    }
  }

  // Check if user has active gym access
  Future<bool> hasActiveGymAccess() async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) return false;

      final today = DateTime.now().toIso8601String().split('T')[0];

      final response = await _client
          .from('gym_access')
          .select('id')
          .eq('user_id', userId)
          .lte('from_date', today)
          .gte('to_date', today)
          .limit(1);

      return (response as List).isNotEmpty;
    } catch (error) {
      return false;
    }
  }

  // Get user's current active gym access
  Future<Map<String, dynamic>?> getCurrentGymAccess() async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) return null;

      final today = DateTime.now().toIso8601String().split('T')[0];

      final response = await _client
          .from('gym_access')
          .select('''
            *,
            gyms (
              id,
              name,
              location,
              image_url,
              gym_type
            )
          ''')
          .eq('user_id', userId)
          .lte('from_date', today)
          .gte('to_date', today)
          .maybeSingle();

      return response;
    } catch (error) {
      throw Exception('Failed to fetch current gym access: $error');
    }
  }
}
