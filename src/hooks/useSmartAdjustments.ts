import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";
export type AdjustmentCategory = "calories" | "protein" | "carbs" | "fat";

export interface AdjustmentSuggestion {
  id: string;
  field: "daily_calorie_target" | "protein_target_g" | "carbs_target_g" | "fat_target_g";
  category: AdjustmentCategory;
  label: string;
  reason: string;
  impact: string; // plain-English expected outcome
  currentValue: number;
  suggestedValue: number;
  direction: "up" | "down";
  confidence: ConfidenceLevel;
  confidenceScore: number;    // 0-100
  daysAnalyzed: number;
  safetyBlock: boolean;       // blocked by guardrail — show as tip only
}

export interface AdjustmentHistory {
  id: string;
  field: string;
  appliedAt: string;
  oldValue: number;
  newValue: number;
  feedback?: "helpful" | "not_helpful";
}

interface GoalSnapshot {
  daily_calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  goal_type: string | null;
  target_weight_kg?: number | null;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const HISTORY_KEY = (uid: string) => `smart_adj_history_${uid}`;
const DISMISSED_KEY = (uid: string) => `smart_adj_dismissed_${uid}`;
const COOLDOWN_DAYS = 7; // don't re-suggest the same field within 7 days of applying

export function getAdjustmentHistory(userId: string): AdjustmentHistory[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY(userId)) || "[]");
  } catch { return []; }
}

export function saveAdjustmentToHistory(userId: string, entry: Omit<AdjustmentHistory, "appliedAt">) {
  const history = getAdjustmentHistory(userId);
  const updated = [{ ...entry, appliedAt: new Date().toISOString() }, ...history].slice(0, 50);
  localStorage.setItem(HISTORY_KEY(userId), JSON.stringify(updated));
}

export function saveFeedback(userId: string, id: string, feedback: "helpful" | "not_helpful") {
  const history = getAdjustmentHistory(userId);
  const updated = history.map(h => h.id === id ? { ...h, feedback } : h);
  localStorage.setItem(HISTORY_KEY(userId), JSON.stringify(updated));
}

function getDismissedIds(userId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY(userId)) || "[]");
    // Only keep dismissals from the last 7 days
    const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    return raw.filter((d: { id: string; at: number }) => d.at > cutoff).map((d: { id: string }) => d.id);
  } catch { return []; }
}

export function dismissSuggestion(userId: string, id: string) {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY(userId)) || "[]");
    raw.push({ id, at: Date.now() });
    localStorage.setItem(DISMISSED_KEY(userId), JSON.stringify(raw.slice(-100)));
  } catch { /* ignore */ }
}

