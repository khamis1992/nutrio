import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLatestAbnormalMarkers } from "@/services/blood-work";
import { getAbnormalMarkerTags, type HealthTag } from "@/lib/meal-health-tagger";

interface SmartRecommendation {
  id: string;
  category: "nutrition" | "hydration" | "activity" | "sleep" | "general" | "blood";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action_text: string;
  action_link: string | null;
  progress?: { value: number; max: number; unit: string } | null;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function useSmartRecommendations(userId: string | undefined) {
  const { t, language } = useLanguage();
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const generateRecommendations = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Fetch real weekly logs directly (always populated)
      const [logsRes, waterRes, goalRes, streakRes, abnormalMarkers] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
          .eq("user_id", userId)
          .gte("log_date", weekAgo)
          .order("log_date", { ascending: false }),
        supabase
          .from("water_intake")
          .select("glasses, log_date")
          .eq("user_id", userId)
          .gte("log_date", weekAgo),
        supabase
          .from("nutrition_goals")
          .select("goal_type, daily_calorie_target, protein_target_g, target_weight_kg")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("user_streaks")
          .select("streak_type, current_streak, best_streak")
          .eq("user_id", userId),
        getLatestAbnormalMarkers(userId),
      ]);

      const logs = logsRes.data || [];
      const waterLogs = waterRes.data || [];
      const goal = goalRes.data;
      const streaks = streakRes.data || [];
      const bloodMarkers = abnormalMarkers || [];

      const recs: SmartRecommendation[] = [];

      const daysLogged = logs.length;
      const calorieTarget = goal?.daily_calorie_target || 2000;
      const proteinTarget = goal?.protein_target_g || 120;
      const goalType = goal?.goal_type || "general";

      // --- Derived stats ---
      const avgCalories = daysLogged > 0
        ? logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.calories_consumed as number) || 0), 0) / daysLogged
        : 0;
      const avgProtein = daysLogged > 0
        ? logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.protein_consumed_g as number) || 0), 0) / daysLogged
        : 0;
      const avgCarbs = daysLogged > 0
        ? logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.carbs_consumed_g as number) || 0), 0) / daysLogged
        : 0;
      const avgFat = daysLogged > 0
        ? logs.reduce((s: number, l: Record<string, unknown>) => s + ((l.fat_consumed_g as number) || 0), 0) / daysLogged
        : 0;
      const consistencyPct = Math.round((daysLogged / 7) * 100);
      const calorieDiff = avgCalories - calorieTarget;
      const proteinRatio = proteinTarget > 0 ? avgProtein / proteinTarget : 0;

      const totalWater = waterLogs.reduce((s: number, w: Record<string, unknown>) => s + ((w.glasses as number) || 0), 0);
      const avgWater = waterLogs.length > 0 ? totalWater / waterLogs.length : 0;

      const loggingStreak = streaks.find((s: Record<string, unknown>) => s.streak_type === "logging");
      const currentStreak = loggingStreak?.current_streak || 0;
      const bestStreak = loggingStreak?.best_streak || 0;

      // ─── High Priority ──────────────────────────────────────────────

      const bloodRecMap: Record<string, { title: string; desc: string; link: string }> = {
        "vitamin d": { title: "Low Vitamin D", desc: "Add fatty fish, eggs, and fortified milk. Get 15 min sunlight daily.", link: "/meals?filter=vitamin-d-rich" },
        "ldl": { title: "High LDL Cholesterol", desc: "Reduce saturated fats. Add oats, legumes, and apples for soluble fiber.", link: "/meals?filter=heart-healthy" },
        "total cholesterol": { title: "High Cholesterol", desc: "Reduce saturated fats. Add oats, legumes, and apples for soluble fiber.", link: "/meals?filter=heart-healthy" },
        "triglycerides": { title: "High Triglycerides", desc: "Reduce refined carbs and sugars. Add omega-3 rich foods.", link: "/meals?filter=heart-healthy" },
        "glucose": { title: "High Blood Sugar", desc: "Reduce sugars and simple carbs. Pair carbs with protein and fiber at every meal.", link: "/meals?filter=low-glycemic" },
        "hba1c": { title: "Elevated HbA1c", desc: "Focus on low-glycemic foods. Reduce refined sugars and increase fiber intake.", link: "/meals?filter=low-glycemic" },
        "fasting glucose": { title: "High Fasting Glucose", desc: "Reduce evening carbs. Add protein and fiber to dinner.", link: "/meals?filter=low-glycemic" },
        "hemoglobin": { title: "Abnormal Hemoglobin", desc: "Eat red meat, spinach, and lentils with vitamin C to improve absorption.", link: "/meals?filter=iron-rich" },
        "iron": { title: "Low Iron", desc: "Add liver, lentils, and spinach. Avoid tea/coffee with meals.", link: "/meals?filter=iron-rich" },
        "ferritin": { title: "Low Ferritin", desc: "Boost iron intake with red meat, lentils, and fortified cereals.", link: "/meals?filter=iron-rich" },
        "vitamin b12": { title: "Low Vitamin B12", desc: "Add animal protein, eggs, and fortified foods to your meals.", link: "/meals?filter=b12-rich" },
        "crp": { title: "Elevated Inflammation", desc: "Add anti-inflammatory foods: turmeric, berries, fatty fish, and leafy greens.", link: "/meals?filter=anti-inflammatory" },
        "esr": { title: "Elevated Inflammation", desc: "Add anti-inflammatory foods: turmeric, berries, fatty fish, and leafy greens.", link: "/meals?filter=anti-inflammatory" },
        "tsh": { title: "Thyroid Imbalance", desc: "Consult your endocrinologist. Add iodine-rich foods like fish and dairy.", link: "/health/dashboard" },
      };

      for (const marker of bloodMarkers) {
        const key = marker.marker_name.toLowerCase();
        const rec = bloodRecMap[key];
        if (!rec) continue;
        const tags = getAbnormalMarkerTags(marker.marker_name);
        const filterParam = tags.length > 0 ? tags[0] : "";
        recs.push({
          id: `blood-${key}`,
          category: "blood",
          priority: marker.status === "critical" ? "high" : "high",
          title: rec.title,
          description: `${rec.desc} (${marker.value} ${marker.unit} — ${marker.status})`,
          action_text: "View matching meals",
          action_link: filterParam ? `/meals?filter=${filterParam}` : "/health/dashboard",
        });
      }

      if (daysLogged < 3) {
        recs.push({
          id: "low-logging",
          category: "general",
          priority: "high",
          title: t("rec_start_tracking_title"),
          description: t("rec_start_tracking_desc", { days: daysLogged, plural: daysLogged === 1 ? "" : "s" }),
          action_text: t("rec_start_tracking_action"),
          action_link: "/dashboard",
        });
      }

      if (proteinRatio < 0.6 && daysLogged >= 2) {
        recs.push({
          id: "protein-low",
          category: "nutrition",
          priority: "high",
          title: t("rec_protein_low_title"),
          description: t("rec_protein_low_desc", { avg: Math.round(avgProtein), pct: Math.round(proteinRatio * 100), target: proteinTarget }),
          action_text: t("rec_protein_low_action"),
          action_link: "/meals?filter=high-protein",
          progress: { value: Math.round(avgProtein), max: proteinTarget, unit: "g" },
        });
      }

      if (calorieDiff > 300 && daysLogged >= 3 && (goalType === "weight_loss" || goalType === "maintenance")) {
        recs.push({
          id: "calories-over",
          category: "nutrition",
          priority: "high",
          title: t("rec_calories_over_title"),
          description: t("rec_calories_over_desc", { diff: Math.round(calorieDiff), target: calorieTarget }),
          action_text: t("rec_calories_over_action"),
          action_link: "/schedule",
          progress: { value: Math.round(avgCalories), max: calorieTarget, unit: "kcal" },
        });
      }

      if (calorieDiff < -400 && daysLogged >= 3 && goalType === "muscle_gain") {
        recs.push({
          id: "calories-under",
          category: "nutrition",
          priority: "high",
          title: t("rec_calories_under_title"),
          description: t("rec_calories_under_desc", { diff: Math.round(Math.abs(calorieDiff)) }),
          action_text: t("rec_calories_under_action"),
          action_link: "/meals",
          progress: { value: Math.round(avgCalories), max: calorieTarget, unit: "kcal" },
        });
      }

      // ─── Medium Priority ─────────────────────────────────────────────

      if (proteinRatio >= 0.6 && proteinRatio < 0.85 && daysLogged >= 2) {
        recs.push({
          id: "protein-boost",
          category: "nutrition",
          priority: "medium",
          title: t("rec_protein_boost_title"),
          description: t("rec_protein_boost_desc", { avg: Math.round(avgProtein), target: proteinTarget }),
          action_text: t("rec_protein_boost_action"),
          action_link: "/meals?filter=high-protein",
          progress: { value: Math.round(avgProtein), max: proteinTarget, unit: "g" },
        });
      }

      if (avgWater < 5 && waterLogs.length >= 2) {
        recs.push({
          id: "hydration",
          category: "hydration",
          priority: "medium",
          title: t("rec_hydration_title"),
          description: t("rec_hydration_desc", { avg: avgWater.toFixed(1) }),
          action_text: t("rec_hydration_action"),
          action_link: null,
          progress: { value: parseFloat(avgWater.toFixed(1)), max: 8, unit: "glasses" },
        });
      }

      if (consistencyPct < 60 && daysLogged >= 2) {
        recs.push({
          id: "consistency",
          category: "general",
          priority: "medium",
          title: t("rec_consistency_title"),
          description: t("rec_consistency_desc", { pct: consistencyPct }),
          action_text: t("rec_consistency_action"),
          action_link: null,
        });
      }

      if (avgFat > 80 && daysLogged >= 3) {
        recs.push({
          id: "fat-high",
          category: "nutrition",
          priority: "medium",
          title: t("rec_fat_high_title"),
          description: t("rec_fat_high_desc", { avg: Math.round(avgFat) }),
          action_text: t("rec_fat_high_action"),
          action_link: "/meals?filter=low-fat",
          progress: { value: Math.round(avgFat), max: 80, unit: "g" },
        });
      }

      if (avgCarbs > 300 && daysLogged >= 3 && goalType === "weight_loss") {
        recs.push({
          id: "carbs-high",
          category: "nutrition",
          priority: "medium",
          title: t("rec_carbs_high_title"),
          description: t("rec_carbs_high_desc", { avg: Math.round(avgCarbs) }),
          action_text: t("rec_carbs_high_action"),
          action_link: "/meals?filter=low-carb",
          progress: { value: Math.round(avgCarbs), max: 300, unit: "g" },
        });
      }

      // ─── Low Priority ─────────────────────────────────────────────────

      if (currentStreak >= 7) {
        recs.push({
          id: "streak-fire",
          category: "general",
          priority: "low",
          title: t("rec_streak_title", { days: currentStreak }),
          description: bestStreak > currentStreak
            ? t("rec_streak_desc_with_best", { days: currentStreak, best: bestStreak })
            : t("rec_streak_desc_personal_best", { days: currentStreak }),
          action_text: t("rec_streak_action"),
          action_link: "/tracker",
        });
      }

      if (consistencyPct >= 85 && daysLogged >= 5) {
        recs.push({
          id: "great-week",
          category: "general",
          priority: "low",
          title: t("rec_great_week_title"),
          description: t("rec_great_week_desc", { days: daysLogged }),
          action_text: t("rec_great_week_action"),
          action_link: null,
        });
      }

      if (proteinRatio >= 0.9 && daysLogged >= 4) {
        recs.push({
          id: "protein-great",
          category: "nutrition",
          priority: "low",
          title: t("rec_protein_great_title"),
          description: t("rec_protein_great_desc", { pct: Math.round(proteinRatio * 100) }),
          action_text: t("rec_protein_great_action"),
          action_link: "/tracker",
        });
      }

      if (avgWater >= 7) {
        recs.push({
          id: "hydration-great",
          category: "hydration",
          priority: "low",
          title: t("rec_hydration_great_title"),
          description: t("rec_hydration_great_desc", { avg: avgWater.toFixed(1) }),
          action_text: t("rec_hydration_great_action"),
          action_link: null,
        });
      }

      // ─── Fallback if no recs generated ────────────────────────────────
      if (recs.length === 0) {
        recs.push({
          id: "start-tracking",
          category: "general",
          priority: "low",
          title: t("rec_fallback_title"),
          description: t("rec_fallback_desc"),
          action_text: t("rec_fallback_action"),
          action_link: "/dashboard",
        });
      }

      recs.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      setRecommendations(recs.slice(0, 5));
    } catch (error) {
      console.error("Error generating recommendations:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    generateRecommendations();
  }, [generateRecommendations]);

  return {
    recommendations,
    loading,
    refresh: generateRecommendations,
  };
}
