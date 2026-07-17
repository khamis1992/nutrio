export function requireEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

function getNamedKey(mapName, nameEnvironmentName) {
  const raw = process.env[mapName]?.trim();
  if (!raw) return null;

  let keys;
  try {
    keys = JSON.parse(raw);
  } catch {
    throw new Error(`${mapName} must contain a JSON object`);
  }

  const keyName = process.env[nameEnvironmentName]?.trim() || "default";
  const key = keys?.[keyName];
  if (typeof key !== "string" || !key.trim()) {
    throw new Error(`${mapName} does not contain the configured key name`);
  }
  return key.trim();
}

export function getSupabaseUrl() {
  return requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getNamedKey(
    "SUPABASE_PUBLISHABLE_KEYS",
    "NUTRIO_SUPABASE_PUBLISHABLE_KEY_NAME",
  ) || requireEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  );
}

export function getSupabaseServiceRoleKey() {
  return getNamedKey(
    "SUPABASE_SECRET_KEYS",
    "NUTRIO_SUPABASE_SECRET_KEY_NAME",
  ) || requireEnv(
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
}
