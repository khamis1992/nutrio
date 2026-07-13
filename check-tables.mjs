import { createAdminClient } from "./scripts/supabase-admin.mjs";

const supabase = createAdminClient();
const tables = [
  "user_roles",
  "profiles",
  "restaurants",
  "drivers",
  "fleet_managers",
  "meal_schedules",
  "delivery_jobs",
  "subscriptions",
];

async function checkTables() {
  let failed = false;

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*", {
      count: "exact",
      head: true,
    });
    if (error) {
      failed = true;
      console.error(`${table}: ${error.message}`);
    } else {
      console.log(`${table}: available`);
    }
  }

  if (failed) process.exitCode = 1;
}

checkTables().catch((error) => {
  console.error("Unable to check database tables:", error.message);
  process.exitCode = 1;
});
