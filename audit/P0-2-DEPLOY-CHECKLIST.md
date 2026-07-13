# P0 #2 — Deploy & Key Rotation Checklist

The code changes are done. **You must complete the steps below before merging**, otherwise:
- The two new edge functions won't exist in Supabase, and Sadad/Google Fit refresh will be broken in production
- The currently-leaked secrets remain valid even though they're no longer compiled into the bundle
- The `VITE_*` env vars still need to be removed from build environments

## What changed in code

**New edge functions (created — need deploy):**
- `supabase/functions/sadad-payment/index.ts` — handles hosted checkout creation, status, checksum-verified callbacks, and webhooks
- `supabase/functions/google-fit-token-refresh/index.ts` — refreshes Google Fit access tokens server-side

**Client refactored (no more secrets in bundle):**
- `src/lib/sadad.ts` — now a thin wrapper around `sadad-payment` edge function. Removed Node `crypto` import, dead `verifyCallback`/`generateSignature` (those belong server-side anyway).
- `src/hooks/useGoogleFitWorkouts.ts:95-126` — calls `google-fit-token-refresh` instead of doing the OAuth refresh inline.
- `src/hooks/useHealthIntegration.ts:235-260` — same.

## Deploy steps

### 1. Deploy the new edge functions

```bash
supabase functions deploy sadad-payment
supabase functions deploy google-fit-token-refresh
```

### 2. Set the server-side secrets

In Supabase dashboard → Project Settings → Edge Functions → Secrets (or via CLI):

```bash
supabase secrets set SADAD_MERCHANT_ID=<your-merchant-id>
supabase secrets set SADAD_SECRET_KEY=<NEW-rotated-key>
supabase secrets set SADAD_WEBSITE=<registered-website-identifier>
supabase secrets set SADAD_CALLBACK_URL=https://<project>.supabase.co/functions/v1/sadad-payment?source=callback
supabase secrets set APP_URL=https://<app-host>/nutrio
supabase secrets set ALLOWED_ORIGINS=https://<app-host>
# GOOGLE_FIT_CLIENT_ID and GOOGLE_FIT_CLIENT_SECRET are likely already set
# for the existing google-fit-token function. Verify:
supabase secrets list
```

The `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by Supabase to all functions.

### 3. **Rotate the leaked credentials** (critical — they were in your bundle)

Anyone who downloaded a build before this fix has these values:
- **Sadad merchant secret key** — request a fresh one from Sadad portal, then update `SADAD_SECRET_KEY` (step 2)
- **Google OAuth client secret** — Google Cloud Console → APIs & Services → Credentials → your OAuth client → "Reset secret" → update `GOOGLE_FIT_CLIENT_SECRET`

Do this **before** deploying the new edge functions if possible, so the new key is what flows through them.

### 4. Remove `VITE_*` secrets from build environments

Strip these from `.env`, `.env.production`, your CI variables, Vercel/Netlify project settings, mobile build pipelines:

```
VITE_SADAD_SECRET_KEY
VITE_SADAD_MERCHANT_ID    # was used client-side; only needs to live server-side now
VITE_SADAD_API_URL        # same
VITE_GOOGLE_FIT_CLIENT_SECRET
```

Keep:
- `VITE_GOOGLE_FIT_CLIENT_ID` — public client ID, fine in bundle
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — public by design

### 5. Verify

After deploy:

```bash
# Smoke test the refresh function (should 401 without auth, 200 with)
curl -i -X POST https://<project>.supabase.co/functions/v1/google-fit-token-refresh \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Smoke test sadad
curl -i -X POST https://<project>.supabase.co/functions/v1/sadad-payment \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"op":"status","payload":{"paymentId":"test"}}'
```

Then in the app: connect Google Fit, wait for token expiry (or force it in DB by setting `expires_at` to a past timestamp), and confirm refresh succeeds. For SADAD, follow the sandbox matrix in `docs/integrations/SADAD_WEB_CHECKOUT_2_1.md` and configure the merchant-panel webhook as `https://<project>.supabase.co/functions/v1/sadad-payment?source=webhook`.

## Known remaining issues (out of scope for this fix)

- **OpenRouter API key in client bundle** — the security audit found this in 3 files. Same pattern — needs an edge function proxy. Not addressed in this PR.
- **Mapbox token without URL allow-list** — restrict in Mapbox dashboard to your domains.
