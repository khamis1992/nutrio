import { useState, useCallback } from "react";
import type { PortionSize } from "@/components/meal/PortionSelector";

export interface MealCustomization {
  removedIngredients: Map<string, string>; // id -> name
  portionSize: PortionSize;
  hpVariant: boolean;
}

export interface CustomizationSummary {
  portionSize: PortionSize;
  hpVariant: boolean;
  removedIngredientNames: string[];
  priceAdjustment: number;
  calorieAdjustment: number;
  proteinAdjustment: number;
  carbsAdjustment: number;
  fatAdjustment: number;
}

export function useMealCustomization() {
  const [customization, setCustomization] = useState<MealCustomization>({
    removedIngredients: new Map(),
    portionSize: "standard",
    hpVariant: false,
  });

  const toggleIngredient = useCallback((id: string, name: string) => {
    setCustomization((prev) => {
      const newMap = new Map(prev.removedIngredients);
      if (newMap.has(id)) {
        newMap.delete(id);
      } else {
        newMap.set(id, name);
      }
      return { ...prev, removedIngredients: newMap };
    });
  }, []);

  const setPortionSize = useCallback((size: PortionSize) => {
    setCustomization((prev) => ({ ...prev, portionSize: size }));
  }, []);

  const setHPVariant = useCallback((enabled: boolean) => {
    setCustomization((prev) => ({ ...prev, hpVariant: enabled }));
  }, []);

  const getSummary = useCallback(
    (basePrice: number | null, baseCalories: number, baseProtein: number, baseCarbs: number, baseFat: number): CustomizationSummary => {
      let priceAdj = 0;
      let calAdj = 0;
      let proteinAdj = 0;
      let carbsAdj = 0;
      let fatAdj = 0;

      // Portion size adjustment
      if (customization.portionSize === "large") {
        priceAdj += (basePrice || 0) * 0.5;
        calAdj += Math.round(baseCalories * 0.5);
        proteinAdj += Math.round(baseProtein * 0.5);
        carbsAdj += Math.round(baseCarbs * 0.5);
        fatAdj += Math.round(baseFat * 0.5);
      }

      // HP variant adjustment
      if (customization.hpVariant) {
        priceAdj += 15;
        proteinAdj += Math.round(baseProtein * 0.5);
        calAdj += Math.round(baseProtein * 0.5 * 4); // ~4 cal per gram protein
      }

      return {
        portionSize: customization.portionSize,
        hpVariant: customization.hpVariant,
        removedIngredientNames: Array.from(customization.removedIngredients.values()),
        priceAdjustment: priceAdj,
        calorieAdjustment: calAdj,
        proteinAdjustment: proteinAdj,
        carbsAdjustment: carbsAdj,
        fatAdjustment: fatAdj,
      };
    },
    [customization]
  );

  const getCustomizationData = useCallback(() => ({
    portion_size: customization.portionSize,
    hp_variant: customization.hpVariant,
    removed_ingredients: Array.from(customization.removedIngredients.entries()).map(([id, name]) => ({
      ingredient_id: id,
      ingredient_name: name,
    })),
  }), [customization]);

  const hasCustomizations = customization.portionSize === "large" ||
    customization.hpVariant ||
    customization.removedIngredients.size > 0;

  const reset = useCallback(() => {
    setCustomization({
      removedIngredients: new Map(),
      portionSize: "standard",
      hpVariant: false,
    });
  }, []);

  return {
    customization,
    toggleIngredient,
    setPortionSize,
    setHPVariant,
    getSummary,
    getCustomizationData,
    hasCustomizations,
    reset,
    removedIngredientIds: new Set(customization.removedIngredients.keys()),
  };
}
