const STORAGE_KEY = "nutrio:offline-mutations:v1";
const MAX_QUEUE_SIZE = 100;
const MAX_ITEM_BYTES = 64 * 1024;
const MAX_ATTEMPTS = 10;
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

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

function isValidMutation(value: unknown): value is OfflineMutation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<OfflineMutation>;
  if (
    typeof item.id !== "string" || item.id.length < 1 || item.id.length > 160 ||
    (item.kind !== "meal-log" && item.kind !== "schedule-meals") ||
    typeof item.userId !== "string" || item.userId.length < 1 || item.userId.length > 160 ||
    typeof item.createdAt !== "string" ||
    !Number.isSafeInteger(item.attempts) || Number(item.attempts) < 0 ||
    Number(item.attempts) > MAX_ATTEMPTS
  ) {
    return false;
  }
  const createdAt = Date.parse(item.createdAt);
  if (!Number.isFinite(createdAt) || createdAt < Date.now() - QUEUE_TTL_MS) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(item.payload)).byteLength <= MAX_ITEM_BYTES;
  } catch {
    return false;
  }
}

export function readOfflineMutations(): OfflineMutation[] {
  if (!storageAvailable()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isValidMutation) : [];
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
  let payloadBytes = Number.POSITIVE_INFINITY;
  try {
    payloadBytes = new TextEncoder().encode(JSON.stringify(mutation.payload)).byteLength;
  } catch {
    throw new Error("OFFLINE_PAYLOAD_INVALID");
  }
  if (payloadBytes > MAX_ITEM_BYTES) throw new Error("OFFLINE_PAYLOAD_TOO_LARGE");

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
        attempts: Math.min(MAX_ATTEMPTS, mutation.attempts + 1),
        lastError: "SYNC_FAILED",
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
