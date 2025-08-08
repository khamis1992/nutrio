import '../models/subscription_model.dart';
import './auth_service.dart';
import './supabase_service.dart';

class SubscriptionService {
  static SubscriptionService? _instance;
  static SubscriptionService get instance =>
      _instance ??= SubscriptionService._();

  SubscriptionService._();

  final _client = SupabaseService.instance.client;

  // Get user's current subscription
  Future<SubscriptionModel?> getCurrentSubscription() async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) return null;

      final response = await _client
          .from('subscriptions')
          .select()
          .eq('user_id', userId)
          .eq('active', true)
          .maybeSingle();

      if (response != null) {
        return SubscriptionModel.fromMap(response);
      }
      return null;
    } catch (error) {
      throw Exception('Failed to fetch subscription: $error');
    }
  }

  // Create new subscription
  Future<SubscriptionModel> createSubscription({
    required String planType,
    required num price,
    required DateTime startDate,
    required DateTime endDate,
    bool includesGym = false,
  }) async {
    try {
      final userId = AuthService.instance.currentUser?.id;
      if (userId == null) throw Exception('User not authenticated');

      final subscriptionData = {
        'user_id': userId,
        'plan_type': planType,
        'price': price,
        'start_date': startDate.toIso8601String().split('T')[0],
        'end_date': endDate.toIso8601String().split('T')[0],
        'includes_gym': includesGym,
        'active': true,
      };

      final response = await _client
          .from('subscriptions')
          .insert(subscriptionData)
          .select()
          .single();

      return SubscriptionModel.fromMap(response);
    } catch (error) {
      throw Exception('Failed to create subscription: $error');
    }
  }

  // Update subscription
  Future<SubscriptionModel> updateSubscription({
    required String subscriptionId,
    String? planType,
    num? price,
    DateTime? endDate,
    bool? includesGym,
    bool? active,
  }) async {
    try {
      final updateData = <String, dynamic>{};

      if (planType != null) updateData['plan_type'] = planType;
      if (price != null) updateData['price'] = price;
      if (endDate != null)
        updateData['end_date'] = endDate.toIso8601String().split('T')[0];
      if (includesGym != null) updateData['includes_gym'] = includesGym;
      if (active != null) updateData['active'] = active;

      final response = await _client
          .from('subscriptions')
          .update(updateData)
          .eq('id', subscriptionId)
          .select()
          .single();

      return SubscriptionModel.fromMap(response);
    } catch (error) {
      throw Exception('Failed to update subscription: $error');
    }
  }

  // Cancel subscription
  Future<void> cancelSubscription(String subscriptionId) async {
    try {
      await _client
          .from('subscriptions')
          .update({'active': false}).eq('id', subscriptionId);
    } catch (error) {
      throw Exception('Failed to cancel subscription: $error');
    }
  }

  // Check if subscription is active and includes gym
  Future<bool> hasGymAccess() async {
    try {
      final subscription = await getCurrentSubscription();
      if (subscription == null) return false;

      // Check if subscription is still valid
      final now = DateTime.now();
      final isActive = subscription.active == true &&
          subscription.endDate != null &&
          subscription.endDate!.isAfter(now);

      return isActive && (subscription.includesGym == true);
    } catch (error) {
      return false;
    }
  }
}
