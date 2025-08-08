import 'package:supabase_flutter/supabase_flutter.dart';

import './supabase_service.dart';

class DeliveryService {
  static DeliveryService? _instance;
  static DeliveryService get instance => _instance ??= DeliveryService._();

  DeliveryService._();

  SupabaseClient get _client => SupabaseService.instance.client;

  /// Get the next scheduled delivery for the current user
  Future<Map<String, dynamic>?> getNextDelivery() async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return null;

      final response = await _client
          .from('orders')
          .select('''
            id,
            delivery_scheduled_at,
            delivery_window_start,
            delivery_window_end,
            delivery_instructions,
            is_recurring_delivery,
            recurring_frequency,
            status,
            total_amount,
            restaurant_id,
            restaurants(name, cuisine_type)
          ''')
          .eq('user_id', userId)
          .gte('delivery_scheduled_at', DateTime.now().toIso8601String())
          .order('delivery_scheduled_at', ascending: true)
          .limit(1);

      return response.isEmpty ? null : response.first;
    } catch (error) {
      throw Exception('Failed to get next delivery: $error');
    }
  }

  /// Get upcoming deliveries for the current user
  Future<List<Map<String, dynamic>>> getUpcomingDeliveries(
      {int limit = 5}) async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return [];

      final response = await _client
          .from('orders')
          .select('''
            id,
            delivery_scheduled_at,
            delivery_window_start,
            delivery_window_end,
            delivery_instructions,
            is_recurring_delivery,
            recurring_frequency,
            status,
            total_amount,
            restaurant_id,
            restaurants(name, cuisine_type)
          ''')
          .eq('user_id', userId)
          .gte('delivery_scheduled_at', DateTime.now().toIso8601String())
          .order('delivery_scheduled_at', ascending: true)
          .limit(limit);

      return List<Map<String, dynamic>>.from(response);
    } catch (error) {
      throw Exception('Failed to get upcoming deliveries: $error');
    }
  }

  /// Schedule a delivery for an order
  Future<void> scheduleDelivery({
    required String orderId,
    required DateTime scheduledAt,
    String? windowStart,
    String? windowEnd,
    String? instructions,
    bool isRecurring = false,
    String? recurringFrequency,
  }) async {
    try {
      final updateData = <String, dynamic>{
        'delivery_scheduled_at': scheduledAt.toIso8601String(),
        'delivery_instructions': instructions,
        'is_recurring_delivery': isRecurring,
        'recurring_frequency': recurringFrequency,
      };

      if (windowStart != null)
        updateData['delivery_window_start'] = windowStart;
      if (windowEnd != null) updateData['delivery_window_end'] = windowEnd;

      await _client.from('orders').update(updateData).eq('id', orderId);
    } catch (error) {
      throw Exception('Failed to schedule delivery: $error');
    }
  }

  /// Update delivery instructions
  Future<void> updateDeliveryInstructions(
      String orderId, String instructions) async {
    try {
      await _client
          .from('orders')
          .update({'delivery_instructions': instructions}).eq('id', orderId);
    } catch (error) {
      throw Exception('Failed to update delivery instructions: $error');
    }
  }

  /// Format delivery time window for display
  String formatDeliveryWindow(String? startTime, String? endTime) {
    if (startTime == null || endTime == null) return '';

    // Parse time strings (assuming HH:mm:ss format)
    try {
      final start = DateTime.parse('1970-01-01 $startTime');
      final end = DateTime.parse('1970-01-01 $endTime');

      final startFormatted =
          '${start.hour}:${start.minute.toString().padLeft(2, '0')}';
      final endFormatted =
          '${end.hour}:${end.minute.toString().padLeft(2, '0')}';

      return '$startFormatted - $endFormatted';
    } catch (e) {
      return '$startTime - $endTime';
    }
  }

  /// Calculate time until next delivery
  String getTimeUntilDelivery(String? scheduledAt) {
    if (scheduledAt == null) return '';

    try {
      final scheduled = DateTime.parse(scheduledAt);
      final now = DateTime.now();
      final difference = scheduled.difference(now);

      if (difference.isNegative) return 'Overdue';

      final days = difference.inDays;
      final hours = difference.inHours % 24;
      final minutes = difference.inMinutes % 60;

      if (days > 0) {
        return days == 1 ? '1 day' : '$days days';
      } else if (hours > 0) {
        return hours == 1 ? '1 hour' : '$hours hours';
      } else if (minutes > 0) {
        return minutes == 1 ? '1 minute' : '$minutes minutes';
      } else {
        return 'Soon';
      }
    } catch (e) {
      return '';
    }
  }
}
