# Nutrio Competitive Gap Release Matrix

Date: 2026-07-20  
Source: `nutrio-competitive-strategy-report-ar.docx`  
Decision owner: Product, Engineering, Operations, Security

## Decision rule

`Code complete` is not a release decision. A workstream is `Go` only when the
linked database, web journey, real APK journey, security tests, operational
owner, rollback path, and any external legal or clinical evidence all pass.

## Executive decision

Nutrio is **not yet approved for unrestricted production launch**. The core
product is materially stronger than the audited baseline, but the remaining
No-Go items are release evidence and external governance, not missing screen
mockups. A controlled internal or invited pilot may proceed only with GLP-1,
model-backed Meal Response claims, Family beneficiary scheduling, and
Corporate sponsorship disabled until their specific gates pass.

## Matrix

| Workstream | Web/code | Linked Supabase | Real APK | Remaining evidence | Decision |
|---|---|---|---|---|---|
| Safe Smart Substitute | Complete | Applied | Pending | Stale availability, allergen conflict, paid add-on and offline replay | Pilot only |
| Nutrio Verified | Complete | Applied | Pending | Fresh-schema pgTAP; customer/partner/AAL2 visual flows | Pilot only |
| Subscription operations | Hardening complete | Applied | Pending | Refund/reprice/offline and APK E2E | Pilot only |
| Adaptive Week | Complete | Applied | Pending | Fresh-schema pgTAP; Arabic/English stale-review and hold journeys | Pilot only |
| Care Team | Complete | Applied | Pending | Clean-schema replay; client/professional/admin device flows | Pilot only |
| Arabic behavior support | Complete | Applied | Pending | Quiet hours, budgets, RTL, large text, notification outcome | Pilot only |
| Performance journey | Complete | Existing services | Pending | Workout to meal to delivery Playwright and APK flow | Pilot only |
| GLP-1 support | Draft and governed | Foundation applied | Pending | Qatar legal, licensed dietitian, medical wording, DPIA, security pilot | No-Go |
| Family | Complete | Applied | Pending | Allergy/allowance/offline/device flows | Pilot only; flag off |
| Corporate | Complete | Applied | Pending | AAL2/invoice replay and employee/admin/device flows | Pilot only; flag off |
| Meal Response / CGM | Extensive foundation | Applied per registry | Pending | Direct provider validation, pilot calibration, delayed-data/privacy/device tests | No-Go for claims |
| Supplier quality | Complete | Applied | Pending | First AAL2 snapshot, constrained routing fixture, partner/admin checks | Pilot only |
| Voice logging / fasting | Deferred | Not required | Not required | Product validation after launch | Deferred |

## Blocking gaps

### 1. Release-critical customer operations

- Run subscription journeys end to end against the linked project.
- Prove wallet, meal credit, add-on debit, refund, skip, and cancellation are
  atomic and replay-safe.
- Verify the same behavior in the installed APK, including offline recovery,
  Android back, keyboard, safe area, and dock behavior.

### 2. Database and platform security closure

- Family, Corporate Benefits, and Subscription Schedule Operations are applied
  to the linked project and their linked pgTAP contracts passed.
- `20260720249000_harden_nutrio_verified_view.sql` is applied and recorded on
  the linked project. Rerun its pgTAP contract and the Supabase security advisor
  after restoring MCP OAuth to verify the security-definer finding is gone.
- Regenerate Supabase TypeScript types only after the final remote schema is
  verified.
- Run owner-positive, cross-user-negative, AAL1-negative, AAL2-positive,
  idempotency, allowance, and invoice replay fixtures.
- Resolve the Supabase dashboard findings before unrestricted launch: shorten
  OTP expiry to one hour or less, enable leaked-password protection, and
  schedule the available Postgres security upgrade.
- Decide and document the accepted posture for PostGIS `spatial_ref_sys`;
  Supabase explicitly warns against applying ordinary RLS automatically to
  this extension-managed reference table.

### 3. Clinical and regulatory boundary

- Keep GLP-1 protocol version 1 in draft.
- Do not use treatment, diagnosis, medication adjustment, or outcome claims.
- Obtain genuine signed Qatar legal, licensed dietitian, medical-safety, and
  privacy DPIA evidence. Engineering cannot self-approve these gates.
- Keep model-backed Meal Response output abstained until provider validation
  and pilot calibration meet the documented release threshold.

### 4. Device and accessibility evidence

