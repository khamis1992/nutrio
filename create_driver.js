import { createAdminClient, findAuthUserByEmail } from "./scripts/supabase-admin.mjs";
import { requireEnv } from "./scripts/required-env.mjs";

const supabase = createAdminClient();
const email = requireEnv("E2E_DRIVER_EMAIL", "TARGET_USER_EMAIL");
const password = requireEnv("E2E_DRIVER_PASSWORD", "TARGET_USER_PASSWORD");

async function createDriver() {
  if (password.length < 8) {
    throw new Error("Driver password must contain at least 8 characters");
  }

  let user = await findAuthUserByEmail(supabase, email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Test Driver" },
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: process.env.TARGET_USER_NAME?.trim() || "Test Driver",
  });
  if (profileError) throw profileError;

  process.env.TARGET_USER_EMAIL = email;
  await import("./add_driver.js");
}

createDriver().catch((error) => {
  console.error("Unable to create driver:", error.message);
  process.exitCode = 1;
});
