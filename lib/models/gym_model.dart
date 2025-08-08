class GymModel {
  final String id;
  final String name;
  final bool active;
  final int? capacity;
  final String? gymType;
  final String? location;
  final String? imageUrl;

  GymModel({
    required this.id,
    required this.name,
    this.active = true,
    this.capacity,
    this.gymType,
    this.location,
    this.imageUrl,
  });

  factory GymModel.fromMap(Map<String, dynamic> map) {
    return GymModel(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      active: map['active'] ?? true,
      capacity: map['capacity'],
      gymType: map['gym_type'],
      location: map['location'],
      imageUrl: map['image_url'],
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'active': active,
      'capacity': capacity,
      'gym_type': gymType,
      'location': location,
      'image_url': imageUrl,
    };
  }
}
