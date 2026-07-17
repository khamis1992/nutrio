# Nutrio Incident Response Runbook

Last reviewed: 2026-07-17

## Safety rules

- Do not delete, edit, or "clean up" suspected evidence.
- Do not confront a suspected actor or publish attribution.
- Do not paste tokens, medical records, payment data, or full logs into chat.
- Work in UTC and record every custody handoff.
- Treat IP/user-agent/device data as correlation evidence, not conclusive identity.
- Engage qualified legal/privacy counsel for notification decisions.

## Severity

| Severity | Examples | Target response |
|---|---|---|
| Critical | Active admin takeover, service-role theft, payment manipulation, broad health-data exfiltration | Immediate, 24/7 escalation |
| High | Confirmed account compromise, malware upload, RLS bypass, signing-key exposure | Begin within 30 minutes |
| Medium | Repeated blocked attack, limited suspicious access, scanner outage | Begin within 4 hours |
| Low | Reconnaissance or isolated policy violation with no access | Triage within one business day |

## First 15 minutes

1. Open Admin > Security Center and create an incident from the triggering event.
2. Record who declared it, UTC time, observed scope, and source alert.
3. Export filtered JSON evidence. Record its SHA-256 and never overwrite it.
4. Capture the current ledger integrity result and latest external anchor receipt.
5. Preserve relevant provider request IDs and prevent normal retention deletion.
6. For an active destructive attack, contain first: revoke affected sessions,
   disable the compromised integration/credential, and restrict the route at
   the WAF/provider. Record every action in the incident timeline.

## Preservation and chain of custody

For each evidence item record:

- Evidence ID, description, source system, UTC collection time, collector.
- Original filename/object reference, byte size, SHA-256, and read-only location.
- Access history and each transfer: from, to, reason, UTC time, acknowledgement.
- Provider export/request ID and retention hold confirmation.

Keep one working copy and at least one independent, access-controlled original.
Use object lock/immutable retention where available. Do not use the production
database as the only evidence store. Verify hashes before and after transfer.

## Investigation sequence

1. Verify ledger seals and daily range anchors; stop and escalate on mismatch.
2. Establish the first and last known malicious UTC activity.
3. Correlate actor user ID, AAL, session, request/correlation ID, IP, country,
   user agent, resource, provider event, database change, and release/workflow.
4. Identify the initial access vector: credentials, vulnerable endpoint,
   malicious file, provider callback, dependency/build, or privileged insider.
5. Determine affected identities, tables/rows, objects, funds, secrets, devices,
   regions, and backups. Separate confirmed impact from hypotheses.
6. Preserve Supabase Auth/API/database/storage, CDN/WAF, GitHub, payment,
   notification, AI, app-store, and endpoint/device logs as applicable.

## Containment

- Revoke sessions and force credential/MFA reset for affected identities.
- Rotate one credential at a time and record old key ID, new key ID, owner, and
  dependent services. Start with service role, database, provider webhook,
  payment, signing, GitHub, scanner, and anchor keys when their scope is affected.
- Block confirmed indicators narrowly; do not rely on IP blocking alone.
- Disable compromised Edge Functions or provider routes with a documented
  maintenance response. Preserve code and deployment SHAs before replacement.
- Quarantine suspect files and prevent parser/AI access until re-scanned.

## Admin authenticator loss and recovery

Treat a lost device, stale TOTP factor, or repeated code mismatch as an account
recovery event. Never add a client-side "reset MFA" action that can run from an
AAL1 password-only session.

1. Confirm automatic date and time is enabled on the authenticator device, wait
   for a fresh code, and verify that the selected Nutrio factor belongs to the
   same admin account. Do not ask the administrator to disclose a TOTP seed or
   current code.
2. If another enrolled factor works, establish AAL2 with that factor before
   removing the unavailable one and enrolling a replacement.
3. If no factor works, open a security incident. Require an out-of-band identity
   check and approval by a second AAL2 administrator or an authorized Supabase
   Auth operator. The locked-out administrator must not approve their own reset.
4. Record the target user ID, factor ID suffix, approver, operator, UTC times,
   provider request/audit ID, reason, and resulting session revocations in the
   incident timeline. Never record the replacement seed or a TOTP code.
5. Revoke all sessions, remove only the confirmed unavailable factor through the
   provider's administrative control, require a fresh password sign-in, and
   enroll a new factor. Verify AAL2 before restoring admin access.
6. Review Auth, Security Center, provider, and source-control logs for suspicious
   activity before closing the event. Rotate the dedicated production E2E admin
   factor and protected CI seed separately when that account is affected.

Emergency access must remain time-limited, named, independently approved, and
fully audited. Do not disable the database AAL2 policy as a recovery shortcut.

## Eradication and recovery

1. Fix the root cause and add a regression/security test.
2. Review database RLS, function grants/search paths, storage policies, admin MFA,
   scanner status, and CI permissions in Security Center.
3. Restore only from a known-good point; verify migrations and immutable hashes.
4. Deploy through protected environments with two-person review for production.
5. Monitor heightened alerts for at least two normal business cycles.
6. Confirm payments, balances, subscriptions, orders, and health records reconcile.

## Qatar reporting package

Prepare a concise package containing incident ID, organization/contact details,
UTC timeline, detection source, affected systems/data, confirmed impact, current
containment, indicators, evidence inventory and hashes, relevant provider request
IDs, and any assistance requested. Do not include unrelated customer data.

- NCSA reporting portal: https://ncsa.gov.qa/en/reporting
- Q-CERT digital forensics: https://qcert.ncsa.gov.qa/services/digital-forensics
- NCSA hotline: 16555
- NCSA international number: +974 51016555
- NCSA incident email: NCSOC@ncsa.gov.qa (international: Cert@ncsa.gov.qa)
- National Incident Management Framework: https://ncsa.gov.qa/en/national-incident-management-framework

The NCSA framework recommends using its public key when sensitive evidence is
sent by email. Request the current public key from NCSA first; never email an
unencrypted full database, health record set, credential, or raw payment data.

Coordinate criminal complaints and evidence disclosure with counsel and the
competent Qatari authorities. This runbook is operational guidance, not legal
advice.

## Closure

- Document root cause, control failure, impact, costs, and notification decision.
- Complete credential rotation and access recertification.
- Retain evidence under the approved legal/records schedule.
- Update this threat model, tests, alerts, runbook, and staff training.
- Run a blameless review and assign owners/dates for every corrective action.
