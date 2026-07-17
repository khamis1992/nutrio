function readNamedKey(
  mapEnvironmentName: "SUPABASE_SECRET_KEYS" | "SUPABASE_PUBLISHABLE_KEYS",
  nameEnvironmentName:
    | "NUTRIO_SUPABASE_SECRET_KEY_NAME"
    | "NUTRIO_SUPABASE_PUBLISHABLE_KEY_NAME",
): string | null {
  const raw = Deno.env.get(mapEnvironmentName)?.trim();
  if (!raw) return null;

  let keys: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid_key_map");
    }
    keys = parsed as Record<string, unknown>;
  } catch {
    throw new Error("SUPABASE_KEY_MAP_INVALID");
  }

  const keyName = Deno.env.get(nameEnvironmentName)?.trim() || "default";
  const key = keys[keyName];
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("SUPABASE_NAMED_KEY_NOT_FOUND");
  }
  return key.trim();
}

export function getSupabaseSecretKey(): string {
  const key = readNamedKey(
    "SUPABASE_SECRET_KEYS",
    "NUTRIO_SUPABASE_SECRET_KEY_NAME",
  ) ||
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!key) throw new Error("SUPABASE_ADMIN_KEY_NOT_CONFIGURED");
  return key;
}

export function getSupabasePublishableKey(): string {
  const key = readNamedKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "NUTRIO_SUPABASE_PUBLISHABLE_KEY_NAME",
  ) || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY_NOT_CONFIGURED");
  return key;
}
