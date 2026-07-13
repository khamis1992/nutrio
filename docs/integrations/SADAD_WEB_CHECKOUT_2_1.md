# SADAD Web Checkout 2.1

Nutrio uses the hosted SADAD Web Checkout flow. Prices are resolved from
Supabase by `prepare_sadad_payment`; the browser never supplies the amount that
is ultimately charged or credited.

## Required Supabase secrets

Configure these secrets on the production Supabase project:

```text
SADAD_MERCHANT_ID=<merchant MID>
SADAD_SECRET_KEY=<rotated live secret key>
SADAD_WEBSITE=<website identifier registered with SADAD>
SADAD_CALLBACK_URL=https://<project-ref>.supabase.co/functions/v1/sadad-payment?source=callback
APP_URL=https://<customer-app-host>/<optional-base-path>
ALLOWED_ORIGINS=https://<customer-app-host>
```

`SADAD_CALLBACK_URL` must be publicly reachable. `APP_URL` may include the
application base path, for example `/nutrio`.

Do not configure `VITE_SADAD_*` values. A Vite-prefixed secret is embedded in
the browser bundle and must be treated as compromised.

## Merchant panel

Configure the webhook URL in the SADAD Merchant Panel:

```text
https://<project-ref>.supabase.co/functions/v1/sadad-payment?source=webhook
```

The callback is form encoded and the webhook is JSON. Both are verified using
the SADAD checksum before any payment is fulfilled. Webhook handling is
idempotent by payment ID and provider transaction number.

## Database and function deployment

Apply these migrations before deploying the function:

1. `20260712131000_secure_sadad_payment_lifecycle.sql`
2. `20260712132000_secure_subscription_wallet_actions.sql`

Then deploy `sadad-payment`. Its `verify_jwt` setting is intentionally disabled
at the platform gateway because SADAD does not send a Supabase JWT. The function
manually requires a valid customer JWT for `create` and `status`, and accepts
provider requests only after checksum validation.

## Launch verification

Run one sandbox transaction for each path:

1. Wallet top-up with no bonus.
2. Wallet top-up with a configured bonus.
3. New subscription purchase.
4. Existing subscription change.
5. Failed payment.
6. In-progress payment followed by a successful webhook.
7. Replayed callback and webhook using the same transaction number.
8. Tampered amount, merchant ID, order ID, and checksum.

Confirm that wallet/subscription state changes only after a verified success,
that replayed events do not duplicate fulfillment, and that failed
fulfillment appears in `payment_provider_events` for operator follow-up.
