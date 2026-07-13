import { useCallback, useRef, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type BadgeCheckRpcClient = typeof supabase & {
  rpc(
    fn: "check_and_award_badges",
    args: { p_user_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

interface BadgeCheckResult {
  awarded_badges?: unknown;
}

interface BadgeRow {
  id: string;
  name: string;
  description: string;
  xp_reward: number;
}

export interface BadgeUnlockNotice {
  id: string;
  name: string;
  description: string;
  xpReward: number;
}

const badgeRpc = supabase as BadgeCheckRpcClient;

function getAwardedBadgeIds(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];

  const awarded = (data as BadgeCheckResult).awarded_badges;
  if (!Array.isArray(awarded)) return [];

  return awarded.filter((badgeId): badgeId is string => typeof badgeId === "string");
}

export function useBadgeChecker(userId: string | undefined) {
  const checkedUserRef = useRef<string | null>(null);
  const [latestUnlock, setLatestUnlock] = useState<BadgeUnlockNotice | null>(null);

  const checkAndAwardBadges = useCallback(async () => {
    if (!userId || checkedUserRef.current === userId) return;
    checkedUserRef.current = userId;

    try {
      const { data, error } = await badgeRpc.rpc("check_and_award_badges", {
        p_user_id: userId,
      });
      if (error) throw error;

      const awardedBadgeIds = getAwardedBadgeIds(data);
      if (awardedBadgeIds.length === 0) return;

      const { data: badgeRows, error: badgeError } = await supabase
        .from("badges")
        .select("id, name, description, xp_reward")
        .in("id", awardedBadgeIds);
      if (badgeError) throw badgeError;

      const badgesById = new Map(
        ((badgeRows || []) as BadgeRow[]).map((badge) => [badge.id, badge]),
      );

      for (const badgeId of awardedBadgeIds) {
        const badge = badgesById.get(badgeId);
        const notice: BadgeUnlockNotice = {
          id: badgeId,
          name: badge?.name || badgeId,
          description: badge?.description || "",
          xpReward: badge?.xp_reward || 0,
        };

        toast.success(`${notice.name} Unlocked!`, {
          description: `+${notice.xpReward} XP${notice.description ? ` - ${notice.description}` : ""}`,
          duration: 4000,
        });
        setLatestUnlock(notice);
      }
    } catch (error) {
      checkedUserRef.current = null;
      console.error("Badge checker error:", error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void checkAndAwardBadges();
  }, [userId, checkAndAwardBadges]);

  return {
    checkAndAwardBadges,
    latestUnlock,
    dismissLatestUnlock: () => setLatestUnlock(null),
  };
}
