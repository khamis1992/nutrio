import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BADGE_REGISTRY, type UserBadge } from "@/lib/badges";

export function useBadges(userId: string | undefined) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data: unlockedRows, error } = await supabase
        .from("user_badges")
        .select("badge_id, unlocked_at")
        .eq("user_id", userId);

      if (error) throw error;

      const unlockedMap = new Map<string, string | null>();
      for (const row of unlockedRows ?? []) {
        unlockedMap.set(row.badge_id, row.unlocked_at);
      }

      const enriched: UserBadge[] = BADGE_REGISTRY.map((meta) => ({
        ...meta,
        unlocked: unlockedMap.has(meta.id),
        unlockedAt: unlockedMap.get(meta.id) ?? null,
      }));

      setBadges(enriched);
    } catch (err) {
      console.error("useBadges fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchBadges();
  }, [fetchBadges]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalCount = badges.length;

  return { badges, loading, refresh: fetchBadges, unlockedCount, totalCount };
}
