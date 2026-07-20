# Nutrio Launch External Inputs

Date: 2026-07-20  
Status: required before unrestricted production launch

The repository gates that can run on this workstation now pass. The items
below require credentials, platform settings, hardware, provider sandboxes, or
licensed external reviewers and must not be marked complete from code alone.

## 1. Supabase owner session

Owner: Supabase project owner

1. Restore Supabase MCP OAuth or provide a scoped `SUPABASE_ACCESS_TOKEN` to the
   release environment. Do not place it in Git.
2. Run `supabase/tests/nutrio-verified-view-security.sql`.
3. Rerun the Supabase security advisor and verify the
   `security_definer_view` error is gone.
4. In Auth settings, set OTP expiry to no more than one hour and enable leaked
   password protection.
5. Schedule the available Supabase Postgres security upgrade.
6. Record the accepted treatment for extension-managed `spatial_ref_sys`;
   do not add ordinary RLS automatically without Supabase guidance.

`20260720249000_harden_nutrio_verified_view.sql` was applied to the linked
project through an isolated CLI workdir containing placeholders for the exact
remote ledger plus the single real migration. The dry run selected only
`20260720249000`, the push completed successfully, and a subsequent migration
list confirmed matching local and remote version entries. No `--include-all`
push or migration-history repair was used. Supabase MCP still requires a fresh
OAuth authorization for the pgTAP/advisor verification steps; it no longer
blocks the migration itself. An anonymous PostgREST read of the view now returns
HTTP `401` / PostgreSQL `42501` with `permission denied for table restaurants`,
which is the expected runtime evidence that the invoker cannot bypass the
underlying table permissions.

Evidence still required: full pgTAP output, post-change advisor export, and
screenshots of the three platform settings.

For the separate fresh/upgraded local replay on this workstation, open an
Administrator PowerShell and enable the currently disabled WSL service:

```powershell
Set-Service -Name WslService -StartupType Manual
Start-Service -Name WslService
```

Reboot if Windows requests it, start Docker Desktop, then run
`npm run test:db:phase1`. The 2026-07-20 attempt reached Supabase startup but
could not run SQL because Docker reported the disabled WSL service.

## 2. Android build and device lab

Owner: Mobile release engineer

1. Android command-line tools, platform 36, platform-tools, and build-tools are
   installed on the current workstation. Keep `ANDROID_HOME` local and do not
   commit `android/local.properties`.
2. Capacitor sync and debug assembly pass. Gradle provenance has also passed
   strict isolated APK/AAB builds with a disposable attestation key.
3. Run the protected `Build Android Release (APK + AAB)` workflow with the real
   `Mobile Signing` secrets and retain its signing/checksum manifests.
4. Test that installed production-signed APK on one Samsung and one stock
   Android device.
5. Cover Arabic/English, large system text, TalkBack, keyboard, native back,
   deep links, offline replay, status/navigation safe areas, and dock clearance.
6. Capture screenshots, device/OS/build identifiers, and a signed run log.

Do not commit `android/local.properties` or local SDK paths.

## 3. Six-portal launch identities

Owner: QA and Security

Provide dedicated non-production credentials for customer, admin, partner,
driver, fleet, and coach. Configure a real TOTP seed for the admin launch user.
This workstation currently lacks `E2E_COACH_EMAIL`, `E2E_COACH_PASSWORD`, and
`E2E_ADMIN_TOTP_SECRET`; the configured admin account also failed to reach the
admin portal during the launch-gate run.

Run:

```powershell
$env:ALLOW_LOCAL_LAUNCH_GATE='1'
npx.cmd playwright test --config playwright.launch.config.ts
```

For release evidence, rerun against a deployed staging URL without the local
override and archive the session-revocation result.

## 4. SADAD and subscription financial sandbox

Owner: Payments engineer and Finance

Provide the SADAD sandbox merchant configuration through the secret manager,
never client environment variables. Set `RUN_REAL_SUPABASE_INTEGRATION=1` only
in the isolated integration environment and complete the five pending critical
fixtures:

- concurrent meal completion cannot double count;
- only a checksum-verified SADAD callback credits the wallet;
- concurrent callbacks return `already_processed` without a second credit;
- annual plans activate only after verified payment;
- wallet-funded plan changes apply proration atomically.

Archive provider callback IDs, database audit rows, wallet/subscription before
and after snapshots, and replay results with customer data redacted.

## 5. Clinical, privacy, and supplier operations

Owner: Product, Legal, Privacy, and Clinical Operations

- Keep GLP-1 protocols draft and non-promotional until Qatar legal review,
  licensed dietitian review, medical-safety wording, and DPIA are signed.
- Keep model-backed Meal Response claims abstained until direct-provider device
  validation and pilot calibration pass.
- Run the first supplier-quality snapshot from a genuine AAL2 admin session.
- Assign named owners and SLAs for care credential expiry, overdue responses,
  allergy rejection, sponsor disputes, refund recovery, and sensor disconnects.

## Go decision

Unrestricted production launch requires every section above to have dated,
reviewable evidence. Until then, only a controlled invited pilot is acceptable,
with Family, Corporate Benefits, GLP-1 publication, and model-backed Meal
Response claims kept behind their default-off controls.

## Machine-enforced signoff

Copy `docs/handovers/launch-evidence-manifest.template.json` to the protected
release artifact directory, populate every required artifact with a `uri` and
`recordedAt` plus its 64-character `sha256`, bind `releaseSha` to the production
commit, and set a gate to `passed` only after its owner fills `approvedBy` and
`approvedAt`. Evidence freshness is enforced per gate from 7 to 365 days.
Do not commit credentials or private evidence files.

Run the non-blocking report while preparing evidence:

```powershell
npm run launch:readiness
```

For a local QA report, an uncommitted environment file can be loaded without
printing secret values:

```powershell
npm run launch:readiness -- --env-file=.env.e2e
```

The production release job must set `NUTRIO_LAUNCH_EVIDENCE_MANIFEST` to the
protected manifest and run the fail-closed gate:

```powershell
npm run launch:readiness:strict
```

The strict command exits non-zero when a credential, required artifact, local
security migration, or default-off safety control is missing.

For the GitHub `Production Launch Gate`, base64-encode the reviewed manifest
and store it as the protected environment secret
`LAUNCH_EVIDENCE_MANIFEST_B64`. The workflow decodes it only into the runner's
temporary directory, runs the strict check, deletes it, and uploads only the
existing redacted summary. The evidence step intentionally receives no E2E,
Supabase, or SADAD secret values; account availability is checked inside the
separate Playwright step and payment completion is proven by the signed
financial evidence artifacts.
