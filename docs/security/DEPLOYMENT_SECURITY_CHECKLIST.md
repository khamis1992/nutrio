# Production Security Deployment Checklist

## 1. Change control

- Protect `main`; require reviewed pull requests and successful CI checks.
- Require approval on GitHub production environments and restrict deployers.
- Run `npm ci`, `npm audit --audit-level=high`,
  `npm run security:scan`, lint, typecheck, tests, and production build.
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

Run the database workflow dry-run against staging first. Because the current
remote migration history has diverged, reconcile/repair history explicitly; do
not perform a broad production `db push` until the dry-run contains only approved
migrations. Deploy Edge Functions only after their required database RPCs exist.

The 2026-07-17 linked-project check found these remote-only versions:
`20260714082313`, `20260714175922`, `20260714180003`, and
`20260714180510`. Recover their source/provenance and compare the remote schema
before changing migration history. Do not mark them reverted merely to make
`db push` proceed; that can hide SQL already applied to production.

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
  local single-key runtimes; legacy `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`
  are temporary migration fallbacks.
- Deploy the compatibility code, migrate clients and workers, then deactivate
  the legacy JWT-based `service_role` and `anon` keys. Never send an `sb_secret_`
  key in an `Authorization: Bearer` header; use `apikey` or scoped internal auth.
- `SECURITY_LOG_CRON_SECRET`, `SECURITY_ANCHOR_WEBHOOK_URL`, its exact
  `SECURITY_ANCHOR_ALLOWED_HOSTS` domain allowlist, and a random
  `SECURITY_ANCHOR_HMAC_KEY` of at least 32 bytes. Also configure a distinct
  receiver key in `SECURITY_ANCHOR_ACK_HMAC_KEY` and its active identifier in
  `SECURITY_ANCHOR_ACK_KEY_ID`; the two HMAC keys must never be equal.
- `MALWARE_SCANNER_URL`, its exact `MALWARE_SCANNER_ALLOWED_HOSTS` domain
  allowlist, `MALWARE_SCANNER_API_KEY`, and
  `REQUIRE_MALWARE_SCAN=true`.
- Independent notification/recovery/renewal/reminder cron secrets.
- Android/iOS signing assets as base64 GitHub secrets; never repository files.

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

- Enroll every admin in MFA and confirm no admin data is visible at AAL1.
- Keep a dedicated, least-privilege production E2E admin with exactly one TOTP
  factor. Store its base32 seed only as the protected GitHub Environment secret
  `E2E_ADMIN_TOTP_SECRET` (and set `E2E_ADMIN_TOTP_FACTOR_NAME` if the account
  has multiple factors). The production launch gate must prove the resulting
  JWT is `aal2`; a password-only admin test is not a valid release signal.
- Open Admin > Security Center > Security posture. Resolve every red check and
  document every accepted warning.
- Confirm sensitive buckets are private and have no client INSERT/UPDATE policy.
- Confirm RLS on every public table and inspect anonymous SECURITY DEFINER grants.
- Verify the latest ledger chain, daily anchor, and off-site receipt.
- Confirm payment/webhook replay tests, rate-limit tests, signed URL expiry, and
  cross-user/portal authorization tests.
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
  `authentication.supabase.*` events in `/nutrio/admin/security`.
- Configure an independent Supabase Log Drain/SIEM for Auth, API Gateway,
  Storage, Postgres, and Edge Function runtime failures. Generic HTTP drains
  are unsigned today, so require a high-entropy custom authorization header at
  the external receiver. Do not send the full drain to an Edge Function in the
  same project, which can recursively log its own ingestion traffic.

## 8. Release sign-off

Record release SHA, migration dry-run, approvers, artifact hashes, mobile signing
identity, runtime posture export, backup/restore check, known residual risks, and
rollback owner before production approval.
