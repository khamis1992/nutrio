import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useProfile } from "@/hooks/useProfile";
import {
  isActionableSmartAdjustment,
  useSmartAdjustments,
} from "@/hooks/useSmartAdjustments";

const SMART_ADJUSTMENT_PREF_KEY = "smart_goal_adjustment_enabled";

const toPreferenceRecord = (preferences: unknown): Record<string, unknown> => {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return {};
  return preferences as Record<string, unknown>;
};

const getSmartAdjustmentEnabled = (preferences: unknown) => {
  const record = toPreferenceRecord(preferences);
  return typeof record[SMART_ADJUSTMENT_PREF_KEY] === "boolean"
    ? (record[SMART_ADJUSTMENT_PREF_KEY] as boolean)
    : true;
};

const getTodayKey = () => new Date().toISOString().split("T")[0];

export const useSmartGoalAdjustmentNotifications = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { profile, loading: profileLoading } = useProfile();
  const { activeGoal, loading: goalsLoading } = useNutritionGoals(user?.id);
  const processedKeys = useRef<Set<string>>(new Set());

  const smartAdjustmentEnabled = useMemo(
    () => getSmartAdjustmentEnabled(profile?.notification_preferences),
    [profile?.notification_preferences]
  );

  const enabled = Boolean(
    user?.id &&
    activeGoal &&
    smartAdjustmentEnabled &&
    !profileLoading &&
    !goalsLoading
  );

  const { suggestions, loading: suggestionsLoading } = useSmartAdjustments(
    user?.id,
    activeGoal,
    enabled
  );

  useEffect(() => {
    if (!user?.id || !activeGoal || !enabled || suggestionsLoading) return;

    const actionableSuggestions = suggestions.filter(isActionableSmartAdjustment);
    if (actionableSuggestions.length === 0) return;

    const suggestionIds = actionableSuggestions
      .map((suggestion) => suggestion.id)
      .sort()
      .join("-");
    const dedupeKey = `smart-goal:${user.id}:${activeGoal.id}:${getTodayKey()}:${suggestionIds}`;
    if (processedKeys.current.has(dedupeKey)) return;
    processedKeys.current.add(dedupeKey);

    const createNotification = async () => {
      const { data: existing, error: existingError } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "health_insight")
        .eq("data->>dedupe_key", dedupeKey)
        .maybeSingle();

      if (existingError) {
        console.error("Failed to check smart goal notification", existingError);
        processedKeys.current.delete(dedupeKey);
        return;
      }

      if (existing) return;

      const topSuggestion = actionableSuggestions[0];
      const { error: insertError } = await supabase.from("notifications").insert({
        user_id: user.id,
        type: "health_insight",
        title: t("smart_goal_notification_title"),
        message: t("smart_goal_notification_message", {
          count: actionableSuggestions.length,
          label: topSuggestion.label,
        }),
        status: "unread",
        related_entity_id: activeGoal.id,
        related_entity_type: "nutrition_goal",
        data: {
          subtype: "smart_goal_adjustment",
          dedupe_key: dedupeKey,
          route: "/edit-goal",
          suggestion_count: actionableSuggestions.length,
          suggestions: actionableSuggestions.map((suggestion) => ({
            id: suggestion.id,
            field: suggestion.field,
            label: suggestion.label,
            confidence: suggestion.confidence,
            confidenceScore: suggestion.confidenceScore,
            currentValue: suggestion.currentValue,
            suggestedValue: suggestion.suggestedValue,
          })),
        },
      });

      if (insertError) {
        console.error("Failed to create smart goal notification", insertError);
        processedKeys.current.delete(dedupeKey);
      }
    };

    createNotification();
  }, [activeGoal, enabled, suggestions, suggestionsLoading, t, user?.id]);
};
