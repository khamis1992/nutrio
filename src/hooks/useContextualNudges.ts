import { useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useHealthTrackingGoals } from "@/hooks/useHealthTrackingGoals";
import { getQatarDay, getQatarNow } from "@/lib/dateUtils";
import { isNative, localNotifications } from "@/lib/capacitor";

type NudgeKind = "hydration" | "meal_timing";

interface NudgeCandidate {
  kind: NudgeKind;
  title: string;
  message: string;
  route: string;
  scheduledFor: Date;
  notificationType: "health_insight" | "meal_reminder";
  relatedEntityId?: string;
  relatedEntityType?: string;
}

interface MealScheduleNudgeRow {
  id: string;
  meal_type: string;
  scheduled_date: string;
  delivery_time_slot: string | null;
  order_status: string | null;
  meals?: { name: string | null } | null;
}

const CONTEXTUAL_NUDGES_PREF_KEY = "contextual_nudges";
const MIN_LOCAL_DELAY_MS = 60 * 1000;
const processedKeys = new Set<string>();

const toPreferenceRecord = (preferences: unknown): Record<string, unknown> => {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return {};
  return preferences as Record<string, unknown>;
};

const getContextualNudgesEnabled = (preferences: unknown) => {
  const record = toPreferenceRecord(preferences);
  if (typeof record[CONTEXTUAL_NUDGES_PREF_KEY] === "boolean") {
    return record[CONTEXTUAL_NUDGES_PREF_KEY] as boolean;
  }
  if (typeof record.push_notifications === "boolean") {
    return record.push_notifications as boolean;
  }
  const pushPrefs = toPreferenceRecord(record.push);
  if (typeof pushPrefs.enabled === "boolean") {
    return pushPrefs.enabled as boolean;
  }
  return true;
};

const stableNotificationId = (key: string) => {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return 700_000 + Math.abs(hash % 200_000);
};

const parseTimeSlot = (timeSlot: string | null, dayKey: string) => {
  if (!timeSlot) return null;
  const match = timeSlot.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const date = new Date(`${dayKey}T00:00:00+03:00`);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const mealTypeLabel = (mealType: string) => {
  const normalized = mealType.toLowerCase();
  if (normalized.includes("breakfast")) return "breakfast";
  if (normalized.includes("dinner")) return "dinner";
  if (normalized.includes("snack")) return "snack";
  return "lunch";
};

async function createNudgeNotification(userId: string, candidate: NudgeCandidate, dedupeKey: string) {
  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", candidate.notificationType)
    .eq("data->>dedupe_key", dedupeKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return false;

  const metadata: Json = {
    subtype: "contextual_nudge",
    kind: candidate.kind,
    dedupe_key: dedupeKey,
    route: candidate.route,
    scheduled_for: candidate.scheduledFor.toISOString(),
  };

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: candidate.notificationType,
    title: candidate.title,
    message: candidate.message,
    status: "unread",
    scheduled_for: candidate.scheduledFor.toISOString(),
    related_entity_id: candidate.relatedEntityId ?? null,
    related_entity_type: candidate.relatedEntityType ?? null,
    data: metadata,
  });

  if (error) throw error;
  return true;
}

async function scheduleLocalNudge(candidate: NudgeCandidate, dedupeKey: string) {
  if (!isNative) return;

  const permission = await localNotifications.checkPermissions();
  if (permission.display !== "granted") {
    const requested = await localNotifications.requestPermissions();
    if (requested.display !== "granted") return;
  }

  const now = new Date();
  const scheduleAt = candidate.scheduledFor.getTime() - now.getTime() < MIN_LOCAL_DELAY_MS
    ? new Date(now.getTime() + MIN_LOCAL_DELAY_MS)
    : candidate.scheduledFor;

  await localNotifications.schedule([{
    id: stableNotificationId(dedupeKey),
    title: candidate.title,
    body: candidate.message,
    scheduleAt,
  }]);
}

