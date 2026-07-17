import { readFileSync, writeFileSync } from "node:fs";

const customerReadFiles = [
  "src/components/ActiveOrderBanner.tsx",
  "src/components/dashboard/VIPExclusivesCard.tsx",
  "src/pages/Subscription.tsx",
  "src/components/LogMealModal.tsx",
  "src/pages/Schedule.tsx",
  "src/pages/RestaurantDetail.tsx",
  "src/components/meals/RecommendedForYou.tsx",
  "src/components/MealWizard.tsx",
  "src/components/OrderAgainRow.tsx",
  "src/components/meal/MealPlanGenerator.tsx",
  "src/lib/schedule-templates.ts",
  "src/components/QuickReorder.tsx",
  "src/hooks/useFeaturedRestaurants.ts",
  "src/hooks/useHealthFilteredMeals.ts",
  "src/hooks/useTopMeals.ts",
  "src/hooks/useSmartSubstitutions.ts",
  "src/hooks/useMealRecommendations.ts",
  "src/hooks/useMealPrefetch.ts",
  "src/hooks/usePopularCombos.ts",
  "src/components/progress/MealQualityScore.tsx",
  "src/lib/cache.ts",
  "src/pages/OrderHistory.tsx",
  "src/pages/OrderDetail.tsx",
  "src/lib/food-providers.ts",
  "src/lib/meal-plan-generator.ts",
  "src/pages/Dashboard.tsx",
  "src/pages/DeliveryTracking.tsx",
  "src/pages/Index.tsx",
  "src/pages/Favorites.tsx",
  "src/pages/nutrio/CoachPrograms.tsx",
  "src/pages/Meals.tsx",
  "src/pages/LiveMap.tsx",
  "src/pages/MealDetail.tsx",
  "src/services/taste-profile-calculator.ts",
  "src/services/taste-aware-menu-generator.ts",
  "src/integrations/supabase/delivery.ts",
  "src/hooks/useCoachPrograms.ts",
  "src/lib/coach-meal-schedule.ts",
  "src/hooks/useLandingStats.ts",
  "src/pages/coach/CoachClientDetail.tsx",
];

let changed = 0;
for (const file of customerReadFiles) {
  const before = readFileSync(file, "utf8");
  const after = before
    .replaceAll(
      '.from("meals")',
      '.from("public_meal_catalog" as "meals")',
    )
    .replaceAll(
      '.from("restaurants")',
      '.from("public_restaurant_catalog" as "restaurants")',
    )
    .replaceAll(
      ".from('meals')",
      ".from('public_meal_catalog' as 'meals')",
    )
    .replaceAll(
      ".from('restaurants')",
      ".from('public_restaurant_catalog' as 'restaurants')",
    );

  if (after !== before) {
    writeFileSync(file, after, "utf8");
    changed += 1;
    console.log(file);
  }
}

console.log(`Migrated ${changed} customer catalog readers.`);
