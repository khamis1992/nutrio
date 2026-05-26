import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useMealPrefetch } from "@/hooks/useMealPrefetch";

const PREFETCH_ON_PAGES = new Set(["/meals", "/dashboard", "/"]);

export function PredictivePreloader() {
  const location = useLocation();
  const { prefetchMeal, prefetchRestaurant } = useMealPrefetch();

  useEffect(() => {
    if (!PREFETCH_ON_PAGES.has(location.pathname)) return;

    const mealsLink = document.querySelector<HTMLAnchorElement>('a[href^="/meals/"]');
    const restaurantLink = document.querySelector<HTMLAnchorElement>('a[href^="/restaurant/"]');

    if (mealsLink) {
      const mealMatch = mealsLink.href.match(/\/meals\/([^/]+)/);
      if (mealMatch) prefetchMeal(mealMatch[1]);
    }

    if (restaurantLink) {
      const restaurantMatch = restaurantLink.href.match(/\/restaurant\/([^/]+)/);
      if (restaurantMatch) prefetchRestaurant(restaurantMatch[1]);
    }
  }, [location.pathname, prefetchMeal, prefetchRestaurant]);

  return null;
}
