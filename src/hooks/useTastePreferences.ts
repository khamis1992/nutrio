import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTasteProfile, calculateTasteProfile, TasteProfile } from "@/services/taste-profile-calculator";

const DEFAULT_PROFILE: TasteProfile = {
  favoriteCuisines: [],
  favoriteRestaurants: [],
  avoidedMeals: [],
  preferredMealTypes: {},
  proteinPreference: "medium",
  spiceLevel: "medium",
  allergyAvoidances: [],
  portionPreference: "standard",
  orderFrequency: { weekday: "unknown", weekend: "unknown" },
  topIngredients: [],
  avoidedIngredients: [],
  discoveryScore: 0,
  totalOrders: 0,
  lastCalculated: "",
};

export function useTastePreferences() {
  const [profile, setProfile] = useState<TasteProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const { user } = useAuth();
  const userId = user?.id;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const p = await getTasteProfile(userId);
      setProfile(p);
    } catch (err) {
      console.error("Failed to load taste profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const recalculate = useCallback(async () => {
    if (!userId) return;
    try {
      setRecalculating(true);
      const p = await calculateTasteProfile(userId);
      setProfile(p);
      return p;
    } catch (err) {
      console.error("Failed to recalculate taste profile:", err);
    } finally {
      setRecalculating(false);
    }
  }, [userId]);

  // Track implicit signal: a meal was ordered
  const trackOrder = useCallback(async (mealId: string, restaurantId?: string) => {
    // Recalculate profile after order - debounced by caller
    await recalculate();
  }, [recalculate]);

  // Track implicit signal: a meal was viewed but not ordered
  const trackSkip = useCallback((mealId: string) => {
    setProfile(prev => ({
      ...prev,
      avoidedMeals: [...new Set([...prev.avoidedMeals, mealId])].slice(-50),
    }));
  }, []);

  // Track explicit preference: user marked an allergy
  const trackAllergy = useCallback((ingredient: string) => {
    setProfile(prev => ({
      ...prev,
      allergyAvoidances: [...new Set([...prev.allergyAvoidances, ingredient.toLowerCase()])],
    }));
  }, []);

  // Track explicit preference: spice level
  const setSpiceLevel = useCallback((level: string) => {
    setProfile(prev => ({ ...prev, spiceLevel: level }));
  }, []);

  // Track explicit preference: portion size
  const setPortionPreference = useCallback((size: string) => {
    setProfile(prev => ({ ...prev, portionPreference: size }));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    loading,
    recalculating,
    recalculate,
    trackOrder,
    trackSkip,
    trackAllergy,
    setSpiceLevel,
    setPortionPreference,
  };
}
