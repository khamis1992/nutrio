import { existsSync, readFileSync } from "node:fs";

function readLocalEnv() {
  const env = {};
  if (!existsSync(".env.local")) return env;

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }

  return env;
}

const localEnv = readLocalEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  localEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  localEnv.VITE_SUPABASE_ANON_KEY;
const adminEmail = process.env.NUTRIO_ADMIN_EMAIL;
const adminPassword = process.env.NUTRIO_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or publishable key.");
}

if (!adminEmail || !adminPassword) {
  throw new Error("Missing NUTRIO_ADMIN_EMAIL or NUTRIO_ADMIN_PASSWORD.");
}

const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: supabaseKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: adminEmail,
    password: adminPassword,
  }),
});

const authText = await authResponse.text();
console.log("auth_status", authResponse.status);

if (!authResponse.ok) {
  console.log(authText.slice(0, 300));
  process.exit(1);
}

const session = JSON.parse(authText);
const bearer = session.access_token;

const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/platform_settings?on_conflict=key`, {
  method: "POST",
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({
    key: "phase1-health-context",
    value: { enabled: true, rollout_percent: 100 },
    description: "Optional private health journal and manually logged cycle context",
  }),
});

const upsertText = await upsertResponse.text();
console.log("upsert_status", upsertResponse.status);
console.log(upsertText.slice(0, 500));

if (!upsertResponse.ok) process.exit(1);

const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/platform_settings?key=eq.phase1-health-context&select=key,value`, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${bearer}`,
  },
});

const verifyText = await verifyResponse.text();
console.log("verify_status", verifyResponse.status);
console.log(verifyText.slice(0, 500));

if (!verifyResponse.ok) process.exit(1);
