import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocalizationService {
  static LocalizationService? _instance;
  static LocalizationService get instance =>
      _instance ??= LocalizationService._();
  LocalizationService._();

  static const String _languageKey = 'selected_language';
  static const String _defaultLanguage = 'en';

  // Supported locales
  static const List<Locale> supportedLocales = [
    Locale('en', 'US'), // English
    Locale('ar', 'SA'), // Arabic
  ];

  // Current locale notifier
  ValueNotifier<Locale> localeNotifier =
      ValueNotifier(const Locale('en', 'US'));

  // Initialize localization service
  Future<void> initialize() async {
    final savedLanguage = await getSavedLanguage();
    localeNotifier.value = _getLocaleFromLanguageCode(savedLanguage);
  }

  // Get saved language from preferences
  Future<String> getSavedLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(_languageKey) ?? _defaultLanguage;
    } catch (e) {
      return _defaultLanguage;
    }
  }

  // Save language to preferences
  Future<void> saveLanguage(String languageCode) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_languageKey, languageCode);
      localeNotifier.value = _getLocaleFromLanguageCode(languageCode);
    } catch (e) {
      // Handle error silently, keep current locale
    }
  }

  // Get current language code
  String get currentLanguageCode {
    return localeNotifier.value.languageCode;
  }

  // Check if current language is Arabic
  bool get isArabic {
    return currentLanguageCode == 'ar';
  }

  // Check if current language is English
  bool get isEnglish {
    return currentLanguageCode == 'en';
  }

  // Get text direction based on current language
  TextDirection get textDirection {
    return isArabic ? TextDirection.rtl : TextDirection.ltr;
  }

  // Change language
  Future<void> changeLanguage(String languageCode) async {
    if (languageCode == currentLanguageCode) return;

    await saveLanguage(languageCode);
  }

  // Get available languages
  List<Map<String, String>> get availableLanguages {
    return [
      {'code': 'en', 'name': 'English', 'nativeName': 'English'},
      {'code': 'ar', 'name': 'Arabic', 'nativeName': 'العربية'},
    ];
  }

  // Get language name
  String getLanguageName(String languageCode) {
    switch (languageCode) {
      case 'ar':
        return 'العربية';
      case 'en':
      default:
        return 'English';
    }
  }

  // Helper method to convert language code to Locale
  Locale _getLocaleFromLanguageCode(String languageCode) {
    switch (languageCode) {
      case 'ar':
        return const Locale('ar', 'SA');
      case 'en':
      default:
        return const Locale('en', 'US');
    }
  }

  // Get opposite language code (for toggling)
  String get oppositeLanguageCode {
    return isArabic ? 'en' : 'ar';
  }

  // Toggle language
  Future<void> toggleLanguage() async {
    await changeLanguage(oppositeLanguageCode);
  }
}
