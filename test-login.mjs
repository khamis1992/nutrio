import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  requireEnv,
} from "./scripts/required-env.mjs";

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
const email = requireEnv("E2E_CUSTOMER_EMAIL");
const password = requireEnv("E2E_CUSTOMER_PASSWORD");

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;

  console.log(`Login succeeded for user ${data.user.id}.`);
  await supabase.auth.signOut();
}

testLogin().catch((error) => {
  console.error("Login test failed:", error.message);
  process.exitCode = 1;
});
