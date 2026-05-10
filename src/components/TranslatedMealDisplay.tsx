/* eslint-disable react-refresh/only-export-components */
// Translated Meal Display Components
// Wrapper components for displaying meals with translation support

import { useMemo } from "react";
import { useUserLanguage, useMealTranslation } from "@/hooks/useMealTranslation";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, AlertCircle } from "lucide-react";

interface TranslatedMealNameProps {
  mealId: string;
  defaultName: string;
  className?: string;
  showIndicator?: boolean;
}

/**
 * Displays meal name with translation
 * Shows loading state while fetching translation
 * Falls back to default name if no translation available
 */
export function TranslatedMealName({
  mealId,
  defaultName,
  className = "",
  showIndicator = false,
}: TranslatedMealNameProps) {
  const { data: userLanguage } = useUserLanguage();
  const { data: translation, isLoading } = useMealTranslation(mealId, userLanguage || "en");

  // Memoize the display name
  const displayName = useMemo(() => {
    if (translation?.name && translation.isTranslated) {
      return translation.name;
    }
    return defaultName;
  }, [translation, defaultName]);

  // Show loading skeleton
  if (isLoading) {
    return <Skeleton className={`h-5 w-32 ${className}`} />;
  }

  // Show translation indicator if fallback is being used
  const isFallback = !translation?.isTranslated && userLanguage === "ar";

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {displayName}
      {showIndicator && isFallback && (
        <AlertCircle className="w-3 h-3 text-muted-foreground" title="English only" />
      )}
      {showIndicator && translation?.isAutoTranslated && translation.isTranslated && (
        <Globe className="w-3 h-3 text-muted-foreground" title="Auto-translated" />
      )}
    </span>
  );
}

interface TranslatedMealDescriptionProps {
  mealId: string;
  defaultDescription: string | null;
  className?: string;
  maxLength?: number;
}

/**
 * Displays meal description with translation
 * Handles truncation and fallback
 */
export function TranslatedMealDescription({
  mealId,
  defaultDescription,
  className = "",
  maxLength,
}: TranslatedMealDescriptionProps) {
  const { data: userLanguage } = useUserLanguage();
  const { data: translation, isLoading } = useMealTranslation(mealId, userLanguage || "en");

  const displayDescription = useMemo(() => {
    if (translation?.description && translation.isTranslated) {
      return translation.description;
    }
    return defaultDescription;
  }, [translation, defaultDescription]);

  // Show loading skeleton
  if (isLoading) {
    return <Skeleton className={`h-4 w-full ${className}`} />;
  }

  if (!displayDescription) {
    return null;
  }

  // Truncate if maxLength provided
  const text = maxLength && displayDescription.length > maxLength
    ? `${displayDescription.substring(0, maxLength)}...`
    : displayDescription;

  return <p className={className}>{text}</p>;
}

interface TranslatedMealCardProps {
  meal: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    calories: number | null;
    restaurant_name?: string;
    rating?: number;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * Complete meal card with translation support
 * Wraps any meal card component with translation
 */
export function TranslatedMealCard({
  meal,
  children,
  className = "",
}: TranslatedMealCardProps) {
  const { data: userLanguage } = useUserLanguage();
  const { data: translation, isLoading } = useMealTranslation(meal.id, userLanguage || "en");

  // Memoize translated values
  const translatedMeal = useMemo(() => {
    if (translation?.isTranslated) {
      return {
        ...meal,
        name: translation.name || meal.name,
        description: translation.description || meal.description,
        isTranslated: true,
        isAutoTranslated: translation.isAutoTranslated,
      };
    }
    return { ...meal, isTranslated: false, isAutoTranslated: false };
  }, [meal, translation]);

  // Pass translated meal to children
  if (children) {
    return (
      <div className={className} data-translated={translatedMeal.isTranslated}>
        {children}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {isLoading ? (
        <>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </>
      ) : (
        <>
          <h3 className="font-semibold">{translatedMeal.name}</h3>
          {translatedMeal.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {translatedMeal.description}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Hook for getting translated meal data (for use in existing components)
export function useTranslatedMeal(
  meal: { id: string; name: string; description: string | null } | null | undefined
) {
  const { data: userLanguage } = useUserLanguage();
  const { data: translation, isLoading } = useMealTranslation(
    meal?.id,
    userLanguage || "en"
  );

  return useMemo(() => {
    if (!meal) return null;

    const isTranslated = translation?.isTranslated && userLanguage === "ar";
    const isFallback = !isTranslated && userLanguage === "ar";

    return {
      ...meal,
      displayName: isTranslated ? translation.name : meal.name,
      displayDescription: isTranslated
        ? translation.description
        : meal.description,
      isTranslated,
      isFallback,
      isLoading,
      isAutoTranslated: translation?.isAutoTranslated || false,
    };
  }, [meal, translation, userLanguage, isLoading]);
}

// Export all components
export default {
  TranslatedMealName,
  TranslatedMealDescription,
  TranslatedMealCard,
  useTranslatedMeal,
};
