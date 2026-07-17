# Production Security Deployment Checklist

## 1. Change control

- Protect `main`; require reviewed pull requests and successful CI checks.
- Require approval on GitHub production environments and restrict deployers.
- Run `npm ci --ignore-scripts`, `npm audit --audit-level=high`, and
  `npm audit signatures` before `npm rebuild`. Then run
  `npm run security:scan`, lint, typecheck, tests, and the production build.
- Protect the `Trusted E2E` and `Mobile Signing` GitHub environments with
  required reviewers, `main`-only deployment branches, and no administrator
  bypass. Keep test credentials and signing material as environment secrets.
- Review every dependency/action update and keep Dependabot enabled.
- Enable GitHub Code Security with this repository's advanced CodeQL workflow.
  Require both `javascript-typescript` and `actions` analyses in the protected
  branch ruleset, and triage every new high/critical result before release.
- Enable GitHub Secret Scanning, push protection, validity checks, and delegated
  bypass review. Revoke and rotate a credential immediately if GitHub reports
  that it ever entered Git history; deleting the latest file is not sufficient.
- Require the `Scan new commits for secrets` status check. It downloads the
  pinned Gitleaks release, verifies its published SHA-256, redacts matches, and
  scans the exact push or pull-request commit range.
- Review the Android WebView baseline every release. It is currently 149;
  raise it as supported Chrome/WebView security releases advance and never
  lower it below PDF.js's documented Chrome 118 compatibility floor.
- Keep every third-party GitHub Action pinned to its full 40-character commit
  SHA; the repository security scan rejects movable tags such as `@v4`.
- Require the `Supply Chain Security` status check. It installs the lockfile
  without lifecycle scripts, verifies advisories and npm registry signatures,
  validates the pinned-provider immutable evidence receiver with a checksum-
  verified Terraform CLI, then rebuilds and runs the CSP/supply-chain regression
  test.
- Keep both CSP policies aligned. `script-src` must remain `self`-only and
  `connect-src` is limited to `loepcagitrijlfksawfm.supabase.co`, PostHog US,
  Mapbox API/events, Google Fitness, and Nominatim. Add an exact origin to both
  policies before enabling another telemetry or API provider; do not add a
  multi-tenant wildcard. `frame-ancestors 'none'` must remain an HTTP response
  header because browsers ignore it in a meta policy.
- Keep the iOS `Package.resolved` revision and the two
  `-disableAutomaticPackageResolution` build flags. Update the lock only after
  matching a reviewed official Capacitor release to its full commit revision.
- Keep the Supabase CLI release version and Linux archive SHA-256 together in
  both production workflows. Verify a new digest against the official GitHub
  release asset before updating either value.
- Treat disabled Gradle publisher-signature verification as an Android release
  blocker. The signed workflow must remain fail-closed until a clean isolated
  runner produces reviewed checksum/PGP metadata and trusted publisher keys.
- Never deploy migrations by copying SQL into workflow summaries. The database
  workflow previews/applies all pending migrations and records the approved
  marker filename and SHA-256.

## 2. Database and Edge order

Apply the pending security migrations in timestamp order, including:

1. `20260716120000_security_event_ledger.sql`
2. `20260716121000_secure_affiliate_notification_triggers.sql`
3. `20260716122000_atomic_security_rate_limits.sql`
4. `20260716123000_repair_security_crypto_functions.sql`
5. `20260716124000_secure_google_fit_credentials.sql`
6. `20260716125000_secure_notification_workflows.sql`
7. `20260716126000_secure_sensitive_storage.sql`
8. `20260716130000_harden_partner_banking_payout_data.sql`
9. `20260716131000_atomic_admin_payment_simulation.sql`
10. `20260716132000_harden_sporthub_oauth_ingestion.sql`
11. `20260716133000_security_incident_case_management.sql`
12. `20260716133500_prepare_admin_policies_for_mfa.sql`
13. `20260716134000_require_admin_mfa.sql`
14. `20260716135000_secure_sensitive_upload_pipeline.sql`
15. `20260716136000_admin_security_posture.sql`
16. `20260717090000_harden_notification_delivery_runtime.sql`
17. `20260717091000_atomic_partner_onboarding_banking.sql`
18. `20260717092000_harden_forensic_evidence_integrity.sql`
19. `20260717093000_harden_authorization_boundaries.sql`
20. `20260717094000_ingest_auth_audit_events.sql`
21. `20260717095000_expand_critical_security_event_coverage.sql`
22. `20260717100000_security_runtime_attestation.sql`
23. `20260717110000_secure_signup_provisioning.sql`
24. `20260717120000_signup_security_attestation.sql`
25. `20260717130000_fleet_city_isolation_and_mfa.sql`
26. `20260717131000_secure_health_ai_consent_and_budget.sql`
27. `20260717132000_harden_sporthub_webhook_and_credentials.sql`
28. `20260717133000_close_delivery_and_catalog_authorization_gaps.sql`
29. `20260717134000_harden_edge_quotas_and_delivery.sql`
30. `20260717135000_audit_forensic_evidence_access.sql`
31. `20260717136000_security_release_attestation.sql`
32. `20260717137000_verify_external_anchor_acknowledgements.sql`
33. `20260717138000_require_authenticated_sporthub_link_completion.sql`
34. `20260717139000_enforce_catalog_projections.sql`
35. `20260717140000_security_alert_outbox.sql`
36. `20260717141000_seal_incidents_and_track_evidence_custody.sql`
37. `20260717142000_paginated_forensic_exports.sql`
38. `20260717143000_attest_security_function_definitions.sql`

