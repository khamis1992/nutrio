# Nutrio Security Audit — Read-Only Findings

**Scope:** secrets, auth/authz, injection/XSS, dependencies (live `npm audit` was blocked by sandbox; static review only), headers/CSP, mobile-specific. **Mode:** read-only, no code changes.

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High     | 6 |
| Medium   | 4 |
| Low      | 1 |
| **Total**| **15** |

---

### [CRITICAL] Hardcoded admin email backdoor — `src/pages/Auth.tsx:115`, `src/components/AdminLayout.tsx:64-77`
The literal email `khamis-1992@hotmail.com` is granted admin access in client code, and a similar fallback grants fleet-manager access to `admin@nutrio.com` (`Auth.tsx:131`). `AdminLayout.tsx:65-77` even broadens this to *any* email containing the substring `"admin"` when the `user_roles` query fails or returns no row. Anyone who can register an address such as `admin@anything.com` (or social-engineer/Supabase-control DB errors) gains admin UI rendering on the client. Although Supabase RLS should still gate data, the admin UI is exposed and any `service_role`-backed helper called from the admin UI becomes attacker-reachable.
**Fix:** Remove all email-string fallbacks. The single source of truth for roles must be `user_roles` (DB) protected by RLS. Migrate `khamis-1992@hotmail.com` to a real `user_roles` row, then delete every literal-email branch.

### [CRITICAL] Payment-gateway secret key bundled into the SPA — `src/lib/sadad.ts:7-8, 89, 128`
`VITE_SADAD_SECRET_KEY` and `VITE_SADAD_MERCHANT_ID` are read with `import.meta.env`, meaning Vite inlines them into the production bundle. The key is then sent as a `Bearer` token directly from the browser to `api.sadad.qa`, and is also used to compute HMAC-SHA256 callback signatures client-side (`generateSignature`). Anyone who downloads the JS can extract the merchant secret and (a) initiate refunds, (b) forge callback signatures, (c) impersonate the merchant. Client-side HMAC verification of *callbacks* is also meaningless — the server never sees the verifyCallback result.
**Fix:** Move all Sadad calls (`createPayment`, `getPaymentStatus`, `refundPayment`, signature verification) into a Supabase Edge Function that holds `SADAD_SECRET_KEY` server-side. The browser must only ever receive the `payment_url` to redirect to. Remove `VITE_SADAD_*` and revoke the key — it must be considered compromised if the bundle was ever shipped.

### [CRITICAL] Google OAuth client_secret bundled into the SPA — `src/hooks/useHealthIntegration.ts:236-260`, `src/hooks/useGoogleFitWorkouts.ts:110-111`
`VITE_GOOGLE_FIT_CLIENT_SECRET` is read in browser code and POSTed to `https://oauth2.googleapis.com/token` as `client_secret`. Google explicitly forbids embedding the confidential-client secret in public clients; an attacker who exfiltrates it from the bundle can mint tokens and impersonate the app to Google APIs, leading to scope abuse and a Google Cloud project takedown. A correct edge function (`functions/v1/google-fit-token`) already exists at `useHealthIntegration.ts:333` for the auth-code exchange — the refresh path bypasses it.
**Fix:** Move the refresh-token exchange into the same edge function; never send `client_secret` from the browser. Revoke and rotate the Google OAuth client secret. Switch the OAuth client type to "Web application" with PKCE (Google supports installed-app + PKCE without a secret).

### [CRITICAL] Apple distribution credentials at risk of being committed — `ios/Certificates.p12`, `ios/NutriFuel_App_Store.mobileprovision`
Both files are currently untracked, but `.gitignore` does not exclude `*.p12`, `*.mobileprovision`, `*.cer`, `*.keystore`, or `ios/Certificates*` — a single `git add ios/` would publish the App Store distribution certificate (and its private key) plus the provisioning profile. Possession of the `.p12` private key allows an attacker to sign and ship malicious builds to your Apple Developer account.
**Fix:** Add to `.gitignore` immediately: `*.p12`, `*.mobileprovision`, `*.cer`, `*.keystore`, `*.jks`, `ios/build/`, `ios/App/App.xcworkspace/xcuserdata/`. Verify with `git ls-files | grep -E '\.(p12|mobileprovision|keystore|jks|cer)$'` (must be empty). Store the cert in a secrets manager / GitHub Actions secret, and audit `git log --all -- ios/Certificates.p12` to confirm it was never previously committed.

### [HIGH] OpenRouter API key exposed in client bundle — `src/lib/ai-report-generator.ts:29`, `src/services/blood-work-ai.ts:24`, `src/services/taste-aware-menu-generator.ts:36`
`VITE_OPENROUTER_API_KEY` is sent as `Authorization: Bearer …` directly from the browser. Anyone scraping the bundle gets free use of your account credits and can pivot to other OpenRouter-allowed models. Even with "free" models, the key authenticates account-level rate limits and may have paid models attached.
**Fix:** Proxy through a Supabase Edge Function that holds the key, validates the calling user, and applies per-user rate limits. Rotate the existing key after migration.

