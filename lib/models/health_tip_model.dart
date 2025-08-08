class HealthTipModel {
  final String id;
  final String title;
  final String content;
  final String? titleAr;
  final String? contentAr;
  final String category;
  final String language;
  final bool isActive;
  final int displayOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  HealthTipModel({
    required this.id,
    required this.title,
    required this.content,
    this.titleAr,
    this.contentAr,
    this.category = 'general',
    this.language = 'en',
    this.isActive = true,
    this.displayOrder = 0,
    this.createdAt,
    this.updatedAt,
  });

  factory HealthTipModel.fromMap(Map<String, dynamic> map,
      {String? preferredLanguage}) {
    final isArabicPreferred = preferredLanguage == 'ar';

    // Use localized content if available and preferred language is Arabic
    final localizedTitle = isArabicPreferred &&
            map['title_ar'] != null &&
            map['title_ar'].toString().isNotEmpty
        ? map['title_ar']
        : map['title'] ?? '';

    final localizedContent = isArabicPreferred &&
            map['content_ar'] != null &&
            map['content_ar'].toString().isNotEmpty
        ? map['content_ar']
        : map['content'] ?? '';

    return HealthTipModel(
      id: map['id'] ?? '',
      title: localizedTitle,
      content: localizedContent,
      titleAr: map['title_ar'],
      contentAr: map['content_ar'],
      category: map['category'] ?? 'general',
      language: map['language'] ?? 'en',
      isActive: map['is_active'] ?? true,
      displayOrder: map['display_order'] ?? 0,
      createdAt:
          map['created_at'] != null ? DateTime.parse(map['created_at']) : null,
      updatedAt:
          map['updated_at'] != null ? DateTime.parse(map['updated_at']) : null,
    );
  }

  // Get title based on specified language
  String getTitle(String languageCode) {
    if (languageCode == 'ar' && titleAr != null && titleAr!.isNotEmpty) {
      return titleAr!;
    }
    return title;
  }

  // Get content based on specified language
  String getContent(String languageCode) {
    if (languageCode == 'ar' && contentAr != null && contentAr!.isNotEmpty) {
      return contentAr!;
    }
    return content;
  }

  // Get localized title based on current language
  String get localizedTitle {
    return getTitle(language);
  }

  // Get localized content based on current language
  String get localizedContent {
    return getContent(language);
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'content': content,
      'title_ar': titleAr,
      'content_ar': contentAr,
      'category': category,
      'language': language,
      'is_active': isActive,
      'display_order': displayOrder,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  // Create a copy with updated language-specific content
  HealthTipModel copyWithLanguage(String newLanguage) {
    return HealthTipModel(
      id: id,
      title: getTitle(newLanguage),
      content: getContent(newLanguage),
      titleAr: titleAr,
      contentAr: contentAr,
      category: category,
      language: newLanguage,
      isActive: isActive,
      displayOrder: displayOrder,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }

  @override
  String toString() {
    return 'HealthTipModel(id: $id, title: $title, content: $content, category: $category, language: $language)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is HealthTipModel &&
        other.id == id &&
        other.title == title &&
        other.content == content &&
        other.category == category &&
        other.language == language &&
        other.isActive == isActive &&
        other.displayOrder == displayOrder;
  }

  @override
  int get hashCode {
    return id.hashCode ^
        title.hashCode ^
        content.hashCode ^
        category.hashCode ^
        language.hashCode ^
        isActive.hashCode ^
        displayOrder.hashCode;
  }
}
