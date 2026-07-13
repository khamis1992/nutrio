import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymentId = process.env.PAYMENT_LOAD_PAYMENT_ID;
const transactionId = process.env.PAYMENT_LOAD_TRANSACTION_ID;
const enabled = process.env.RUN_PAYMENT_LOAD_TESTS === "true"
  && Boolean(supabaseUrl && serviceRoleKey && paymentId && transactionId);

/**
 * Opt-in staging test. PAYMENT_LOAD_PAYMENT_ID must reference a pending,
 * server-priced wallet payment created for this test. Never run against a
 * customer's payment or production wallet.
 */
describe.skipIf(!enabled)("verified SADAD payment concurrency", () => {
  it("fulfills one provider transaction exactly once under 50 concurrent callbacks", async () => {
    const client = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const startedAt = performance.now();
    const responses = await Promise.all(
      Array.from({ length: 50 }, () => client.rpc(
        "finalize_verified_sadad_payment",
        {
          p_payment_id: paymentId!,
          p_provider_transaction_id: transactionId!,
          p_gateway_response: { source: "staging_load_test" },
        },
      )),
    );
    const elapsedMs = performance.now() - startedAt;

    const errors = responses.flatMap((response) => response.error ? [response.error.message] : []);
    const results = responses.flatMap((response) => response.data ? [response.data as {
      success?: boolean;
      already_processed?: boolean;
    }] : []);

    expect(errors).toEqual([]);
    expect(results).toHaveLength(50);
    expect(results.every((result) => result.success)).toBe(true);
    expect(results.filter((result) => result.already_processed).length).toBeGreaterThanOrEqual(49);
    expect(elapsedMs).toBeLessThan(10_000);
  }, 30_000);
});
