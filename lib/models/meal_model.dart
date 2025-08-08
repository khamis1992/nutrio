class MealModel {
  final String id;
  final String name;
  final String? description;
  final String? imageUrl;
  final String? vendor;
  final num? price;
  final int? calories;
  final int? protein;
  final int? carbs;
  final int? fats;
  final String? ingredients;
  final String? mealType;
  final bool available;
  final String? categoryId;
  final String? restaurantId;
  final DateTime? createdAt;

  MealModel({
    required this.id,
    required this.name,
    this.description,
    this.imageUrl,
    this.vendor,
    this.price,
    this.calories,
    this.protein,
    this.carbs,
    this.fats,
    this.ingredients,
    this.mealType,
    this.available = true,
    this.categoryId,
    this.restaurantId,
    this.createdAt,
  });

  factory MealModel.fromMap(Map<String, dynamic> map) {
    return MealModel(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      description: map['description'],
      imageUrl: map['image_url'],
      vendor: map['vendor'],
      price: map['price'],
      calories: map['calories'],
      protein: map['protein'],
      carbs: map['carbs'],
      fats: map['fats'],
      ingredients: map['ingredients'],
      mealType: map['meal_type'],
      available: map['available'] ?? true,
      categoryId: map['category_id'],
      restaurantId: map['restaurant_id'],
      createdAt:
          map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'image_url': imageUrl,
      'vendor': vendor,
      'price': price,
      'calories': calories,
      'protein': protein,
      'carbs': carbs,
      'fats': fats,
      'ingredients': ingredients,
      'meal_type': mealType,
      'available': available,
      'category_id': categoryId,
      'restaurant_id': restaurantId,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
