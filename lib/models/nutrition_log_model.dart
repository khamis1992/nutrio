class NutritionLogModel {
  final String id;
  final String userId;
  final String? mealId;
  final DateTime date;
  final int calories;
  final int protein;
  final int carbs;
  final int fats;
  final DateTime? createdAt;

  NutritionLogModel({
    required this.id,
    required this.userId,
    this.mealId,
    required this.date,
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fats,
    this.createdAt,
  });

  factory NutritionLogModel.fromMap(Map<String, dynamic> map) {
    return NutritionLogModel(
      id: map['id'] ?? '',
      userId: map['user_id'] ?? '',
      mealId: map['meal_id'],
      date: DateTime.parse(map['date']),
      calories: map['calories'] ?? 0,
      protein: map['protein'] ?? 0,
      carbs: map['carbs'] ?? 0,
      fats: map['fats'] ?? 0,
      createdAt:
          map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'meal_id': mealId,
      'date': date.toIso8601String().split('T')[0],
      'calories': calories,
      'protein': protein,
      'carbs': carbs,
      'fats': fats,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