The linked project also has the two preceding, non-security application
migrations `20260715100000_admin_subscription_wallet_adjustments.sql` and
`20260715103000_make_admin_subscription_wallet_update_compatible.sql` pending.
The current `db push --dry-run --include-all` therefore reports 40 migrations in
total. Review and test those two compatibility migrations in the same staging
release before the 38 security migrations; do not skip them or alter the remote
migration history manually.

Run the database workflow dry-run against staging first. Deploy Edge Functions
only after their required database RPCs exist, and do not apply migrations that
have not passed the staged catalog and authorization checks below.

The 2026-07-17 linked-project check originally found four remote-only versions.
`supabase migration fetch` recovered their stored statements, and canonical SQL
comparison proved they are the executable equivalents of the four local
nutrition migrations. Their local filenames were reconciled to the applied
remote versions: `20260714082313`, `20260714175922`, `20260714180003`, and
`20260714180510`. The remote history was preserved; no `migration repair` or
`reverted` marker was used. Retain this mapping as release evidence and still
review the post-reconciliation `db push --dry-run` before deployment.

## 3. Required secrets

Generate independent random values and store server secrets only in Supabase
Edge secrets and protected GitHub Environment secrets. Never prefix them with
`VITE_`.

- Supabase automatically injects the named `SUPABASE_SECRET_KEYS` and
  `SUPABASE_PUBLISHABLE_KEYS` JSON maps into hosted Edge Functions. The resolver
  selects `default`, or the names configured through
  `NUTRIO_SUPABASE_SECRET_KEY_NAME` and
  `NUTRIO_SUPABASE_PUBLISHABLE_KEY_NAME`. Direct
  `SUPABASE_SECRET_KEY`/`SUPABASE_PUBLISHABLE_KEY` values are supported only for
  local single-key runtimes. Nutrio runtime code and workflows intentionally do
  not accept `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` fallbacks.
- Configure the named keys in every client, worker, CI environment, webhook,
  and local operation, then deactivate the legacy JWT-based `service_role` and
  `anon` keys. Never send an `sb_secret_` key in an `Authorization: Bearer`
  header; use `apikey` or scoped internal auth.
- `SECURITY_LOG_CRON_SECRET`, `SECURITY_ANCHOR_WEBHOOK_URL`, its exact
  `SECURITY_ANCHOR_ALLOWED_HOSTS` domain allowlist, and a random
  `SECURITY_ANCHOR_HMAC_KEY` of at least 32 bytes. Also configure a distinct
  receiver key in `SECURITY_ANCHOR_ACK_HMAC_KEY` and its active identifier in
  `SECURITY_ANCHOR_ACK_KEY_ID`; the two HMAC keys must never be equal.
- Store the exact same `SECURITY_ANCHOR_ACK_HMAC_KEY` value in Supabase Vault
  under `security_anchor_ack_hmac_key` before applying migration
  `20260717137000_verify_external_anchor_acknowledgements.sql`. The Edge secret
  and Vault secret must match; the database now independently verifies every
  receiver acknowledgement and fails closed if Vault is unavailable.
- `MALWARE_SCANNER_URL`, its exact `MALWARE_SCANNER_ALLOWED_HOSTS` domain
  allowlist, `MALWARE_SCANNER_API_KEY`, and
  `REQUIRE_MALWARE_SCAN=true`.
- Independent notification/recovery/renewal/reminder cron secrets.
- `INTERNAL_FUNCTION_SECRET` for trusted function-to-function affiliate email
  dispatch, `ADAPTIVE_GOALS_CRON_SECRET`, and `MEAL_REMINDER_CRON_SECRET`.
  Generate independent values; do not reuse a cron secret as a provider key.
