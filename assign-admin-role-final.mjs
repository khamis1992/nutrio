import { createAdminClient, findAuthUserByEmail } from "./scripts/supabase-admin.mjs";
import { requireEnv } from "./scripts/required-env.mjs";

const supabase = createAdminClient();
const email = requireEnv("TARGET_USER_EMAIL");

async function assignAdminRole() {
  const user = await findAuthUserByEmail(supabase, email);
  if (!user) throw new Error(`No auth user found for ${email}`);

  const { error } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: user.id, role: "admin" },
      { onConflict: "user_id,role" },
    );
  if (error) throw error;

  console.log(`Admin role assigned to ${email}.`);
}

assignAdminRole().catch((error) => {
  console.error("Unable to assign admin role:", error.message);
  process.exitCode = 1;
});
