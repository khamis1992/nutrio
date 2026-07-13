import { createAdminClient, findAuthUserByEmail } from "./scripts/supabase-admin.mjs";
import { requireEnv } from "./scripts/required-env.mjs";

const supabase = createAdminClient();
const email = requireEnv("TARGET_USER_EMAIL", "E2E_DRIVER_EMAIL");

async function checkDriver() {
  const user = await findAuthUserByEmail(supabase, email);
  if (!user) throw new Error(`No auth user found for ${email}`);

  const { data: driver, error: driverError } = await supabase
    .from("drivers")
    .select("id, approval_status, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (driverError) throw driverError;

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "driver")
    .maybeSingle();
  if (roleError) throw roleError;

  console.log({
    authUser: true,
    driverRecord: Boolean(driver),
    driverRole: Boolean(role),
    approvalStatus: driver?.approval_status ?? null,
    active: driver?.is_active ?? null,
  });
}

checkDriver().catch((error) => {
  console.error("Unable to check driver:", error.message);
  process.exitCode = 1;
});