- `AUTH_BEFORE_USER_CREATED_HOOK_SECRET`, copied exactly from the Supabase
  **Before User Created** HTTP Auth Hook (`v1,whsec_...`). This is a server-only
  Standard Webhooks signing secret. Never expose it to the SPA or prefix it
  with `VITE_`.
- Android/iOS signing assets as base64 GitHub secrets; never repository files.
- `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions`,
  and `DEEPSEEK_ALLOWED_HOSTS=api.deepseek.com`. These are server-only Edge
  secrets. Never expose the key or provider URL overrides through `VITE_`.
- `MANUS_API_KEY` for meal-image analysis. It must remain distinct from
  DeepSeek credentials and server-only; configure the exact provider host
  allowlist required by the deployed image-analysis function.
- `USDA_FDC_API_KEY` for server-side FoodData Central cross-checks. Keep it
  server-only, never prefix it with `VITE_`, and do not use the shared
  `DEMO_KEY` in production.
- SportHub OAuth/webhook secrets: client credentials, a webhook HMAC secret of
  at least 32 random bytes, and `SPORTHUB_ALLOWED_HOSTS` containing the exact
  authorization, token, user-info, and API hostnames. Parent-domain or wildcard
  entries are not accepted. Configure `SPORTHUB_TOKEN_ENCRYPTION_KEYS` as a
  JSON object of base64url-encoded 32-byte AES keys and select the active entry
  with `SPORTHUB_TOKEN_ENCRYPTION_KEY_ID`. Retain the previous key during a
  rotation window; the legacy single-key secret is migration-only.

Firebase client API keys in `google-services.json` and
`GoogleService-Info.plist` identify the public mobile clients and are not server
secrets. Restrict them in Google Cloud/Firebase to Nutrio's Android package plus
release signing certificate and the iOS bundle identifier, allow only required
APIs, set quotas, and alert on unusual usage. Never use those client keys to
authorize privileged backend operations.

Rotate secrets after staff/vendor changes, any suspected exposure, and according
to the approved cryptographic key schedule. Record rotation as an incident or
controlled security change.

## 4. Malware scanner contract

The scanner URL must be HTTPS. Nutrio sends a multipart `file` with a bearer API
key and expects a JSON response no larger than 32 KiB:

```json
{
  "clean": true,
  "provider": "scanner-name",
  "scan_id": "provider-request-id",
  "threat": null
}
```

Use a maintained engine with frequent signatures, encrypted transport, Qatar
data-location/processing approval, strict retention, and a provider audit trail.
Test a harmless EICAR fixture in an isolated non-production bucket: it must be
blocked and produce a critical security event. Production must fail closed when
the scanner is unavailable. Alert on `validated_only` or `error` scan records.

## 5. Evidence anchor receiver

- The reviewed reference implementation is in
  `infra/security-evidence-receiver`. Deploy it into an AWS account outside the
  Supabase/GitHub production trust boundary. Its Terraform configuration uses
  S3 Object Lock `COMPLIANCE`, versioning, KMS, DynamoDB conditional chain and
  replay protection, API Gateway, WAF, throttling, and CloudWatch alarms. Pass
  only Secrets Manager ARNs; never put secret values in Terraform variables or
  state. Review the legal retention period before creating the bucket.
- Host the receiver outside the Supabase project/account trust boundary.
- Verify `X-Nutrio-Signature` using `SECURITY_ANCHOR_HMAC_KEY` before storage.
- Store the exact request body under immutable/object-lock retention.
- Return the signed `nutrio-security-anchor-ack-v1` JSON contract documented in
  `FORENSIC_EVIDENCE_PROTOCOL.md`. A `2xx` response or `x-request-id` without
  this receiver-generated acknowledgement is intentionally rejected.
- Retain receiver access/audit logs and alert when no fresh validated
  acknowledgement exists for the previous completed UTC day.
- Test restoration and hash comparison quarterly.

## 6. Runtime validation

- Protect the GitHub `Security Staging` environment with required reviewers,
  staging-only deployment branches, and no administrator bypass. Configure its
  `STAGING_SUPABASE_PROJECT_REF` variable and the four `STAGING_*` secrets used
  by `.github/workflows/security-staging-canary.yml`. Run the workflow with the
  exact `STAGING-CANARY` confirmation after every alert-pipeline change. The
  canary creates a synthetic critical event and passes only when the external
  receiver returns a valid signed acknowledgement and the database records a
  fresh delivery with no dead letters. Never point these values at production.
