/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { City } from "@/fleet/types";
import type { Zone } from "@/fleet/types/fleet";
import { useFleetAuth } from "@/fleet/hooks/useFleetAuth";
import { supabase } from "@/integrations/supabase/client";

interface CityContextType {
  selectedCities: City[];
  setSelectedCities: (cities: City[]) => void;
  availableCities: City[];
  selectedCity: City | null;
  zones: Zone[];
  toggleCity: (cityId: string) => void;
  isMultiSelect: boolean;
  isLoading: boolean;
}

const CityContext = createContext<CityContextType | null>(null);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFleetAuth();
  const [selectedCities, setSelectedCities] = useState<City[]>([]);
  const [availableCities, setAvailableCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectedCity = selectedCities[0] ?? null;
  const isMultiSelect = user?.role === "super_admin";

  useEffect(() => {
    let cancelled = false;

    async function loadCities() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, name_ar, country, latitude, longitude, timezone, is_active")
        .eq("is_active", true)
        .order("name");

      if (cancelled) return;
      if (error) {
        console.error("Failed to load fleet cities:", error);
        setAvailableCities([]);
        setIsLoading(false);
        return;
      }

      const assignedCityIds = new Set(user?.assignedCities ?? []);
      const canSeeAllCities = user?.role === "super_admin" || assignedCityIds.size === 0;
      const cities = (data ?? [])
        .filter((city) => canSeeAllCities || assignedCityIds.has(city.id))
        .map((city): City => ({
          id: city.id,
          name: city.name,
          nameAr: city.name_ar ?? undefined,
          country: city.country,
          latitude: city.latitude ?? 0,
          longitude: city.longitude ?? 0,
          timezone: city.timezone ?? "Asia/Qatar",
          isActive: city.is_active ?? false,
        }));

      setAvailableCities(cities);
      setSelectedCities((current) => current.filter((selected) =>
        cities.some((city) => city.id === selected.id)
      ));
      setIsLoading(false);
    }

    void loadCities();
    return () => { cancelled = true; };
  }, [user?.assignedCities, user?.role]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCity) {
      setZones([]);
      return;
    }

    async function loadZones() {
      const { data, error } = await supabase
        .from("zones")
        .select("id, city_id, name, name_ar, is_active, created_at, updated_at")
        .eq("city_id", selectedCity.id)
        .eq("is_active", true)
        .order("name");

      if (cancelled) return;
      if (error) {
        console.error("Failed to load fleet zones:", error);
        setZones([]);
        return;
      }

      setZones((data ?? []).map((zone): Zone => ({
        id: zone.id,
        cityId: zone.city_id ?? selectedCity.id,
        name: zone.name,
        nameAr: zone.name_ar ?? undefined,
        isActive: zone.is_active ?? false,
        createdAt: zone.created_at ?? "",
        updatedAt: zone.updated_at ?? "",
      })));
    }

    void loadZones();
    return () => { cancelled = true; };
  }, [selectedCity]);

  const handleSetSelectedCities = useCallback((cities: City[]) => {
    setSelectedCities(isMultiSelect ? cities : cities.slice(-1));
  }, [isMultiSelect]);

  const toggleCity = useCallback((cityId: string) => {
    const city = availableCities.find((candidate) => candidate.id === cityId);
    if (!city) return;
    setSelectedCities((current) => {
      const selected = current.some((candidate) => candidate.id === cityId);
      if (selected) return current.filter((candidate) => candidate.id !== cityId);
      return isMultiSelect ? [...current, city] : [city];
    });
  }, [availableCities, isMultiSelect]);

  const value = useMemo<CityContextType>(() => ({
    selectedCities,
    setSelectedCities: handleSetSelectedCities,
    availableCities,
    selectedCity,
    zones,
    toggleCity,
    isMultiSelect,
    isLoading,
  }), [availableCities, handleSetSelectedCities, isLoading, isMultiSelect, selectedCities, selectedCity, toggleCity, zones]);

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const context = useContext(CityContext);
  if (!context) throw new Error("useCity must be used within a CityProvider");
  return context;
}
