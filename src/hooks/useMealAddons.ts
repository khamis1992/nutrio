import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MealAddon {
  id: string;
  meal_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
}

export function useMealAddons(mealId: string | undefined) {
  const [addons, setAddons] = useState<MealAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!mealId) {
      setLoading(false);
      return;
    }

    const fetchAddons = async () => {
      try {
        const { data, error } = await supabase
          .from("meal_addons")
          .select("*")
          .eq("meal_id", mealId)
          .eq("is_available", true)
          .order("category")
          .order("name");

        if (error) throw error;
        setAddons(data || []);
      } catch (err) {
        console.error("Error fetching addons:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAddons();
  }, [mealId]);

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(addonId)) {
        newMap.delete(addonId);
      } else {
        newMap.set(addonId, 1);
      }
      return newMap;
    });
  };

  const updateQuantity = (addonId: string, quantity: number) => {
    setSelectedAddons((prev) => {
      const newMap = new Map(prev);
      if (quantity <= 0) {
        newMap.delete(addonId);
      } else {
        newMap.set(addonId, quantity);
      }
      return newMap;
    });
  };

  const getSelectedAddonsTotal = () => {
    let total = 0;
    selectedAddons.forEach((quantity, addonId) => {
      const addon = addons.find((a) => a.id === addonId);
      if (addon) {
        total += addon.price * quantity;
      }
    });
    return total;
  };

  const getSelectedAddonsList = () => {
    const list: { addon: MealAddon; quantity: number }[] = [];
    selectedAddons.forEach((quantity, addonId) => {
      const addon = addons.find((a) => a.id === addonId);
      if (addon) {
        list.push({ addon, quantity });
      }
    });
    return list;
  };

  const clearSelectedAddons = () => {
    setSelectedAddons(new Map());
  };

  const groupedAddons = addons.reduce((acc, addon) => {
    if (!acc[addon.category]) {
      acc[addon.category] = [];
    }
    acc[addon.category].push(addon);
    return acc;
  }, {} as Record<string, MealAddon[]>);

  return {
    addons,
    loading,
    selectedAddons,
    toggleAddon,
    updateQuantity,
    getSelectedAddonsTotal,
    getSelectedAddonsList,
    clearSelectedAddons,
    groupedAddons,
    hasAddons: addons.length > 0,
  };
}
