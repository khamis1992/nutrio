import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const inMemoryStore = new Map<
  string,
  { count: number; windowStart: number; windowEnd: number }
>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupMemory(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of inMemoryStore) {
    if (entry.windowEnd < now) {
      inMemoryStore.delete(key);
    }
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

async function checkWithDenoKv(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult | null> {
  let kv: Deno.Kv | null = null;

  try {
    kv = await Deno.openKv();
    if (!kv) return null;

    const key = ["rate_limit", identifier];
    const windowMs = windowSeconds * 1000;

    // Optimistic atomic checks prevent concurrent requests from overwriting
    // each other's counters and bypassing the configured limit.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = Date.now();
      const entry = await kv.get<{
        count: number;
        windowStart: number;
        windowEnd: number;
      }>(key);

      if (!entry.value || entry.value.windowEnd <= now) {
        const windowEnd = now + windowMs;
        const committed = await kv.atomic()
          .check(entry)
          .set(key, { count: 1, windowStart: now, windowEnd })
          .commit();

        if (!committed.ok) continue;
        return {
          allowed: true,
          remaining: Math.max(0, limit - 1),
          resetAt: windowEnd,
        };
      }

      if (entry.value.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: entry.value.windowEnd,
        };
      }

      const newCount = entry.value.count + 1;
      const committed = await kv.atomic()
        .check(entry)
        .set(key, { ...entry.value, count: newCount })
        .commit();

      if (!committed.ok) continue;
      return {
        allowed: true,
        remaining: Math.max(0, limit - newCount),
        resetAt: entry.value.windowEnd,
      };
    }

    return null;
  } catch {
    return null;
  } finally {
    kv?.close();
  }
}

async function checkWithDatabase(
  supabase: SupabaseClient,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult | null> {
  try {
    const { data, error } = await supabase.rpc("consume_security_rate_limit", {
      p_identifier: identifier,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error("Atomic rate limit RPC error:", error.message);
      return null;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const result = data as Record<string, unknown>;
    return {
      allowed: result.allowed === true,
      remaining: Math.max(0, Number(result.remaining) || 0),
      resetAt: Number(result.reset_at) || Date.now() + windowSeconds * 1000,
    };
  } catch (err) {
    console.error("Rate limit DB error:", err);
    return null;
  }
}

function checkWithMemory(
  identifier: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  cleanupMemory();

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = inMemoryStore.get(identifier);

  if (!entry || entry.windowEnd < now) {
    const windowEnd = now + windowMs;
    inMemoryStore.set(identifier, {
      count: 1,
      windowStart: now,
      windowEnd,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: windowEnd,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowEnd,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.windowEnd,
  };
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  // Try Deno KV first (best performance, no DB round-trip)
  const kvResult = await checkWithDenoKv(identifier, limit, windowSeconds);
  if (kvResult) return kvResult;

  // Fall back to database
  const dbResult = await checkWithDatabase(
    supabase,
    identifier,
    limit,
    windowSeconds,
  );
  if (dbResult) return dbResult;

  // Last resort: in-memory (per-instance, resets on deploy)
  return checkWithMemory(identifier, limit, windowSeconds);
}
