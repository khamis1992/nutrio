import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "./scripts/required-env.mjs";

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

async function checkAuthConnection() {
  const { error } = await supabase.auth.getSession();
  if (error) throw error;
  console.log("Supabase Auth is reachable.");
}

checkAuthConnection().catch((error) => {
  console.error("Unable to reach Supabase Auth:", error.message);
  process.exitCode = 1;
});