// Check if field was applied recently (cooldown)
function isInCooldown(userId: string, field: string): boolean {
  const history = getAdjustmentHistory(userId);
  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return history.some(h => h.field === field && new Date(h.appliedAt).getTime() > cutoff);
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function avg(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

/** Consistency: fraction of values within ±15% of mean */
function consistencyScore(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = avg(arr);
  const onTarget = arr.filter(v => Math.abs(v - mean) / mean < 0.15).length;
  return onTarget / arr.length;
}

function round50(n: number) { return Math.round(n / 50) * 50; }
function round5(n: number)  { return Math.round(n / 5) * 5; }

// ─── Safety guardrails ────────────────────────────────────────────────────────

const SAFETY = {
  minCalories: 1200,
  maxCalorieStepDown: 300,   // max single-step reduction
  maxCalorieStepUp: 400,
  minProtein: 50,
  maxProteinStepUp: 20,
  minCarbs: 80,
  minFat: 30,
};

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useSmartAdjustments(
  userId: string | undefined,
  activeGoal: GoalSnapshot | null,
  enabled: boolean
) {
  const { t, language } = useLanguage();
  const [suggestions, setSuggestions] = useState<AdjustmentSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AdjustmentHistory[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const reloadLocal = useCallback(() => {
    if (!userId) return;
    setHistory(getAdjustmentHistory(userId));
    setDismissed(getDismissedIds(userId));
  }, [userId]);

  const analyze = useCallback(async () => {
    if (!userId || !activeGoal || !enabled) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch 21 days — split into recent (7d) and extended (8-21d) windows
      const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: logs } = await supabase
        .from("progress_logs")
        .select("log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
        .eq("user_id", userId)
        .gte("log_date", since)
        .order("log_date", { ascending: false });

      const allRows = logs || [];
      // Count total logged days first (any row with any macro data)
      const totalDays = allRows.length;
      if (totalDays < 4) { setSuggestions([]); return; }
      // For calculations use rows that actually have calorie data; fall back to all rows if needed
      const rows = allRows.filter((l: Record<string, unknown>) => ((l.calories_consumed as number) || 0) > 0).length >= 4
        ? allRows.filter((l: Record<string, unknown>) => ((l.calories_consumed as number) || 0) > 0)
        : allRows;

      const goalType = activeGoal.goal_type || "general_health";

      // Split: recent 7 days vs older
      const cutoff7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const recent  = rows.filter((l: Record<string, unknown>) => (l.log_date as string) >= cutoff7);
      const extended = rows;

      const cals  = extended.map((l: Record<string, unknown>) => (l.calories_consumed as number) || 0);
      const prots = extended.map((l: Record<string, unknown>) => (l.protein_consumed_g as number) || 0);
      const carbs = extended.map((l: Record<string, unknown>) => (l.carbs_consumed_g as number) || 0);
      const fats  = extended.map((l: Record<string, unknown>) => (l.fat_consumed_g as number) || 0);

      const recentCals  = recent.map((l: Record<string, unknown>) => (l.calories_consumed as number) || 0);

      const avgCal  = avg(cals);
      const avgProt = avg(prots);
      const avgCarb = avg(carbs);
      const avgFat  = avg(fats);

      // Trend: is recent 7d trending differently from extended?
      const recentAvgCal = recentCals.length > 0 ? avg(recentCals) : avgCal;
      const calTrend: "improving" | "worsening" | "stable" =
        recentCals.length >= 3 && Math.abs(recentAvgCal - avgCal) / Math.max(avgCal, 1) > 0.1
          ? recentAvgCal < avgCal ? "improving" : "worsening"
          : "stable";

      const calConsistency  = consistencyScore(cals);
      const protConsistency = consistencyScore(prots);
      const n = extended.length;

      const dismissedIds  = getDismissedIds(userId);
      const result: AdjustmentSuggestion[] = [];

      // ─── Helper to build confidence score ──────────────────────────
      const buildConfidence = (
        ratio: number,                // how far from target
        consistency: number,          // 0-1
        daysN: number,
        trendBonus: number = 0        // +/- for trend
      ): { level: ConfidenceLevel; score: number } => {
        let score = 0;
        // Data sufficiency
        score += Math.min(daysN / 14, 1) * 40;
        // Consistency (stable behaviour = more confident)
        score += consistency * 30;
        // Distance from target (further away = clearer signal)
        score += Math.min(Math.abs(1 - ratio) * 60, 25);
        // Trend bonus
        score += trendBonus;
        score = Math.round(Math.min(Math.max(score, 5), 100));
        const level: ConfidenceLevel = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
        return { level, score };
      };

      // ─── CALORIES ──────────────────────────────────────────────────
      const calRatio = avgCal / activeGoal.daily_calorie_target;
      const calField = "daily_calorie_target";
      if (!isInCooldown(userId, calField)) {
        if (calRatio < 0.80) {
          // Consistently eating far below target — suggest a reachable step
          const step = Math.min(activeGoal.daily_calorie_target - round50(avgCal * 1.1), SAFETY.maxCalorieStepDown);
          const suggested = Math.max(round50(activeGoal.daily_calorie_target - step), SAFETY.minCalories);
          const { level, score } = buildConfidence(calRatio, calConsistency, n,
            calTrend === "improving" ? -5 : calTrend === "worsening" ? 5 : 0);
          const safe = suggested >= SAFETY.minCalories;
          result.push({
            id: "cal-down",
            field: calField,
            category: "calories",
            label: t("adj_label_cal_down"),
            reason: t("adj_reason_cal_down", { avg: Math.round(avgCal), days: n, pct: Math.round(calRatio * 100), target: activeGoal.daily_calorie_target, note: calConsistency > 0.6 ? t("adj_consistency_note") : "" }),
            impact: t("adj_impact_cal_down", { pct: Math.round((1 - calRatio) * 60) }),
            currentValue: activeGoal.daily_calorie_target,
            suggestedValue: suggested,
            direction: "down",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: !safe,
          });
        } else if (calRatio > 1.12 && goalType !== "muscle_gain") {
          const suggested = Math.min(round50(avgCal * 0.96), activeGoal.daily_calorie_target + SAFETY.maxCalorieStepUp);
          const { level, score } = buildConfidence(calRatio, calConsistency, n);
          result.push({
            id: "cal-up",
            field: calField,
            category: "calories",
            label: t("adj_label_cal_up"),
            reason: t("adj_reason_cal_up", { avg: Math.round(avgCal), pct: Math.round((calRatio - 1) * 100), target: activeGoal.daily_calorie_target }),
            impact: t("adj_impact_cal_up"),
            currentValue: activeGoal.daily_calorie_target,
            suggestedValue: suggested,
            direction: "up",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: false,
          });
        } else if (calRatio > 1.10 && goalType === "muscle_gain") {
          const suggested = round50(avgCal);
          const { level, score } = buildConfidence(calRatio, calConsistency, n);
          result.push({
            id: "cal-muscle",
            field: calField,
            category: "calories",
            label: t("adj_label_cal_muscle"),
            reason: t("adj_reason_cal_muscle", { avg: Math.round(avgCal) }),
            impact: t("adj_impact_cal_muscle"),
            currentValue: activeGoal.daily_calorie_target,
            suggestedValue: Math.min(suggested, activeGoal.daily_calorie_target + SAFETY.maxCalorieStepUp),
            direction: "up",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: false,
          });
        }
      }

      // ─── PROTEIN ───────────────────────────────────────────────────
      const protRatio = avgProt / activeGoal.protein_target_g;
      const protField = "protein_target_g";
      if (!isInCooldown(userId, protField)) {
        if (protRatio < 0.75) {
          const suggested = Math.max(round5(avgProt * 1.15), SAFETY.minProtein);
          const { level, score } = buildConfidence(protRatio, protConsistency, n);
          result.push({
            id: "prot-down",
            field: protField,
            category: "protein",
            label: t("adj_label_prot_down"),
            reason: t("adj_reason_prot_down", { avg: Math.round(avgProt), pct: Math.round(protRatio * 100), target: activeGoal.protein_target_g, suggested }),
            impact: t("adj_impact_prot_down", { suggested }),
            currentValue: activeGoal.protein_target_g,
            suggestedValue: suggested,
            direction: "down",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: suggested < SAFETY.minProtein,
          });
        } else if (protRatio >= 0.88 && goalType === "muscle_gain") {
          const suggested = Math.min(round5(activeGoal.protein_target_g * 1.10), activeGoal.protein_target_g + SAFETY.maxProteinStepUp);
          const { level, score } = buildConfidence(protRatio, protConsistency, n);
          result.push({
            id: "prot-up",
            field: protField,
            category: "protein",
            label: t("adj_label_prot_up"),
            reason: t("adj_reason_prot_up", { avg: Math.round(avgProt), pct: Math.round(protRatio * 100), suggested }),
            impact: t("adj_impact_prot_up"),
            currentValue: activeGoal.protein_target_g,
            suggestedValue: suggested,
            direction: "up",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: false,
          });
        }
      }

      // ─── CARBS ─────────────────────────────────────────────────────
      const carbRatio = avgCarb / activeGoal.carbs_target_g;
      const carbField = "carbs_target_g";
      if (!isInCooldown(userId, carbField)) {
        if (carbRatio > 1.12 && (goalType === "weight_loss" || goalType === "maintenance")) {
          const suggested = Math.max(round5(avgCarb * 0.90), SAFETY.minCarbs);
          const { level, score } = buildConfidence(carbRatio, consistencyScore(carbs), n);
          result.push({
            id: "carbs-down",
            field: carbField,
            category: "carbs",
            label: t("adj_label_carbs_down"),
            reason: t(goalType === "weight_loss" ? "adj_reason_carbs_down_loss" : "adj_reason_carbs_down_maintain", { avg: Math.round(avgCarb), pct: Math.round((carbRatio - 1) * 100), target: activeGoal.carbs_target_g }),
            impact: t("adj_impact_carbs_down", { reduction: Math.round(avgCarb - suggested), kcal: Math.round((avgCarb - suggested) * 4) }),
            currentValue: activeGoal.carbs_target_g,
            suggestedValue: suggested,
            direction: "down",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: suggested < SAFETY.minCarbs,
          });
        }
      }

      // ─── FAT ───────────────────────────────────────────────────────
      const fatRatio = avgFat / activeGoal.fat_target_g;
      const fatField = "fat_target_g";
      if (!isInCooldown(userId, fatField)) {
        if (fatRatio < 0.65 && n >= 4) {
          const suggested = Math.max(round5(avgFat * 1.15), SAFETY.minFat);
          const { level, score } = buildConfidence(fatRatio, consistencyScore(fats), n);
          result.push({
            id: "fat-adjust",
            field: fatField,
            category: "fat",
            label: t("adj_label_fat_adjust"),
            reason: t("adj_reason_fat_adjust", { avg: Math.round(avgFat), pct: Math.round(fatRatio * 100), target: activeGoal.fat_target_g }),
            impact: t("adj_impact_fat_adjust"),
            currentValue: activeGoal.fat_target_g,
            suggestedValue: suggested,
            direction: "down",
            confidence: level,
            confidenceScore: score,
            daysAnalyzed: n,
            safetyBlock: suggested < SAFETY.minFat,
          });
        }
      }

      // Filter dismissed and sort by confidence score descending
      const filtered = result
        .filter(s => !dismissedIds.includes(s.id))
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 4);

      // If no targeted suggestions but we have enough data, show a positive "on track" card
      if (filtered.length === 0 && rows.length >= 4) {
        filtered.push({
          id: "on-track",
          field: "daily_calorie_target",
          category: "calories",
          label: t("adj_label_on_track"),
          reason: t("adj_reason_on_track", { days: rows.length }),
          impact: t("adj_impact_on_track"),
          currentValue: activeGoal.daily_calorie_target,
          suggestedValue: activeGoal.daily_calorie_target,
          direction: "up",
          confidence: "high",
          confidenceScore: 85,
          daysAnalyzed: rows.length,
          safetyBlock: true, // reuse safetyBlock to hide the Apply button
        });
      }

      setSuggestions(filtered);
    } catch (err) {
      console.error("Smart adjustments error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, activeGoal, enabled, t]);

  useEffect(() => { analyze(); }, [analyze]);
  useEffect(() => { reloadLocal(); }, [reloadLocal]);

  const dismiss = useCallback((id: string) => {
    if (!userId) return;
    dismissSuggestion(userId, id);
    setSuggestions(prev => prev.filter(s => s.id !== id));
    setDismissed(prev => [...prev, id]);
  }, [userId]);

  const recordApply = useCallback((s: AdjustmentSuggestion) => {
    if (!userId) return;
    saveAdjustmentToHistory(userId, {
      id: `${s.id}_${Date.now()}`,
      field: s.field,
      oldValue: s.currentValue,
      newValue: s.suggestedValue,
    });
    setHistory(getAdjustmentHistory(userId));
  }, [userId]);

  const recordFeedback = useCallback((historyId: string, feedback: "helpful" | "not_helpful") => {
    if (!userId) return;
    saveFeedback(userId, historyId, feedback);
    setHistory(getAdjustmentHistory(userId));
  }, [userId]);

  const highConfidenceSuggestions = suggestions.filter(
    s => s.confidence === "high" && !s.safetyBlock
  );

  return {
    suggestions,
    highConfidenceSuggestions,
    loading,
    history,
    dismissed,
    dismiss,
    recordApply,
    recordFeedback,
    refresh: analyze,
  };
}
