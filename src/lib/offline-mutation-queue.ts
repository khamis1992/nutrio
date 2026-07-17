const STORAGE_KEY = "nutrio:offline-mutations:v1";
const MAX_QUEUE_SIZE = 100;

export type OfflineMutationKind = "meal-log" | "schedule-meals";

export interface OfflineMutation<T = unknown> {
  id: string;
  kind: OfflineMutationKind;
  userId: string;
  payload: T;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const storageAvailable = () => typeof localStorage !== "undefined";

export function readOfflineMutations(): OfflineMutation[] {
  if (!storageAvailable()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineMutations(items: OfflineMutation[]) {
  if (!storageAvailable()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_QUEUE_SIZE)));
}

export function enqueueOfflineMutation<T>(
  mutation: Omit<OfflineMutation<T>, "createdAt" | "attempts">,
): OfflineMutation<T> {
  const queue = readOfflineMutations();
  const existing = queue.find((item) => item.id === mutation.id);
  if (existing) return existing as OfflineMutation<T>;

  const queued: OfflineMutation<T> = {
    ...mutation,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  writeOfflineMutations([...queue, queued]);
  return queued;
}

export function removeOfflineMutation(id: string) {
  writeOfflineMutations(readOfflineMutations().filter((item) => item.id !== id));
}

export function clearOfflineMutationsForUser(userId: string) {
  writeOfflineMutations(readOfflineMutations().filter((item) => item.userId !== userId));
}

export async function flushOfflineMutations(
  userId: string,
  handlers: Partial<Record<OfflineMutationKind, (mutation: OfflineMutation) => Promise<void>>>,
): Promise<{ synced: number; remaining: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { synced: 0, remaining: readOfflineMutations().filter((item) => item.userId === userId).length };
  }

  const queue = readOfflineMutations();
  let synced = 0;
  const next: OfflineMutation[] = [];

  for (const mutation of queue) {
    if (mutation.userId !== userId || !handlers[mutation.kind]) {
      next.push(mutation);
      continue;
    }

    try {
      await handlers[mutation.kind]?.(mutation);
      synced += 1;
    } catch (error) {
      next.push({
        ...mutation,
        attempts: mutation.attempts + 1,
        lastError: error instanceof Error ? error.message : "SYNC_FAILED",
      });
    }
  }

  writeOfflineMutations(next);
  return { synced, remaining: next.filter((item) => item.userId === userId).length };
}

export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|offline|connection|timeout/i.test(message);
}
