import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { PlatePair } from "@/lib/strength-training";

export interface WorkoutEquipmentProfile {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  bar_weight_kg: number;
  plate_pairs: PlatePair[];
  equipment: string[];
  created_at: string;
  updated_at: string;
}

export const DEFAULT_PLATE_PAIRS: PlatePair[] = [
  { weightKg: 20, count: 1 },
  { weightKg: 15, count: 1 },
  { weightKg: 10, count: 1 },
  { weightKg: 5, count: 1 },
  { weightKg: 2.5, count: 1 },
  { weightKg: 1.25, count: 1 },
];

const fallbackProfile: WorkoutEquipmentProfile = {
  id: "default-gym",
  user_id: "",
  name: "Standard gym",
  is_default: true,
  bar_weight_kg: 20,
  plate_pairs: DEFAULT_PLATE_PAIRS,
  equipment: ["barbell", "dumbbell", "body weight", "cable", "machine"],
  created_at: "",
  updated_at: "",
};

function normalizeProfile(row: Omit<WorkoutEquipmentProfile, "bar_weight_kg" | "plate_pairs"> & {
  bar_weight_kg: number | string;
  plate_pairs: unknown;
}): WorkoutEquipmentProfile {
  const platePairs = Array.isArray(row.plate_pairs)
    ? row.plate_pairs.filter((item): item is PlatePair => {
      if (!item || typeof item !== "object") return false;
      const value = item as { weightKg?: unknown; count?: unknown };
      return typeof value.weightKg === "number" && typeof value.count === "number";
    })
    : DEFAULT_PLATE_PAIRS;
  return {
    ...row,
    bar_weight_kg: Number(row.bar_weight_kg),
    plate_pairs: platePairs.length > 0 ? platePairs : DEFAULT_PLATE_PAIRS,
  };
}

export function useWorkoutEquipmentProfiles(enabled = true) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<WorkoutEquipmentProfile[]>([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled || !user?.id) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("workout_equipment_profiles" as "profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Unable to load workout equipment profiles:", error);
      setProfiles([]);
    } else {
      setProfiles((data ?? []).map((row) => normalizeProfile(row as unknown as Parameters<typeof normalizeProfile>[0])));
    }
    setLoading(false);
  }, [enabled, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProfile = useCallback(async (input: {
    id?: string;
    name: string;
    barWeightKg: number;
    platePairs: PlatePair[];
    equipment: string[];
    makeDefault?: boolean;
  }) => {
    if (!user?.id) throw new Error("Sign in to save equipment");
    if (input.makeDefault) {
      const { error: resetError } = await supabase
        .from("workout_equipment_profiles" as "profiles")
        .update({ is_default: false } as never)
        .eq("user_id", user.id);
      if (resetError) throw resetError;
    }
    const payload = {
      user_id: user.id,
      name: input.name.trim(),
      bar_weight_kg: input.barWeightKg,
      plate_pairs: input.platePairs,
      equipment: input.equipment,
      is_default: input.makeDefault ?? profiles.length === 0,
    };
    const query = input.id && input.id !== fallbackProfile.id
      ? supabase.from("workout_equipment_profiles" as "profiles").update(payload as never).eq("id", input.id)
      : supabase.from("workout_equipment_profiles" as "profiles").insert(payload as never);
    const { error } = await query;
    if (error) throw error;
    await refresh();
  }, [profiles.length, refresh, user?.id]);

  const availableProfiles = useMemo(
    () => profiles.length > 0 ? profiles : [{ ...fallbackProfile, user_id: user?.id ?? "" }],
    [profiles, user?.id],
  );
  const defaultProfile = useMemo(
    () => availableProfiles.find((profile) => profile.is_default) ?? availableProfiles[0],
    [availableProfiles],
  );

  return useMemo(() => ({
    profiles: availableProfiles,
    defaultProfile,
    loading,
    saveProfile,
    refresh,
  }), [availableProfiles, defaultProfile, loading, refresh, saveProfile]);
}
