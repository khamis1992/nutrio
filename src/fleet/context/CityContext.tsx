/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from "react";
import type { City } from "@/fleet/types";

interface CityContextType {
  selectedCities: City[];
  setSelectedCities: (cities: City[]) => void;
  availableCities: City[];
  isLoading: boolean;
}

const CityContext = createContext<CityContextType | null>(null);

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [selectedCities, setSelectedCities] = useState<City[]>([]);
  const [availableCities] = useState<City[]>([
    { id: "doha", name: "Doha", nameAr: "الدوحة", country: "Qatar", latitude: 25.2854, longitude: 51.5074, timezone: "Asia/Qatar", isActive: true },
    { id: "rayyan", name: "Al Rayyan", nameAr: "الريان", country: "Qatar", latitude: 25.2915, longitude: 51.4244, timezone: "Asia/Qatar", isActive: true },
    { id: "wakra", name: "Al Wakra", nameAr: "الوكرة", country: "Qatar", latitude: 25.1657, longitude: 51.5976, timezone: "Asia/Qatar", isActive: true },
    { id: "khor", name: "Al Khor", nameAr: "الخور", country: "Qatar", latitude: 25.6839, longitude: 51.5058, timezone: "Asia/Qatar", isActive: true },
  ]);
  const [isLoading] = useState(false);

  const handleSetSelectedCities = useCallback((cities: City[]) => {
    setSelectedCities(cities);
  }, []);

  return (
    <CityContext.Provider 
      value={{ 
        selectedCities, 
        setSelectedCities: handleSetSelectedCities, 
        availableCities,
        isLoading 
      }}
    >
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error("useCity must be used within a CityProvider");
  }
  return context;
}
