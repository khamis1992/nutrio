// Example: How to update Meals.tsx to use translations
// This shows the changes needed in existing components

/*
================================================================================
FILE: src/pages/Meals.tsx - MODIFICATIONS NEEDED
================================================================================

1. IMPORT THE TRANSLATION HOOK:
--------------------------------
Add this import at the top:

import { useUserLanguage, useMealTranslation } from "@/hooks/useMealTranslation";
import { useTranslatedMeal } from "@/components/TranslatedMealDisplay";


2. UPDATE THE MEAL CARD COMPONENT:
----------------------------------
In the MealCard component, replace direct meal.name/meal.description usage:

// OLD CODE:
<h3 className="font-semibold truncate">{meal.name}</h3>
{meal.description && (
  <p className="text-[hsl(150,10%,45%)] text-sm mt-1 line-clamp-2">
    {meal.description}
  </p>
)}

// NEW CODE - Option A: Using the hook
const translatedMeal = useTranslatedMeal(meal);

<h3 className="font-semibold truncate">{translatedMeal?.displayName || meal.name}</h3>
{(translatedMeal?.displayDescription || meal.description) && (
  <p className="text-[hsl(150,10%,45%)] text-sm mt-1 line-clamp-2">
    {translatedMeal?.displayDescription || meal.description}
  </p>
)}

// NEW CODE - Option B: Using the component
import { TranslatedMealName, TranslatedMealDescription } from "@/components/TranslatedMealDisplay";

<TranslatedMealName
  mealId={meal.id}
  defaultName={meal.name}
  className="font-semibold truncate"
/>
<TranslatedMealDescription
  mealId={meal.id}
  defaultDescription={meal.description}
  className="text-[hsl(150,10%,45%)] text-sm mt-1 line-clamp-2"
  maxLength={100}
/>


3. UPDATE MEAL GRID:
--------------------
For the meal grid/list, fetch translations in batch:

// Add this hook in the Meals component
const { data: userLanguage } = useUserLanguage();

// When fetching meals, also fetch translations
const mealIds = meals.map(m => m.id);
const { data: translations } = useMealsTranslations(mealIds, userLanguage || 'en');

// Then when rendering, look up translation
const getMealDisplayName = (meal: MealResult) => {
  const translation = translations?.get(meal.id);
  return translation?.name || meal.name;
};


4. ADD LANGUAGE SWITCHER (OPTIONAL):
------------------------------------
Add a language toggle in the header or settings:

import { useSetUserLanguage } from "@/hooks/useMealTranslation";

const LanguageSwitcher = () => {
  const { data: userLanguage } = useUserLanguage();
  const setLanguage = useSetUserLanguage();

  return (
    <button
      onClick={() => setLanguage.mutate(userLanguage === 'ar' ? 'en' : 'ar')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted"
    >
      {userLanguage === 'ar' ? 'English' : 'العربية'}
    </button>
  );
};


================================================================================
FILE: src/pages/MealDetail.tsx - MODIFICATIONS NEEDED
================================================================================

1. IMPORT TRANSLATION HOOK:
--------------------------
Add import:
import { useLocalizedMeal } from "@/hooks/useMealTranslation";


2. UPDATE MEAL DETAIL DISPLAY:
-------------------------------
In the component where meal is displayed:

// OLD:
const { meal, isLoading } = useMealDetails(mealId);

// NEW:
const { meal, isLoading } = useMealDetails(mealId);
const { data: translatedMeal, isLoading: isTranslationLoading } = useLocalizedMeal(mealId);

// Use translated values
const displayName = translatedMeal?.name || meal?.name;
const displayDescription = translatedMeal?.description || meal?.description;

// Show loading state
if (isLoading || isTranslationLoading) {
  return <MealDetailSkeleton />;
}

// In JSX:
<h1 className="text-2xl font-bold mb-2">{displayName}</h1>
{displayDescription && (
  <p className="text-muted-foreground">{displayDescription}</p>
)}


================================================================================
FILE: src/pages/Schedule.tsx - MODIFICATIONS NEEDED
================================================================================

1. UPDATE SCHEDULED MEAL DISPLAY:
---------------------------------
For scheduled meals showing meal names:

// OLD:
<span className="font-medium">{schedule.meal.name}</span>

// NEW:
import { TranslatedMealName } from "@/components/TranslatedMealDisplay";

<TranslatedMealName
  mealId={schedule.meal.id}
  defaultName={schedule.meal.name}
  className="font-medium"
/>


================================================================================
FILE: src/pages/Favorites.tsx - MODIFICATIONS NEEDED
================================================================================

1. UPDATE FAVORITE MEALS LIST:
-----------------------------

// OLD:
<span className="font-medium">{meal.name}</span>

// NEW:
import { TranslatedMealName } from "@/components/TranslatedMealDisplay";

<TranslatedMealName
  mealId={meal.id}
  defaultName={meal.name}
  className="font-medium"
/>


================================================================================
FILE: src/components/MealWizard.tsx - MODIFICATIONS NEEDED
================================================================================

1. UPDATE MEAL SELECTION DISPLAY:
--------------------------------
For the meal selection wizard:

// OLD:
<p className="font-medium text-sm truncate">{meal.name}</p>

// NEW:
import { TranslatedMealName } from "@/components/TranslatedMealDisplay";

<TranslatedMealName
  mealId={meal.id}
  defaultName={meal.name}
  className="font-medium text-sm truncate"
/>


================================================================================
FILE: src/pages/recommendations/SmartMealRecommendations.tsx
================================================================================

1. UPDATE RECOMMENDATION CARDS:
------------------------------

// OLD:
<h4 className="font-semibold truncate">{meal.name}</h4>
<p className="text-sm text-muted-foreground line-clamp-2">{meal.description}</p>

// NEW:
import { TranslatedMealName, TranslatedMealDescription } from "@/components/TranslatedMealDisplay";

<TranslatedMealName
  mealId={meal.id}
  defaultName={meal.name}
  className="font-semibold truncate"
/>
<TranslatedMealDescription
  mealId={meal.id}
  defaultDescription={meal.description}
  className="text-sm text-muted-foreground line-clamp-2"
/>


================================================================================
SUMMARY OF CHANGES NEEDED:
================================================================================

Components that need updating:
1. ✅ Meals.tsx - Meal list/grid display
2. ✅ MealDetail.tsx - Individual meal detail page
3. ✅ Schedule.tsx - Scheduled meals display
4. ✅ Favorites.tsx - Favorite meals list
5. ✅ MealWizard.tsx - Meal selection wizard
6. ✅ SmartMealRecommendations.tsx - Recommendation cards
7. ✅ OrderDetail.tsx - Order history meal names
8. ✅ OrderHistory.tsx - Past order meal names
9. ✅ RestaurantDetail.tsx - Restaurant meal listings
10. ✅ AdminOrders.tsx - Admin order management
11. ✅ PartnerOrders.tsx - Partner order view
12. ✅ PartnerAnalytics.tsx - Analytics meal names

All changes follow this pattern:
- Import translation hooks/components
- Replace meal.name with translated name
- Replace meal.description with translated description
- Add loading state for translations (optional)
- Show fallback to English when translation not available

================================================================================
PERFORMANCE OPTIMIZATION:
================================================================================

For lists with many meals, use batch translation:

const mealIds = meals.map(m => m.id);
const { data: translations } = useMealsTranslations(mealIds, 'ar');

// Then in render:
const getTranslatedName = (meal) => {
  const t = translations?.get(meal.id);
  return t?.name || meal.name;
};

This fetches all translations in one query instead of N separate queries.

================================================================================
*/

export {};
