class HealthGoalModel {
  final String id;
  final String userId;
  final String goal;
  final double? currentWeight;
  final int? height;
  final String? gender;
  final int? age;
  final double? targetWeight;
  final String? activityLevel;
  final DateTime createdAt;
  final DateTime updatedAt;

  HealthGoalModel({
    required this.id,
    required this.userId,
    required this.goal,
    this.currentWeight,
    this.height,
    this.gender,
    this.age,
    this.targetWeight,
    this.activityLevel,
    required this.createdAt,
    required this.updatedAt,
  });

  factory HealthGoalModel.fromJson(Map<String, dynamic> json) {
    return HealthGoalModel(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      goal: json['goal'] as String,
      currentWeight: json['current_weight']?.toDouble(),
      height: json['height']?.toInt(),
      gender: json['gender'] as String?,
      age: json['age']?.toInt(),
      targetWeight: json['target_weight']?.toDouble(),
      activityLevel: json['activity_level'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'goal': goal,
      'current_weight': currentWeight,
      'height': height,
      'gender': gender,
      'age': age,
      'target_weight': targetWeight,
      'activity_level': activityLevel,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  HealthGoalModel copyWith({
    String? id,
    String? userId,
    String? goal,
    double? currentWeight,
    int? height,
    String? gender,
    int? age,
    double? targetWeight,
    String? activityLevel,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return HealthGoalModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      goal: goal ?? this.goal,
      currentWeight: currentWeight ?? this.currentWeight,
      height: height ?? this.height,
      gender: gender ?? this.gender,
      age: age ?? this.age,
      targetWeight: targetWeight ?? this.targetWeight,
      activityLevel: activityLevel ?? this.activityLevel,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  // Get localized goal name
  String getLocalizedGoalName(String languageCode) {
    switch (goal) {
      case 'weight_loss':
        return languageCode == 'ar' ? 'خسارة الوزن' : 'Weight Loss';
      case 'maintain_weight':
        return languageCode == 'ar' ? 'المحافظة على الوزن' : 'Maintain Weight';
      case 'build_muscle':
        return languageCode == 'ar' ? 'بناء العضلات' : 'Build Muscle';
      case 'medical_diet':
        return languageCode == 'ar' ? 'دايت طبي' : 'Medical Diet';
      default:
        return goal;
    }
  }

  // Get localized gender name
  String? getLocalizedGenderName(String languageCode) {
    if (gender == null) return null;

    switch (gender) {
      case 'male':
        return languageCode == 'ar' ? 'ذكر' : 'Male';
      case 'female':
        return languageCode == 'ar' ? 'أنثى' : 'Female';
      case 'prefer_not_to_say':
        return languageCode == 'ar' ? 'أفضل عدم الإجابة' : 'Prefer not to say';
      default:
        return gender;
    }
  }

  // Calculate BMI if weight and height are available
  double? get bmi {
    if (currentWeight == null || height == null || height! <= 0) return null;

    final heightInMeters = height! / 100.0;
    return currentWeight! / (heightInMeters * heightInMeters);
  }

  // Get BMI category
  String? getBMICategory(String languageCode) {
    final bmiValue = bmi;
    if (bmiValue == null) return null;

    if (bmiValue < 18.5) {
      return languageCode == 'ar' ? 'نقص في الوزن' : 'Underweight';
    } else if (bmiValue < 25.0) {
      return languageCode == 'ar' ? 'وزن طبيعي' : 'Normal weight';
    } else if (bmiValue < 30.0) {
      return languageCode == 'ar' ? 'زيادة في الوزن' : 'Overweight';
    } else {
      return languageCode == 'ar' ? 'سمنة' : 'Obese';
    }
  }
}
