class SubscriptionModel {
  final String id;
  final String? userId;
  final String? subscriberId;
  final String? planType;
  final num? price;
  final bool? active;
  final bool? includesGym;
  final DateTime? startDate;
  final DateTime? endDate;
  final DateTime? createdAt;

  SubscriptionModel({
    required this.id,
    this.userId,
    this.subscriberId,
    this.planType,
    this.price,
    this.active,
    this.includesGym,
    this.startDate,
    this.endDate,
    this.createdAt,
  });

  factory SubscriptionModel.fromMap(Map<String, dynamic> map) {
    return SubscriptionModel(
      id: map['id'] ?? '',
      userId: map['user_id'],
      subscriberId: map['subscriber_id'],
      planType: map['plan_type'],
      price: map['price'],
      active: map['active'],
      includesGym: map['includes_gym'],
      startDate:
          map['start_date'] != null ? DateTime.parse(map['start_date']) : null,
      endDate: map['end_date'] != null ? DateTime.parse(map['end_date']) : null,
      createdAt:
          map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'subscriber_id': subscriberId,
      'plan_type': planType,
      'price': price,
      'active': active,
      'includes_gym': includesGym,
      'start_date': startDate?.toIso8601String().split('T')[0],
      'end_date': endDate?.toIso8601String().split('T')[0],
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
