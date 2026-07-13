import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSmartAdjustments, type AdjustmentSuggestion } from "@/hooks/useSmartAdjustments";
import {
  Target,
  History,
  ThumbsUp,
  ThumbsDown,
  X,
  Loader2,
  ChevronRight,
  CheckCheck,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

interface SmartAdjustmentsPanelProps {
  userId: string | undefined;
  activeGoal: {
    goal_type: string;
    target_weight_kg: number | null;
    target_date: string | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
  } | null;
  updateGoalTargets: (updates: Record<string, number>) => Promise<boolean>;
  onGoalUpdated: () => void;
}

const SMART_ADJUSTMENT_PREF_KEY = "smart_goal_adjustment_enabled";

const toPreferenceRecord = (preferences: unknown): Record<string, unknown> => {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return {};
  return preferences as Record<string, unknown>;
};

const readSmartAdjustmentPreference = (preferences: unknown) => {
  const record = toPreferenceRecord(preferences);
  return typeof record[SMART_ADJUSTMENT_PREF_KEY] === "boolean"
    ? record[SMART_ADJUSTMENT_PREF_KEY] as boolean
    : true;
};

export const SmartAdjustmentsPanel = ({
  userId,
  activeGoal,
  updateGoalTargets,
  onGoalUpdated,
}: SmartAdjustmentsPanelProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [smartAdjustment, setSmartAdjustment] = useState(true);
  const [savingSmartAdjustment, setSavingSmartAdjustment] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [expandedImpact, setExpandedImpact] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [, setFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadSmartAdjustmentPreference = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error("Failed to load smart adjustment preference", error);
        return;
      }

      setSmartAdjustment(readSmartAdjustmentPreference(data?.notification_preferences));
    };

    loadSmartAdjustmentPreference();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleSmartAdjustment = async () => {
    if (savingSmartAdjustment) return;

    const previous = smartAdjustment;
    const next = !previous;
    setSmartAdjustment(next);

    if (!userId) return;

    setSavingSmartAdjustment(true);
    try {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("user_id", userId)
        .maybeSingle();

      if (loadError) throw loadError;

      const existingPreferences = toPreferenceRecord(data?.notification_preferences);
      const nextPreferences = {
        ...existingPreferences,
        [SMART_ADJUSTMENT_PREF_KEY]: next,
      };
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          notification_preferences: nextPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;
      queryClient.setQueryData(["profile", userId], (current: unknown) => {
        if (!current || typeof current !== "object") return current;
        return {
          ...current,
          notification_preferences: nextPreferences,
        };
      });
    } catch (error) {
      console.error("Failed to save smart adjustment preference", error);
      setSmartAdjustment(previous);
      toast({
        title: t("settings_error_updating"),
        description: t("settings_error_updating_desc"),
        variant: "destructive",
      });
    } finally {
      setSavingSmartAdjustment(false);
    }
  };

  const {
    suggestions,
    highConfidenceSuggestions,
    loading: adjustLoading,
    history: adjustHistory,
    dismiss,
    recordApply,
    recordFeedback,
    refresh: refreshAdjustments,
  } = useSmartAdjustments(userId, activeGoal, smartAdjustment);

  const applyAdjustment = async (s: AdjustmentSuggestion) => {
    if (s.safetyBlock) return;
    setApplyingId(s.id);
    const ok = await updateGoalTargets({ [s.field]: s.suggestedValue });
    setApplyingId(null);
    if (ok) {
      recordApply(s);
      toast({ title: t("goal_updated"), description: `${s.label} ${t("applied_successfully")}` });
      onGoalUpdated();
      refreshAdjustments();
    } else {
      toast({ title: t("failed_to_update"), description: t("please_try_again"), variant: "destructive" });
    }
  };

  const applyAllHighConfidence = async () => {
    if (highConfidenceSuggestions.length === 0) return;
    setApplyingAll(true);
    const updates: Record<string, number> = {};
    highConfidenceSuggestions.forEach(s => { updates[s.field] = s.suggestedValue; });
    const ok = await updateGoalTargets(updates);
    setApplyingAll(false);
    if (ok) {
      highConfidenceSuggestions.forEach(s => recordApply(s));
      toast({ title: `${highConfidenceSuggestions.length} ${t("goals_adjusted")}`, description: t("all_high_confidence_applied") });
      onGoalUpdated();
      refreshAdjustments();
    } else {
      toast({ title: t("failed_to_update"), description: t("some_updates_failed"), variant: "destructive" });
    }
  };

  return (
    <div className="rounded-2xl bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-[15px]">{t("smart_adjustments")}</h3>
            <p className="text-xs text-slate-400">
              {suggestions.length > 0
                ? t("suggestions_based_on_days", { count: suggestions.length, plural: suggestions.length !== 1 ? "s" : "", days: suggestions[0]?.daysAnalyzed ?? 0 })
                : t("goal_optimization")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {adjustHistory.length > 0 && (
            <button
              className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
              onClick={() => setShowHistory(h => !h)}
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <button
            role="switch"
            aria-checked={smartAdjustment}
            disabled={savingSmartAdjustment}
            onClick={toggleSmartAdjustment}
            className={cn(
              "relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-70",
              smartAdjustment ? "bg-[#22C7A1]" : "bg-slate-300"
            )}
          >
            <span className={cn(
              "absolute text-[9px] font-bold uppercase tracking-wide transition-opacity duration-200",
              smartAdjustment ? "left-2 text-white opacity-100" : "left-2 text-white opacity-0"
            )}>ON</span>
            <span className={cn(
              "absolute text-[9px] font-bold uppercase tracking-wide transition-opacity duration-200",
              !smartAdjustment ? "right-2 text-slate-500 opacity-100" : "right-2 text-slate-500 opacity-0"
            )}>OFF</span>
            <span className={cn(
              "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300",
              smartAdjustment ? "translate-x-8" : "translate-x-1"
            )} />
          </button>
        </div>
      </div>

      {/* History panel */}
      {showHistory && adjustHistory.length > 0 && (
        <div className="mx-5 mb-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">{t("applied_history")}</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {adjustHistory.slice(0, 8).map(h => (
              <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-slate-700">{h.field.replace(/_/g, " ").replace("target", "").trim()}</p>
                  <p className="text-xs text-slate-400">
                    {h.oldValue} → <span className="text-emerald-600 font-semibold">{h.newValue}</span>
                    {" · "}{new Date(h.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                {h.feedback ? (
                  <span className="text-xs text-slate-400">{h.feedback === "helpful" ? "👍" : "👎"}</span>
                ) : (
                  <div className="flex gap-1">
                    <button className="text-slate-300 hover:text-emerald-500 transition-colors" onClick={() => { recordFeedback(h.id, "helpful"); setFeedbackId(h.id); }}>
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-slate-300 hover:text-red-400 transition-colors" onClick={() => { recordFeedback(h.id, "not_helpful"); setFeedbackId(h.id); }}>
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {smartAdjustment && (
        <div className="px-5 pb-5 space-y-3">
          {adjustLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("analyzing_21_days")}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-6 space-y-1">
              <p className="font-medium">
                {activeGoal ? t("not_enough_data") : t("no_active_goal")}
              </p>
              <p className="text-xs text-slate-400">
                {activeGoal ? t("log_meals_4_days") : t("set_nutrition_goal_first")}
              </p>
            </div>
          ) : (
            <>
              {highConfidenceSuggestions.length > 1 && (
                <button
                  className="w-full flex items-center justify-between bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl px-4 py-2.5 transition-colors active:scale-[0.98]"
                  disabled={applyingAll}
                  onClick={applyAllHighConfidence}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCheck className="w-4 h-4" />
                    {t("apply")} {highConfidenceSuggestions.length} {t("high_confidence_changes")}
                  </div>
                  {applyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}

              {suggestions.map((s) => {
                const unit = s.field.includes("calorie") ? " kcal" : "g";
                const diff = s.suggestedValue - s.currentValue;
                const isExpanded = expandedImpact === s.id;
                const pct = s.confidenceScore;
                const nutrientName = s.field.replace("_target_g", "").replace("daily_calorie_target", "calories").replace(/_/g, " ");

                return (
                  <div key={s.id} className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
                    <div className="p-4">
                      {/* Top badges */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          {s.id === "on-track" ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              <CheckCheck className="w-3 h-3" /> {t("on_track")}
                            </span>
                          ) : s.safetyBlock ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <ShieldAlert className="w-3 h-3" /> {t("safety_tip")}
                            </span>
                          ) : (
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", {
                              "bg-emerald-100 text-emerald-700": s.confidence === "high",
                              "bg-amber-100 text-amber-700": s.confidence === "medium",
                              "bg-slate-200 text-slate-500": s.confidence === "low",
                            })}>
                              {s.confidence === "high" ? t("high_confidence") : s.confidence === "medium" ? t("suggestion") : t("exploratory")}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 capitalize">{t(s.category)}</span>
                        </div>
                        <button className="text-slate-300 hover:text-slate-500 p-0.5 transition-colors" onClick={() => dismiss(s.id)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Gauge + Info layout */}
                      <div className="flex gap-4">
                        {/* Gauge ring */}
                        <div className="shrink-0 flex flex-col items-center">
                          <div className="relative w-20 h-20">
                            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                              <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                              <circle
                                cx="40" cy="40" r="32"
                                fill="none"
                                stroke="url(#gaugeGradLight)"
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${Math.min(pct, 100) * 2.01} 201`}
                                className="transition-all duration-700"
                              />
                              <defs>
                                <linearGradient id="gaugeGradLight" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#34d399" />
                                  <stop offset="100%" stopColor="#10b981" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-lg font-extrabold text-slate-800 leading-none">{pct}%</span>
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-400 text-center mt-1 capitalize">{nutrientName} · {t("high_confidence")}</p>
                        </div>

                        {/* Info side */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 mb-1">{s.label}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{s.reason}</p>
                        </div>
                      </div>

                      {/* Step-down journey */}
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">{t("target_step_down_journey")}</p>
                        <div className="flex items-center gap-1">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                            <p className="text-[9px] text-emerald-600 font-semibold mt-1">{s.currentValue}{unit}</p>
                            <p className="text-[8px] text-slate-400">{t("current_average")}</p>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-emerald-400 to-teal-400 relative mx-1">
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-[9px] text-teal-700 font-semibold whitespace-nowrap">
                              {diff > 0 ? "↑" : "↓"} {diff > 0 ? "+" : ""}{diff}{unit}
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-teal-100" />
                            <p className="text-[9px] text-teal-600 font-semibold mt-1">{s.suggestedValue}{unit}</p>
                            <p className="text-[8px] text-slate-400">{t("smart_goal")}</p>
                          </div>
                        </div>
                      </div>

                      {/* Estimated Benefits */}
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{t("estimated_benefits")}</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: t("habit_consistency"), value: "+18%" },
                            { label: t("reduced_daily_pressure") },
                            { label: t("sustained_support") },
                          ].map((b, i) => (
                            <div key={i} className="bg-white border border-slate-100 rounded-xl px-2 py-2 text-center">
                              {b.value && <p className="text-xs font-bold text-emerald-600 mb-0.5">{b.value}</p>}
                              <p className="text-[9px] text-slate-500 leading-tight">{b.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer: Impact + Apply */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200">
                        <button
                          className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 transition-colors active:scale-[0.98]"
                          onClick={() => setExpandedImpact(isExpanded ? null : s.id)}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          {isExpanded ? t("hide_impact") : t("view_impact_projection")}
                        </button>
                        {!s.safetyBlock && (
                          <button
                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors active:scale-[0.95] disabled:opacity-50"
                            disabled={applyingId === s.id}
                            onClick={() => applyAdjustment(s)}
                          >
                            {applyingId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCheck className="w-3.5 h-3.5" />
                                {t("apply").toUpperCase()}
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expanded impact */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
                          {s.impact}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};
