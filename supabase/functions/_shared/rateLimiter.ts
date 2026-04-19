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
  try {
    const kv = await Deno.openKv();
    if (!kv) return null;

    const key = ["rate_limit", identifier];
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const entry = await kv.get<{
      count: number;
      windowStart: number;
      windowEnd: number;
    }>(key);

    if (!entry.value || entry.value.windowEnd < now) {
      const windowEnd = now + windowMs;
      await kv.set(key, {
        count: 1,
        windowStart: now,
        windowEnd,
      });
      const remaining = limit - 1;
      const resetAt = windowEnd;
      kv.close();
      return { allowed: true, remaining: Math.max(0, remaining), resetAt };
    }

    if (entry.value.count >= limit) {
      const resetAt = entry.value.windowEnd;
      kv.close();
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    const newCount = entry.value.count + 1;
    await kv.set(key, {
      ...entry.value,
      count: newCount,
    });

    const remaining = limit - newCount;
    const resetAt = entry.value.windowEnd;
    kv.close();
    return { allowed: true, remaining: Math.max(0, remaining), resetAt };
  } catch {
    return null;
  }
}

async function checkWithDatabase(
  supabase: any,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult | null> {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);

    const { data: existing, error: fetchError } = await supabase
      .from("rate_limits")
      .select("id, request_count, window_start, window_end")
      .eq("identifier", identifier)
      .gte("window_end", now.toISOString())
      .order("window_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Rate limit DB fetch error:", fetchError.message);
      return null;
    }

    if (existing) {
      if (existing.request_count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(existing.window_end).getTime(),
        };
      }

      const newCount = existing.request_count + 1;
      const { error: updateError } = await supabase
        .from("rate_limits")
        .update({ request_count: newCount })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Rate limit DB update error:", updateError.message);
        return null;
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - newCount),
        resetAt: new Date(existing.window_end).getTime(),
      };
    }

    const { error: insertError } = await supabase
      .from("rate_limits")
      .insert({
        identifier,
        request_count: 1,
        window_start: now.toISOString(),
        window_end: windowEnd.toISOString(),
      });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: retryExisting } = await supabase
          .from("rate_limits")
          .select("id, request_count, window_end")
          .eq("identifier", identifier)
          .gte("window_end", now.toISOString())
          .limit(1)
          .maybeSingle();

        if (retryExisting && retryExisting.request_count < limit) {
          const newCount = retryExisting.request_count + 1;
          await supabase
            .from("rate_limits")
            .update({ request_count: newCount })
            .eq("id", retryExisting.id);

          return {
            allowed: true,
            remaining: Math.max(0, limit - newCount),
            resetAt: new Date(retryExisting.window_end).getTime(),
          };
        }
      }
      console.error("Rate limit DB insert error:", insertError.message);
      return null;
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      resetAt: windowEnd.getTime(),
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
  supabase: any,
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