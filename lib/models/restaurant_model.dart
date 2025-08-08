class RestaurantModel {
  final String id;
  final String name;
  final bool active;
  final num? rating;
  final String? location;
  final String? imageUrl;
  final String? description;
  final String? cuisineType;
  final List<String>? dietaryTags;
  final DateTime? createdAt;

  RestaurantModel({
    required this.id,
    required this.name,
    this.active = true,
    this.rating,
    this.location,
    this.imageUrl,
    this.description,
    this.cuisineType,
    this.dietaryTags,
    this.createdAt,
  });

  factory RestaurantModel.fromMap(Map<String, dynamic> map) {
    return RestaurantModel(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      active: map['active'] ?? true,
      rating: map['rating'],
      location: map['location'],
      imageUrl: map['image_url'],
      description: map['description'],
      cuisineType: map['cuisine_type'],
      dietaryTags: map['dietary_tags'] != null
          ? List<String>.from(map['dietary_tags'])
          : null,
      createdAt:
          map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'active': active,
      'rating': rating,
      'location': location,
      'image_url': imageUrl,
      'description': description,
      'cuisine_type': cuisineType,
      'dietary_tags': dietaryTags,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