export function useContextualNudges() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { goals, loading: goalsLoading } = useHealthTrackingGoals(user?.id);
  const lastRunKey = useRef<string | null>(null);

  const enabled = useMemo(
    () => Boolean(user?.id && !profileLoading && !goalsLoading && getContextualNudgesEnabled(profile?.notification_preferences)),
    [goalsLoading, profile?.notification_preferences, profileLoading, user?.id]
  );

  useEffect(() => {
    if (!user?.id || !enabled) return;

    const run = async () => {
      const todayKey = getQatarDay();
      const now = getQatarNow();
      const runKey = `${user.id}:${todayKey}:${now.getHours()}`;
      if (lastRunKey.current === runKey) return;
      lastRunKey.current = runKey;

      try {
        const [{ data: waterRows, error: waterError }, { data: mealRows, error: mealError }] = await Promise.all([
          supabase
            .from("water_entries")
            .select("amount_ml")
            .eq("user_id", user.id)
            .eq("log_date", todayKey),
          supabase
            .from("meal_schedules")
            .select("id, meal_type, scheduled_date, delivery_time_slot, order_status, meals:meals!meal_schedules_meal_id_fkey(name)")
            .eq("user_id", user.id)
            .eq("scheduled_date", todayKey)
            .neq("order_status", "cancelled")
            .order("delivery_time_slot", { ascending: true }),
        ]);

        if (waterError) throw waterError;
        if (mealError) throw mealError;

        const candidates: NudgeCandidate[] = [];
        const waterLogged = (waterRows ?? []).reduce((sum, row) => sum + Number(row.amount_ml ?? 0), 0);
        const waterPct = goals.waterGoalMl > 0 ? (waterLogged / goals.waterGoalMl) * 100 : 0;
        const hour = now.getHours();

        if (hour >= 13 && hour <= 20 && waterPct < (hour >= 18 ? 70 : 45)) {
          const target = new Date(now.getTime() + 12 * 60 * 1000);
          candidates.push({
            kind: "hydration",
            title: "Hydration check",
            message: `You are at ${Math.round(waterPct)}% of your water goal. Log a glass now to stay on track.`,
            route: "/water-tracker",
            scheduledFor: target,
            notificationType: "health_insight",
          });
        }

        const upcomingMeal = ((mealRows ?? []) as MealScheduleNudgeRow[])
          .map((meal) => ({ meal, mealTime: parseTimeSlot(meal.delivery_time_slot, todayKey) }))
          .filter(({ mealTime }) => mealTime && mealTime.getTime() > now.getTime())
          .sort((a, b) => (a.mealTime?.getTime() ?? 0) - (b.mealTime?.getTime() ?? 0))[0];

        if (upcomingMeal?.mealTime) {
          const scheduledFor = new Date(upcomingMeal.mealTime.getTime() - 30 * 60 * 1000);
          if (scheduledFor.getTime() > now.getTime()) {
            const mealLabel = mealTypeLabel(upcomingMeal.meal.meal_type);
            const mealName = upcomingMeal.meal.meals?.name || `your ${mealLabel}`;
            candidates.push({
              kind: "meal_timing",
              title: `${mealLabel[0].toUpperCase()}${mealLabel.slice(1)} is coming up`,
              message: `${mealName} is scheduled soon. Review timing or swap it if your day changed.`,
              route: "/schedule",
              scheduledFor,
              notificationType: "meal_reminder",
              relatedEntityId: upcomingMeal.meal.id,
              relatedEntityType: "meal_schedule",
            });
          }
        }

        for (const candidate of candidates) {
          const dedupeKey = `contextual-nudge:${user.id}:${todayKey}:${candidate.kind}:${candidate.relatedEntityId ?? "daily"}`;
          if (processedKeys.has(dedupeKey)) continue;
          processedKeys.add(dedupeKey);

          try {
            const created = await createNudgeNotification(user.id, candidate, dedupeKey);
            if (created) await scheduleLocalNudge(candidate, dedupeKey);
          } catch (error) {
            processedKeys.delete(dedupeKey);
            console.error("Failed to create contextual nudge", error);
          }
        }
      } catch (error) {
        console.error("useContextualNudges error:", error);
      }
    };

    run();
    const intervalId = window.setInterval(run, 15 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [enabled, goals.waterGoalMl, user?.id]);
}
