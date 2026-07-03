import { supabase } from "@/integrations/supabase/client";

export async function syncCommunityChallengeProgress(userId: string) {
  if (!userId) return null;

  const { data, error } = await (supabase as typeof supabase & {
    rpc(fn: "sync_my_community_challenges"): Promise<{ data: unknown; error: Error | null }>;
  }).rpc("sync_my_community_challenges");
  if (error) throw error;
  return data;
}

export async function syncCommunityChallengeProgressQuietly(userId: string) {
  try {
    await syncCommunityChallengeProgress(userId);
  } catch (error) {
    console.warn("Failed to sync community challenge progress:", error);
  }
}