- Test Arabic and English at 375px and large system text.
- Test TalkBack/VoiceOver names, focus order, sheets, dialogs, and errors.
- Test Android safe areas, native back, notification deep links, offline replay,
  and the bottom dock on at least one Samsung and one stock Android device.
- Capture screenshots and a signed run log for every release-critical journey.

### 5. Operational readiness

- Assign an owner, SLA, alert, runbook, rollback flag, and dashboard to each
  launch feature.
- Run the first supplier-quality snapshot from a genuine AAL2 admin session.
- Create Care Team credential-expiry and overdue-response operating queues.
- Define customer support scripts for allergy rejection, quota exhaustion,
  sponsor benefit disputes, refund recovery, and sensor disconnects.

## Safe launch sequence

1. Apply and verify pending migrations in a non-production branch or linked
   staging project.
2. Pass lint, typecheck, focused/full tests, build, database tests, and security
   advisors.
3. Pass web Playwright and real APK journeys with Arabic, English, accessibility,
   and offline coverage.
4. Launch core prepared-meal ordering to an invited cohort with GLP-1,
   Corporate, Family beneficiary scheduling, and model-backed Meal Response
   claims behind default-off flags.
5. Enable each gated workstream only after its own evidence is signed.

## Current verification record

- `npm.cmd run typecheck`: passed after the final Family, Corporate, and
  subscription integration corrections.
- `npm.cmd run lint`: passed after the final family, corporate, cancellation,
  and delivery-lifecycle corrections.
- `npm.cmd run phase1:contracts`: passed; migration registration, ten
  default-off flags, runtime gates, and release database-test discovery are
  consistent.
- Added 58 pgTAP assertions across Family, Corporate Benefits, and Subscription
  Schedule Operations; all three linked-project contracts completed through
  their final assertions.
- `git diff --check`: passed.
- Full Vitest with bounded workers: 183 files passed; 1,014 tests passed, 4
  real-environment tests were skipped, and 5 financial/concurrency tests remain
  explicit todo. Four stale test contracts found on the first run were
  corrected. The integration file now fails on database errors when enabled
  instead of silently passing against fake IDs.
- Production build: passed with 6,360 transformed modules.
- Mobile Playwright: 22 checks passed in one run, covering English at 360px,
  Arabic RTL at 390px, semantic controls, overflow, touch targets, dashboard
  transfer/interactive budgets, and private offline checkpoint recovery. Two
  setup roles were skipped because coach credentials and admin TOTP evidence
  are not configured.
- Static security audit passed across 28 explicitly unauthenticated Edge
  Functions; route audit passed across 185 routes and 87 navigation targets.
- Production launch now has a fail-closed machine gate backed by a versioned
  evidence manifest. It covers Supabase security, real-device APK evidence,
  six-portal authentication, SADAD concurrency, GLP-1 governance, Meal Response
  validation, supplier operations, and sensitive default-off flags. The
  protected workflow receives only the encoded evidence manifest outside its
  Playwright step and never exposes account or provider secrets to the checker.
- Local fresh/upgraded database replay was attempted; Supabase could not start
  because Windows `WslService` is disabled. Enabling it requires an actual
  Administrator session, so no SQL assertion ran or failed in that attempt.
- Family, Corporate Benefits, and Subscription Operations migrations: applied
  to linked Supabase in dependency order.
- Mobile artwork optimization: imported achievement badges reduced from about
  40 MB of PNG sources to 0.7 MB of WebP output; three profile/reward artworks
  reduced from about 3.2 MB to about 130 KB combined.
- Supabase MCP OAuth remains expired, so the Nutrio Verified pgTAP contract and
  advisor rerun remain pending. The final view-hardening migration itself was
  safely applied through an isolated CLI workdir after its dry run selected only
  `20260720249000`; the remote ledger now confirms that version. No broad push
  or automatic migration-history repair was performed. An anonymous PostgREST
  probe is denied at an underlying table, confirming invoker-security behavior.
- Android command-line tools, platform 36, platform-tools, and build-tools are
  installed locally; Capacitor sync passed with 15 native plugins.
- Debug APK assembly passed. The 249,585,106-byte diagnostic APK has SHA-256
  `7050432315129470E1DAF11C541A16346287305DC57C36141FF37561C9AC0D2B`
  and is signed only by the Android debug certificate.
- Gradle provenance was regenerated from an empty isolated cache. All 398 prior
  SHA-256 entries remain present, signature verification is enabled, and strict
  release APK and AAB builds passed with a disposable attestation key. Protected
  production signing and Samsung/stock-Android device evidence remain pending.