- Enroll every admin in MFA and confirm no admin data is visible at AAL1.
- Keep a dedicated, least-privilege production E2E admin with exactly one TOTP
  factor. Store its base32 seed only as the protected GitHub Environment secret
  `E2E_ADMIN_TOTP_SECRET` (and set `E2E_ADMIN_TOTP_FACTOR_NAME` if the account
  has multiple factors). The production launch gate must prove the resulting
  JWT is `aal2`; a password-only admin test is not a valid release signal.
- The Admin MFA field accepts only the current six-digit TOTP from the matching
  Nutrio entry in an authenticator app, never an email or SMS OTP. Confirm the
  UI displays the expected factor friendly name and linked date, enable
  automatic phone time, and use a newly rotated code. If the factor was lost or
  replaced, use an approved, separately authorized recovery procedure that
  removes and re-enrolls the stale factor while recording the operator and
  ticket; never bypass AAL2 or request the user's TOTP seed.
- Open Admin > Security Center > Security posture and confirm the displayed
  controls version is `20260717136000`. Resolve every red check and document
  every accepted warning.
- Deploy `before-user-created` with JWT verification disabled because Supabase
  Auth authenticates it with a Standard Webhooks signature. Deploy
  `create-fleet-manager`, `create-partner-user`, `fleet-drivers`, and
  `register-driver` with their configured JWT behavior. Do not enable the Auth
  Hook until migration `20260717110000` and all four invitation/registration
  functions are live.

  Run the function deployment only after the database migrations have passed in
  staging, in this order:

  ```powershell
  npx supabase functions deploy before-user-created --no-verify-jwt
  npx supabase functions deploy create-fleet-manager
  npx supabase functions deploy create-partner-user
  npx supabase functions deploy fleet-drivers
  npx supabase functions deploy register-driver
  npx supabase functions deploy proxy-openrouter
  npx supabase functions deploy ai-router --no-verify-jwt
  npx supabase functions deploy analyze-blood-work --no-verify-jwt
  ```

  Deploy the remaining changed runtime functions through the reviewed Edge
  workflow after the database RPCs above exist: `analyze-meal-image`,
  `generate-ai-insight`, `send-monthly-affiliate-report`,
  `send-affiliate-status-notification`, `send-meal-reminders`,
  `adaptive-goals`, `adaptive-goals-batch`, `smart-meal-allocator`,
  `nutrio-mcp`, `google-fit-token`, `process-whatsapp-notifications`,
  `send-email`, `qnas-proxy`, `send-push-notification`,
  `send-invoice-email`, `send-whatsapp-proxy`, and
  `secure-sensitive-upload`. Preserve each function's reviewed JWT setting;
  `--no-verify-jwt` is not a general workaround for deployment failures.

  Confirm the linked project before every command. Never use
  `--no-verify-jwt` for the four authenticated invitation/registration
  functions.
- Deploy `proxy-openrouter` as the retired fail-closed tombstone before the new
  clients. It must return `410` and must contain no provider network call.
  `ai-router` and `analyze-blood-work` authenticate the bearer token inside the
  function, so their configured gateway JWT check remains disabled; both must
  retain `authenticateRequest`, per-user/IP rate limits, provider host
  allowlisting, timeouts, and the service-only atomic AI budget RPCs.
- Grant the current versioned health-AI consent in the blood-work UI and prove
  the request sends only the record ID and request ID. Confirm the Edge
  function loads the owned markers server-side and its evidence event records
  `sent_name=false` and `sent_pdf=false`. Revocation must prevent the next
  analysis. Test the sixth analysis in one UTC day and confirm it fails with
  `429` without contacting DeepSeek.
- Send a signed SportHub webhook canary, replay the same event ID, and confirm
  the second request is ignored and recorded as a replay. Test stale timestamps,
  invalid signatures, non-JSON content, oversized bodies, cross-customer
  session IDs, invalid durations/calories, and a projection failure. No raw
  provider body or token may appear in `partner_events`, activity payloads,
  Edge logs, Sentry, or the forensic ledger. Confirm a failed projection rolls
  back the replay reservation so a corrected provider retry can succeed.
- In a controlled signup maintenance window, configure **Authentication >
  Hooks > Before User Created** to call
  `https://<project-ref>.supabase.co/functions/v1/before-user-created`, copy its
  generated signing secret into `AUTH_BEFORE_USER_CREATED_HOOK_SECRET`, and
  immediately run the canaries below. The function intentionally fails closed
  while its secret or geolocation provider is unavailable.