### [HIGH] Mapbox token shipped to clients without URL allow-list — `src/components/maps/mapbox/MapboxMap.tsx:6-12`, `src/fleet/components/map/LiveMap.tsx:51`
`VITE_MAPBOX_TOKEN` is necessarily a public token, but `mapboxgl.accessToken = MAPBOX_TOKEN` with no restrictions means anyone can lift it and rack up tile/Geocoding charges against your Mapbox account.
**Fix:** In Mapbox account settings, scope the token to `URL = https://*.your-domain.com/*` and the Capacitor schemes (`capacitor://localhost`, `https://localhost`, custom scheme). Use a separate restricted token per build target. Set a billing alert.

### [HIGH] CSP allows `unsafe-eval` and `unsafe-inline` for scripts — `index.html:45`, `vercel.json:48`
`script-src 'self' 'unsafe-inline' 'unsafe-eval'` defeats most of CSP's XSS protection: an injected `<script>` tag executes, and any reflected attribute-style injection becomes RCE in the page. `'unsafe-eval'` is required by very few libraries; Vite production builds do not need it (the React 18 + SWC stack here doesn't use `eval`). The duplicate CSP via `<meta>` and the Vercel header also disagree (the meta CSP allows `images.unsplash.com` while Vercel does not — whichever the browser parses first wins, the other is ignored).
**Fix:** Drop `'unsafe-eval'`. Replace `'unsafe-inline'` for scripts with hashes or a per-request nonce. Pick *one* delivery channel for CSP (prefer the HTTP header in `vercel.json`) and remove the `<meta http-equiv>` to avoid drift. Add `upgrade-insecure-requests` and `object-src 'none'`.

### [HIGH] Capacitor allows cleartext HTTP in production — `capacitor.config.ts:11`
`server.cleartext: true` lets the Android WebView load `http://` resources. Combined with `androidScheme: 'https'`, the WebView upgrades the app shell, but any code path constructing an `http://` URL (third-party CDNs, mistyped configs) will silently downgrade. On hostile networks this enables MITM injection of JS into the WebView.
**Fix:** Set `cleartext: false` for production builds (you may keep a development override). Add `android:usesCleartextTraffic="false"` (or omit — default in API 28+) to `AndroidManifest.xml`. iOS `Info.plist` already lacks an `NSAppTransportSecurity` exception, which is correct.

### [HIGH] Biometric "credentials" store the user password in plaintext on the device keychain — `src/lib/capacitor.ts:520-533`, `src/pages/Auth.tsx:214`
`biometricAuth.setCredentials(email, password)` calls `NativeBiometric.setCredentials({ username, password, server })`. The plugin stores both into Keychain/Keystore and returns the *raw password* on biometric unlock (`Auth.tsx:188-189` then calls `signIn(credentials.username, credentials.password)`). On a jailbroken/rooted or malware-compromised device, plaintext passwords leak — this is also a poor recovery story (password rotation in Supabase silently breaks biometric login until the user notices). Furthermore, `enableBiometric` defaults to `hasCredentials` (`Auth.tsx:79`), so any prior enrollment auto-rebinds on first form submit even if the user disabled biometrics elsewhere.
**Fix:** Store a **refresh token** (or a short-lived Supabase session bound to the device) instead of the raw password. Use `supabase.auth.refreshSession({ refresh_token })` after successful biometric verification. On password change, server-side invalidate the refresh token; the device will fall back to interactive login.

### [HIGH] CSP omits Mapbox endpoints, breaking subresource integrity for fleet/live-map — `index.html:45`
The page CSP `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.sentry.io` does not include `https://api.mapbox.com`, `https://events.mapbox.com`, or `https://*.tiles.mapbox.com`. Either the browser will block tile requests (broken UX), or — more likely — the existing `<meta>` CSP is being silently overridden by Vercel's looser-but-different header, which itself omits Mapbox. This indicates the CSP is not actually being enforced/tested, providing only paper compliance.
**Fix:** Add `https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com` to `connect-src`, and `https://api.mapbox.com` to `img-src`. Run `curl -I https://your-prod-host/` in CI and assert the header matches the source of truth. Verify in DevTools console that no CSP violations are emitted on the LiveMap and FleetTracking routes.

