import { Preferences } from "@capacitor/preferences";

import type { OutdoorActivityState } from "@/lib/outdoor-activity";

const CHECKPOINT_PREFIX = "nutrio_outdoor_activity_v1";

function checkpointKey(userId: string) {
  return `${CHECKPOINT_PREFIX}_${userId}`;
}

export async function saveOutdoorCheckpoint(state: OutdoorActivityState): Promise<void> {
  if (state.status === "idle" || state.status === "discarded" || state.status === "completed") return;
  await Preferences.set({ key: checkpointKey(state.userId), value: JSON.stringify(state) });
}

export async function loadOutdoorCheckpoint(userId: string): Promise<OutdoorActivityState | null> {
  const { value } = await Preferences.get({ key: checkpointKey(userId) });
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as OutdoorActivityState;
    if (parsed.version !== 1 || parsed.userId !== userId || !parsed.localSessionId) return null;
    return parsed;
  } catch {
    await clearOutdoorCheckpoint(userId);
    return null;
  }
}

export async function clearOutdoorCheckpoint(userId: string): Promise<void> {
  await Preferences.remove({ key: checkpointKey(userId) });
}