- From staging, prove a direct `/auth/v1/signup` request from outside Qatar is
  rejected even when it bypasses the SPA; prove a Qatar signup succeeds. Do
  not accept `cf-ipcountry` supplied by the client as evidence: the decision
  must use the signed original IP in the Auth Hook payload.
- Prove an unsigned/replayed Auth Hook request is rejected, an expired or
  replayed provisioning token is rejected, and the raw provisioning token is
  removed from Auth user metadata after use.
- Exercise partner, fleet-driver, and fleet-manager invitations. Each must
  consume exactly one matching grant; deleting/disabling the hook must cause
  invitation creation to roll back rather than silently bypass the control.
- Exercise self-service driver registration with email confirmation enabled.
  No driver row may exist before a verified session; afterward it must be
  `pending`, inactive, offline, unassigned, and have zero financial/delivery
  counters. A scoped fleet manager must not receive the global Admin role.
- Confirm sensitive buckets are private and have no client INSERT/UPDATE policy.
- Confirm RLS on every public table and inspect anonymous SECURITY DEFINER grants.
- Verify the latest ledger chain, daily anchor, and off-site receipt.
- Confirm payment/webhook replay tests, rate-limit tests, signed URL expiry, and
  cross-user/portal authorization tests.
- Confirm a delivery status/driver change creates a recent, actor-attributed
  `delivery.*` event and separately confirm a pricing/entitlement change creates
  a recent `commercial.*` event. The posture check must remain in review when
  either path has no evidence in the last 30 days.
- Attempt direct authenticated `INSERT` and `UPDATE` requests against
  `delivery_jobs` and confirm both fail. Exercise assignment, acceptance,
  rejection, pickup, delivery, failure, and reassignment through the reviewed
  RPCs; verify the old driver's `current_job_id` is cleared, terminal timestamps
  are set, and pickup/QR secrets never appear in `delivery_jobs`, catalog views,
  logs, or client caches.
- From an AAL2 admin session, search events, open an incident, verify the ledger,
  and read runtime posture. Confirm each successful evidence read appends one
  `admin.forensic_evidence.*` event and that all renamed
  `*evidence_access_legacy*` functions remain non-executable by `anon` and
  `authenticated`.
- Exhaust one AI task's staging daily budget concurrently and confirm exactly
  the allowed number of reservations succeed. Replay a notification delivery
  key and confirm the unique index/identity trigger prevents a duplicate send.
- Confirm Partner API authentication creates both a recent success event and a
  recent failure event without storing the key or secret. One outcome alone is
  intentionally insufficient for a passing posture check.
- Confirm native builds reject obsolete WebViews with the local upgrade page,
  permit no cleartext traffic, and cannot navigate external sites in-app.
- Verify Sentry/PostHog do not receive health values, tokens, documents, payment
  credentials, or raw request bodies.

## 7. Infrastructure and operations

- Put the public application behind CDN/WAF rate and bot controls; preserve WAF
  request IDs and source IP chain with an approved retention period.
- Restrict Supabase dashboard, GitHub, domain/DNS, payment, email, and app-store
  accounts with phishing-resistant MFA where supported.
- Enable provider audit logs and alerts for role/policy/secret changes.
- Review GitHub's CodeQL, dependency, and secret-scanning alerts at least weekly;
  send high/critical findings to the security incident process and preserve the
  alert URL, timestamps, affected commit, and remediation commit.
- Back up database and private storage; encrypt backups and test restoration.
- Time-sync systems to UTC and document log retention/legal-hold procedures.
- Conduct a quarterly incident exercise and an annual external penetration test.
- In Supabase **Authentication > Audit Logs**, keep database audit-log storage
  enabled. Confirm a fresh login and MFA verification create
  `authentication.supabase.*` events in `/nutrio/admin/security`. The Admin
  posture intentionally remains action-required if the database audit table or
  mirror trigger is unavailable.
- Configure an independent Supabase Log Drain/SIEM for Auth, API Gateway,
  Storage, Postgres, and Edge Function runtime failures. Generic HTTP drains
  are unsigned today, so require a high-entropy custom authorization header at
  the external receiver. Do not send the full drain to an Edge Function in the
  same project, which can recursively log its own ingestion traffic. This drain
  supplements provider-level evidence and does not replace the in-project,
  minimized Auth events shown in the Admin Security Center.

## 8. Release sign-off

Record release SHA, migration dry-run, approvers, artifact hashes, mobile signing
identity, runtime posture export, backup/restore check, known residual risks, and
rollback owner before production approval.
