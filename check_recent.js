import { createAdminClient } from "./scripts/supabase-admin.mjs";

const supabase = createAdminClient();

async function checkRecentRecords() {
  for (const [table, columns] of [
    ["profiles", "user_id, full_name, created_at"],
    ["drivers", "user_id, full_name, created_at"],
    ["user_roles", "user_id, role, created_at"],
  ]) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    console.log(table, data);
  }
}

checkRecentRecords().catch((error) => {
  console.error("Unable to query recent records:", error.message);
  process.exitCode = 1;
});
