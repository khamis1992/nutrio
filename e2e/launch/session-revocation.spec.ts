import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loadEnv } from "vite";

import { getTestUser, type TestRole } from "../config";

const roles: TestRole[] = ["customer", "admin", "partner", "driver", "fleet", "coach"];
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_ANON_KEY;

test("revokes every dedicated launch-test account session", async () => {
  expect(supabaseUrl, "VITE_SUPABASE_URL is required for session teardown").toBeTruthy();
  expect(
    supabasePublishableKey,
    "VITE_SUPABASE_PUBLISHABLE_KEY is required for session teardown",
  ).toBeTruthy();

  const failures: string[] = [];

  for (const role of roles) {
    const client = createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const credentials = getTestUser(role);
    const { error: signInError } = await client.auth.signInWithPassword(credentials);

    if (signInError) {
      failures.push(`${role}: sign-in failed`);
      continue;
    }

    const { error: signOutError } = await client.auth.signOut({ scope: "global" });
    if (signOutError) {
      failures.push(`${role}: global sign-out failed`);
    }
  }

  expect(failures, `Dedicated session teardown failed: ${failures.join(", ")}`).toEqual([]);
});
