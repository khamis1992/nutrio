import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "./scripts/required-env.mjs";

const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

async function testConnection() {
  const { error } = await supabase
    .from("profiles")
    .select("user_id", { head: true })
    .limit(1);
  if (error) throw error;
  console.log("Supabase REST API is reachable.");
}

testConnection().catch((error) => {
  console.error("Supabase connection failed:", error.message);
  process.exitCode = 1;
});
