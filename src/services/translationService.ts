// Translation Service for Nutrio Fuel
// Handles meal translations, language detection, and fallback logic

import { supabase } from "@/integrations/supabase/client";

export type LanguageCode = "en" | "ar";

export interface MealTranslation {
  id: string;
  mealId: string;
  languageCode: LanguageCode;
  name: string;
  description: string | null;
  isAutoTranslated: boolean;
  reviewStatus: "pending" | "approved" | "rejected" | "needs_review" | "none";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranslatedMeal {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  prepTimeMinutes: number | null;
  isAvailable: boolean;
  rating: number;
  orderCount: number;
  isTranslated: boolean;
  isAutoTranslated: boolean;
  reviewStatus: string;
}

/**
 * Get user's preferred language from profile
 */
export async function getUserLanguage(): Promise<LanguageCode> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return "en";
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("user_id", user.id)
    .single();
  
  return (profile?.preferred_language as LanguageCode) || "en";
}

/**
 * Set user's preferred language
 */
export async function setUserLanguage(language: LanguageCode): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_language: language })
    .eq("user_id", user.id);
  
  if (error) {
    console.error("Failed to set user language:", error);
    return false;
  }
  
  return true;
}

/**
 * Get translated meal content
 * Falls back to primary language if translation not available
 */
export async function getMealTranslation(
  mealId: string,
  languageCode: LanguageCode = "en"
): Promise<TranslatedMeal | null> {
  try {
    // Use the database function for efficient lookup
    const { data, error } = await supabase
      .rpc("get_meal_with_translation", {
        p_meal_id: mealId,
        p_language_code: languageCode,
      });
    
    if (error) {
      console.error("Error fetching meal translation:", error);
      return null;
    }
    
    if (!data || data.length === 0) return null;
    
    const meal = data[0];
    
    return {
      id: meal.id,
      restaurantId: meal.restaurant_id,
      name: meal.name,
      description: meal.description,
      imageUrl: meal.image_url,
      price: meal.price,
      calories: meal.calories,
      proteinG: meal.protein_g,
      carbsG: meal.carbs_g,
      fatG: meal.fat_g,
      fiberG: meal.fiber_g,
      prepTimeMinutes: meal.prep_time_minutes,
      isAvailable: meal.is_available,
      rating: meal.rating,
      orderCount: meal.order_count,
      isTranslated: meal.is_translated,
      isAutoTranslated: meal.is_auto_translated,
      reviewStatus: meal.review_status,
    };
  } catch (error) {
    console.error("Error in getMealTranslation:", error);
    return null;
  }
}

/**
 * Get multiple meal translations in batch
 */
export async function getMealsTranslations(
  mealIds: string[],
  languageCode: LanguageCode = "en"
): Promise<Map<string, TranslatedMeal>> {
  const translations = new Map<string, TranslatedMeal>();
  
  // Fetch all translations in parallel
  const promises = mealIds.map(async (mealId) => {
    const translation = await getMealTranslation(mealId, languageCode);
    if (translation) {
      translations.set(mealId, translation);
    }
  });
  
  await Promise.all(promises);
  
  return translations;
}

/**
 * Trigger auto-translation for a meal
 * Called when meal is created or updated
 */
export async function triggerMealTranslation(
  mealId: string,
  name: string,
  description: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("translate-meal", {
      body: {
        mealId,
        text: [name, description || ""],
        from: "en",
        to: "ar",
      },
    });
    
    if (error) {
      console.error("Translation function error:", error);
      return { success: false, error: error.message };
    }
    
    if (!data?.success) {
      return { success: false, error: data?.error || "Translation failed" };
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error triggering translation:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Update a translation (for partners to edit)
 */
export async function updateTranslation(
  mealId: string,
  languageCode: LanguageCode,
  updates: {
    name?: string;
    description?: string | null;
    reviewStatus?: "pending" | "approved" | "rejected" | "needs_review";
  }
): Promise<boolean> {
  const { error } = await supabase
    .from("meal_translations")
    .update({
      ...updates,
      is_auto_translated: false, // Mark as manually edited
      updated_at: new Date().toISOString(),
    })
    .eq("meal_id", mealId)
    .eq("language_code", languageCode);
  
  if (error) {
    console.error("Failed to update translation:", error);
    return false;
  }
  
  return true;
}

/**
 * Get translation status for a meal
 */
export async function getTranslationStatus(
  mealId: string
): Promise<{
  hasTranslation: boolean;
  isAutoTranslated: boolean;
  reviewStatus: string;
  lastUpdated: string | null;
}> {
  const { data, error } = await supabase
    .from("meal_translations")
    .select("is_auto_translated, review_status, updated_at")
    .eq("meal_id", mealId)
    .eq("language_code", "ar")
    .single();
  
  if (error || !data) {
    return {
      hasTranslation: false,
      isAutoTranslated: false,
      reviewStatus: "none",
      lastUpdated: null,
    };
  }
  
  return {
    hasTranslation: true,
    isAutoTranslated: data.is_auto_translated,
    reviewStatus: data.review_status,
    lastUpdated: data.updated_at,
  };
}

/**
 * Get all translations needing review (for partner dashboard)
 */
export async function getPendingTranslations(
  restaurantId: string
): Promise<MealTranslation[]> {
  const { data, error } = await supabase
    .from("meal_translations")
    .select(`
      id,
      meal_id,
      language_code,
      name,
      description,
      is_auto_translated,
      review_status,
      reviewed_by,
      reviewed_at,
      created_at,
      updated_at
    `)
    .eq("language_code", "ar")
    .in("review_status", ["pending", "needs_review"])
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching pending translations:", error);
    return [];
  }
  
  return (data || []).map((t) => ({
    id: t.id,
    mealId: t.meal_id,
    languageCode: t.language_code as LanguageCode,
    name: t.name,
    description: t.description,
    isAutoTranslated: t.is_auto_translated,
    reviewStatus: t.review_status,
    reviewedBy: t.reviewed_by,
    reviewedAt: t.reviewed_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

/**
 * Detect if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
}

/**
 * Detect language of text
 */
export function detectLanguage(text: string): LanguageCode {
  return containsArabic(text) ? "ar" : "en";
}

/**
 * Format meal name with translation indicator
 */
export function formatMealName(
  name: string,
  isTranslated: boolean,
  isAutoTranslated: boolean,
  showIndicator: boolean = false
): string {
  if (!showIndicator) return name;
  
  if (!isTranslated) {
    return `${name} (English only)`;
  }
  
  if (isAutoTranslated) {
    return `${name} ⚙️`; // Auto-translated indicator
  }
  
  return `${name} ✓`; // Approved translation
}

// Export default service object
export const translationService = {
  getUserLanguage,
  setUserLanguage,
  getMealTranslation,
  getMealsTranslations,
  triggerMealTranslation,
  updateTranslation,
  getTranslationStatus,
  getPendingTranslations,
  containsArabic,
  detectLanguage,
  formatMealName,
};

export default translationService;