### [HIGH] `dompurify` is imported once but raw `innerHTML` and `document.write` are used elsewhere with templated user-influenced data — `src/components/maps/mapbox/Marker.tsx:40`, `src/fleet/components/map/LiveMap.tsx:117-138`, `src/components/partner/PartnerDeliveryHandoff.tsx:305-358`
`Marker.tsx:40` does `el.innerHTML = typeof children === 'string' ? children : ''` — any string passed via the `children` prop is injected unescaped. `LiveMap.tsx:117-138` interpolates `${driver.driverName}` (a value from the database, ultimately settable by drivers in their profile) directly into `setHTML` and `innerHTML`. `PartnerDeliveryHandoff.tsx:305-358` writes a full HTML document into a `printWindow` that includes `${restaurantName}` and `${qrCode || deliveryJob.id}` plus a `<script src="https://cdnjs.cloudflare.com/...">` with no SRI hash. A malicious restaurant name or a CDN compromise yields stored XSS in the partner-portal print preview.
**Fix:** (1) For map popups, build DOM nodes with `document.createElement` + `textContent`, not template strings. (2) For the print window, escape interpolations with a small `escapeHtml()` and either inline the QR library or pin it with `integrity="sha384-…" crossorigin`. (3) For `Marker.tsx`, type `children` as `ReactNode` only and render via React Portal rather than `innerHTML`.

### [MEDIUM] `BloodWorkResults` AI analysis HTML built by string-replace before sanitizing — `src/pages/health/BloodWorkResults.tsx:332-340`
`DOMPurify.sanitize` is called *after* a chain of `replace()` calls that turn `## title` and `**bold**` markdown into HTML tags. DOMPurify will strip blatant `<script>`, but ordering is fragile: a malicious AI response containing `**onerror=alert(1)//**` produces `<strong>onerror=alert(1)//</strong>`, which is benign — but the regex `(<li.*<\/li>\n?)+` greedily wraps any prior tag in `<ul>`, allowing tag confusion. Lower severity because the AI is prompt-controlled, not user-controlled, and DOMPurify's default config blocks `on*` handlers; still, ordering should be: parse markdown with a real markdown library, then sanitize.
**Fix:** Use a vetted markdown→HTML library (e.g. `marked` with `mangle:false, headerIds:false`) and pass its output to `DOMPurify.sanitize` configured with `USE_PROFILES: { html: true }`. Drop the regex chain.

### [MEDIUM] CSP `frame-ancestors` differs between `<meta>` and Vercel header — `index.html:45` vs `vercel.json:27,48`
The HTTP header sets `X-Frame-Options: DENY` and `frame-ancestors 'none'`. The meta CSP omits `frame-ancestors` entirely. `frame-ancestors` is **only** valid via HTTP header, so the meta is moot here, but this confirms the meta CSP is partially dead (browsers ignore directives that the meta channel cannot carry). Combined with finding #7, this is evidence of CSP drift.
**Fix:** Single-source CSP from `vercel.json`. Add `frame-ancestors 'none'` to all environments and verify in security-headers scanners (e.g. `securityheaders.com`).

### [MEDIUM] Role check race + cache returns "no role" on timeout, then redirects to /dashboard — `src/components/ProtectedRoute.tsx:233-296, 285-295`
On a 5 s `Promise.race` timeout the catch sets `userRoles = []` and `hasRole = false`; the redirect waterfall on line 343-352 falls through to `/dashboard` for the customer experience, which is correct. **However**, the `requireApproval` branch at line 275-281 races the approval check against a 4 s timeout that **resolves true on timeout** ("`resolve(true)`"). On a slow network a non-approved partner is therefore granted access to the partner portal until the next refresh. Combined with the email-string admin fallback (finding #1), an unprivileged partner is briefly indistinguishable from an approved one.
**Fix:** Default `isPartnerApproved` timeout to `false` (fail closed). Surface a clear "verifying access" UI rather than silently granting. Drive role/approval state from a single Supabase query with RLS-enforced server filtering, not from client booleans.

### [LOW] IP geolocation gating fails open on any error — `src/lib/ipCheck.ts:39-61`, `src/contexts/AuthContext.tsx:131-134`
Both `checkIPLocation` (any non-200, any throw, dev-mode short-circuit) and the catch around `signIn` resolve to "allowed = true". This is intentional ("fail open for reliability"), but it means the IP block list is best-effort UX, not a security control — anyone can defeat it by killing the request at the network layer. Document this explicitly so it isn't relied on as compliance evidence.
**Fix:** Move the IP check into the Supabase auth hook (Postgres trigger on `auth.users` insert/login event), not the client. The client-side check is fine as a UX hint, but the actual block must be server-enforced.

---

## Notes for the parent agent

- Live `npm audit` could not be executed (Bash tool sandboxed). The team should run `npm audit --omit=dev` in CI and treat any High/Critical advisory as a release blocker. Direct dependencies most worth watching given the mobile/PDF surface: `jspdf`, `html2canvas`, `mapbox-gl`, `@supabase/supabase-js`, `posthog-js`.
- `SECURITY_REMEDIATION_REPORT.md` (Feb 2026) covers DB-side encryption and partner-API hashing — those fixes are not contradicted by anything found here. The findings above are *client-side and config-side* and are not addressed by that report.
- Several Supabase `.rpc()` calls (e.g. `cancel_meal_schedule`, `credit_wallet`, `debit_wallet`, `admin_cancel_meal_schedule`) accept user IDs and amounts from the client. RLS / SECURITY DEFINER review of these functions is out of scope here — flagging for the architecture/quality agents.
