export type MenuPeriod = "breakfast" | "lunch" | "dinner" | "snack";

export type MenuOffering = {
  meal_type: MenuPeriod;
  price: number;
  is_available: boolean;
};

export const ALL_MENU_PERIODS: MenuPeriod[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

export function getAvailableMenuPeriods(offerings: MenuOffering[]) {
  if (offerings.length === 0) return [...ALL_MENU_PERIODS];
  return offerings
    .filter((offering) => offering.is_available)
    .map((offering) => offering.meal_type);
}

export function getMenuPrice(
  basePrice: number,
  offerings: MenuOffering[],
  period?: string,
) {
  if (offerings.length === 0) return basePrice;
  const selected = offerings.find(
    (offering) => offering.meal_type === period && offering.is_available,
  );
  const availablePrices = offerings
    .filter((offering) => offering.is_available)
    .map((offering) => offering.price);
  return selected?.price ?? Math.min(...availablePrices);
}
