// Custom hook for meal translations
// Manages translation fetching, caching, and language preferences

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMealTranslation,
  getMealsTranslations,
  getUserLanguage,
  setUserLanguage,
  getTranslationStatus,
  updateTranslation,
  triggerMealTranslation,
  type LanguageCode,
  type TranslatedMeal,
} from "@/services/translationService";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook to get user's preferred language
 */
export function useUserLanguage() {
  return useQuery({
    queryKey: ["user-language"],
    queryFn: getUserLanguage,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to set user's preferred language
 */
export function useSetUserLanguage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: setUserLanguage,
    onSuccess: () => {
      // Invalidate all translation queries
      queryClient.invalidateQueries({ queryKey: ["user-language"] });
      queryClient.invalidateQueries({ queryKey: ["meal-translation"] });
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      
      toast({
        title: "Language Updated",
        description: "Your language preference has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update language preference. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to set language:", error);
    },
  });
}

/**
 * Hook to get a single meal translation
 */
export function useMealTranslation(
  mealId: string | null | undefined,
  languageCode: LanguageCode = "en"
) {
  return useQuery({
    queryKey: ["meal-translation", mealId, languageCode],
    queryFn: () => {
      if (!mealId) return null;
      return getMealTranslation(mealId, languageCode);
    },
    enabled: !!mealId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to get multiple meal translations in batch
 */
export function useMealsTranslations(
  mealIds: string[],
  languageCode: LanguageCode = "en"
) {
  return useQuery({
    queryKey: ["meals-translations", mealIds, languageCode],
    queryFn: () => getMealsTranslations(mealIds, languageCode),
    enabled: mealIds.length > 0,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to get translation status for a meal
 * Useful for showing badges/indicators in partner portal
 */
export function useTranslationStatus(mealId: string | null | undefined) {
  return useQuery({
    queryKey: ["translation-status", mealId],
    queryFn: () => {
      if (!mealId) {
        return {
          hasTranslation: false,
          isAutoTranslated: false,
          reviewStatus: "none",
          lastUpdated: null,
        };
      }
      return getTranslationStatus(mealId);
    },
    enabled: !!mealId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to trigger auto-translation for a meal
 */
export function useTriggerTranslation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      mealId,
      name,
      description,
    }: {
      mealId: string;
      name: string;
      description: string | null;
    }) => triggerMealTranslation(mealId, name, description),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate translation queries
        queryClient.invalidateQueries({
          queryKey: ["meal-translation", variables.mealId],
        });
        queryClient.invalidateQueries({
          queryKey: ["translation-status", variables.mealId],
        });
        
        toast({
          title: "Translation Started",
          description: "Your meal is being translated to Arabic. This may take a few moments.",
        });
      } else {
        toast({
          title: "Translation Failed",
          description: result.error || "Failed to translate meal. Please try again later.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Translation Error",
        description: "An error occurred while translating. Please try again.",
        variant: "destructive",
      });
      console.error("Translation mutation error:", error);
    },
  });
}

/**
 * Hook to update a translation (for partners)
 */
export function useUpdateTranslation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      mealId,
      languageCode,
      updates,
    }: {
      mealId: string;
      languageCode: LanguageCode;
      updates: {
        name?: string;
        description?: string | null;
        reviewStatus?: "pending" | "approved" | "rejected" | "needs_review";
      };
    }) => updateTranslation(mealId, languageCode, updates),
    onSuccess: (_, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({
        queryKey: ["meal-translation", variables.mealId],
      });
      queryClient.invalidateQueries({
        queryKey: ["translation-status", variables.mealId],
      });
      queryClient.invalidateQueries({ queryKey: ["pending-translations"] });
      
      toast({
        title: "Translation Updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to save translation changes. Please try again.",
        variant: "destructive",
      });
      console.error("Update translation error:", error);
    },
  });
}

/**
 * Hook for customer-facing meals with automatic language detection
 * This is the main hook customers will use
 */
export function useLocalizedMeal(
  mealId: string | null | undefined,
  preferredLanguage?: LanguageCode
) {
  const { data: userLanguage } = useUserLanguage();
  const language = preferredLanguage || userLanguage || "en";

  const translationQuery = useMealTranslation(mealId, language);
  const statusQuery = useTranslationStatus(mealId);

  return {
    ...translationQuery,
    data: translationQuery.data,
    isLoading: translationQuery.isLoading || statusQuery.isLoading,
    isError: translationQuery.isError || statusQuery.isError,
    error: translationQuery.error || statusQuery.error,
    language,
    status: statusQuery.data,
  };
}

/**
 * Hook for partner dashboard - shows translation status and allows editing
 */
export function usePartnerMealTranslation(mealId: string | null | undefined) {
  const { data: translation } = useMealTranslation(mealId, "ar");
  const { data: status } = useTranslationStatus(mealId);
  const triggerMutation = useTriggerTranslation();
  const updateMutation = useUpdateTranslation();

  return {
    translation,
    status,
    triggerTranslation: triggerMutation.mutate,
    isTriggering: triggerMutation.isPending,
    updateTranslation: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}

export default {
  useUserLanguage,
  useSetUserLanguage,
  useMealTranslation,
  useMealsTranslations,
  useTranslationStatus,
  useTriggerTranslation,
  useUpdateTranslation,
  useLocalizedMeal,
  usePartnerMealTranslation,
};
