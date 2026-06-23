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

export interface MealCustomizationConfig {
  largePriceAdjustment?: number | null;
  largeCaloriesIncrease?: number | null;
  largeProteinIncrease?: number | null;
  hpPriceAdjustment?: number | null;
  hpCaloriesIncrease?: number | null;
  hpProteinIncrease?: number | null;
}

const toNumber = (value: number | null | undefined) => Number(value || 0);

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
    (config: MealCustomizationConfig = {}): CustomizationSummary => {
      let priceAdj = 0;
      let calAdj = 0;
      let proteinAdj = 0;
      const carbsAdj = 0;
      const fatAdj = 0;

      if (customization.portionSize === "large") {
        priceAdj += toNumber(config.largePriceAdjustment);
        calAdj += Math.round(toNumber(config.largeCaloriesIncrease));
        proteinAdj += toNumber(config.largeProteinIncrease);
      }

      if (customization.hpVariant) {
        priceAdj += toNumber(config.hpPriceAdjustment);
        calAdj += Math.round(toNumber(config.hpCaloriesIncrease));
        proteinAdj += toNumber(config.hpProteinIncrease);
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

  const getCustomizationData = useCallback((summary?: CustomizationSummary | null) => ({
    portion_size: customization.portionSize,
    hp_variant: customization.hpVariant,
    price_adjustment: summary?.priceAdjustment || 0,
    calorie_adjustment: summary?.calorieAdjustment || 0,
    protein_adjustment: summary?.proteinAdjustment || 0,
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
