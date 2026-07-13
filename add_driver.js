import { createAdminClient, findAuthUserByEmail } from "./scripts/supabase-admin.mjs";
import { requireEnv } from "./scripts/required-env.mjs";

const supabase = createAdminClient();
const email = requireEnv("TARGET_USER_EMAIL", "E2E_DRIVER_EMAIL");

async function addDriver() {
  const user = await findAuthUserByEmail(supabase, email);
  if (!user) throw new Error(`No auth user found for ${email}`);

  const fullName = process.env.TARGET_USER_NAME?.trim() || "Test Driver";
  const { error: driverError } = await supabase.from("drivers").upsert(
    {
      user_id: user.id,
      email,
      full_name: fullName,
      phone_number: process.env.TARGET_USER_PHONE?.trim() || null,
      vehicle_type: "car",
      license_plate: process.env.TARGET_VEHICLE_PLATE?.trim() || null,
      approval_status: "approved",
      is_active: true,
      is_online: false,
    },
    { onConflict: "user_id" },
  );
  if (driverError) throw driverError;

  const { error: roleError } = await supabase.from("user_roles").upsert(
    { user_id: user.id, role: "driver" },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  console.log(`Driver access configured for ${email}.`);
}

addDriver().catch((error) => {
  console.error("Unable to configure driver:", error.message);
  process.exitCode = 1;
});
