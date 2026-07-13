import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "./scripts/required-env.mjs";

async function testIpCheck() {
  const anonKey = getSupabaseAnonKey();
  const response = await fetch(
    `${getSupabaseUrl()}/functions/v1/check-ip-location`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`IP check returned HTTP ${response.status}`);
  }

  console.log(await response.json());
}

testIpCheck().catch((error) => {
  console.error("IP check failed:", error.message);
  process.exitCode = 1;
});
