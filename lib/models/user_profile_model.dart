class UserProfileModel {
  final String id;
  final String? userId;
  final String username;
  final String? displayName;
  final String? avatarUrl;
  final String? bio;
  final String? location;
  final String? fitnessLevel;
  final List<String>? goals;
  final bool isPublic;
  final int streakDays;
  final int totalWorkouts;
  final int totalCaloriesBurned;
  final DateTime joinedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  UserProfileModel({
    required this.id,
    this.userId,
    required this.username,
    this.displayName,
    this.avatarUrl,
    this.bio,
    this.location,
    this.fitnessLevel,
    this.goals,
    this.isPublic = true,
    this.streakDays = 0,
    this.totalWorkouts = 0,
    this.totalCaloriesBurned = 0,
    required this.joinedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserProfileModel.fromMap(Map<String, dynamic> map) {
    return UserProfileModel(
      id: map['id'] ?? '',
      userId: map['user_id'],
      username: map['username'] ?? '',
      displayName: map['display_name'],
      avatarUrl: map['avatar_url'],
      bio: map['bio'],
      location: map['location'],
      fitnessLevel: map['fitness_level'],
      goals: map['goals'] != null ? List<String>.from(map['goals']) : null,
      isPublic: map['is_public'] ?? true,
      streakDays: map['streak_days'] ?? 0,
      totalWorkouts: map['total_workouts'] ?? 0,
      totalCaloriesBurned: map['total_calories_burned'] ?? 0,
      joinedAt: DateTime.parse(map['joined_at']),
      createdAt: DateTime.parse(map['created_at']),
      updatedAt: DateTime.parse(map['updated_at']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'username': username,
      'display_name': displayName,
      'avatar_url': avatarUrl,
      'bio': bio,
      'location': location,
      'fitness_level': fitnessLevel,
      'goals': goals,
      'is_public': isPublic,
      'streak_days': streakDays,
      'total_workouts': totalWorkouts,
      'total_calories_burned': totalCaloriesBurned,
      'joined_at': joinedAt.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
