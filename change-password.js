import { createAdminClient, findAuthUserByEmail } from "./scripts/supabase-admin.mjs";
import { requireEnv } from "./scripts/required-env.mjs";

const supabase = createAdminClient();
const email = requireEnv("TARGET_USER_EMAIL");
const password = requireEnv("TARGET_USER_PASSWORD");

async function changeUserPassword() {
  if (password.length < 8) {
    throw new Error("TARGET_USER_PASSWORD must contain at least 8 characters");
  }

  const user = await findAuthUserByEmail(supabase, email);
  if (!user) throw new Error(`No auth user found for ${email}`);

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });
  if (error) throw error;

  console.log(`Password updated for ${email}.`);
}

changeUserPassword().catch((error) => {
  console.error("Unable to update password:", error.message);
  process.exitCode = 1;
});
