import { supabase } from "@/integrations/supabase/client";
import { disconnectGoogleFit } from "@/lib/google-fit-workout-service";
import type { HealthPlatform } from "@/lib/healthKit";

type WearableRevokeResult = {
  ok?: boolean;
  revoked_samples?: number;
};

export async function disconnectWearableProvider(platform: HealthPlatform): Promise<WearableRevokeResult> {
  if (platform === "none") {
    throw new Error("No health provider is connected.");
  }

  if (platform === "google_fit") {
    const credentialsRemoved = await disconnectGoogleFit();
    if (!credentialsRemoved) {
      throw new Error("Google Fit credentials could not be revoked.");
    }
  }

  const { data, error } = await supabase.rpc("revoke_wearable_provider", {
    p_provider: platform,
  });

  if (error) throw error;

  const result = (data ?? {}) as WearableRevokeResult;
  if (result.ok === false) {
    throw new Error("Wearable data could not be revoked.");
  }

  return result;
}
