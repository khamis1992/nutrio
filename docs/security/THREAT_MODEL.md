# Nutrio Threat Model

Last reviewed: 2026-07-16

## Purpose and scope

This model covers the Nutrio customer, coach, partner, driver, fleet, and admin
portals; the Capacitor mobile applications; Supabase Auth, Postgres, Storage,
and Edge Functions; payment and notification providers; AI providers; and the
GitHub build/release pipeline.

The objective is risk reduction, rapid detection, and defensible evidence. No
application can promise that it will never be compromised. Controls must be
paired with monitoring, patching, backups, incident exercises, and independent
provider logs.

## Highest-value assets

- Authentication sessions, MFA factors, roles, and service credentials.
- Health, blood-work, nutrition, and body-measurement data.
- Identity, driver, vehicle, support, and coaching documents.
- Wallet, subscription, payout, bank, order, and payment-provider records.
- Admin capabilities, database migrations, signing keys, and release tokens.
- Security evidence, daily anchors, incident records, and chain-of-custody data.

## Trust boundaries

1. Untrusted browser/native input to the SPA and Edge Functions.
2. Authenticated users crossing object and portal ownership boundaries.
3. Edge Functions crossing into service-role access and external providers.
4. Postgres SECURITY DEFINER functions crossing RLS boundaries.
5. File uploads crossing into private storage and downstream document parsers.
6. GitHub Actions crossing into deployment credentials and mobile signing keys.
7. Admin users crossing into privileged data after AAL2 MFA verification.

## Threat catalogue and controls

| Threat | Nutrio exposure | Implemented controls | Evidence |
|---|---|---|---|
| Credential stuffing and password spraying | Every portal login | Supabase Auth, rate limits, generic errors, mandatory AAL2 for admins, session expiry | Supabase Auth audit entries mirrored as minimized `authentication` ledger events; external Auth logs for failed requests |
| Session theft and replay | Browser storage, native device, stolen refresh token | Native biometric/keychain storage, reduced persistent health data, token verification, admin step-up | User/session/request correlation; revoke sessions during containment |
| BOLA/BFLA and role escalation | Cross-user records, portal APIs, admin RPCs | RLS, ownership checks, verified Edge principals, AAL2-aware `has_role`, live posture checks | Denied authorization events with actor/resource/request IDs |
| SQL/command/template injection | RPCs, workflows, email templates, CSV exports | Parameterized Supabase APIs, pinned function search paths, escaped HTML, spreadsheet neutralization, validated workflow inputs | Failure/denial events and CI audit output |
| Stored/reflected XSS | AI text, profile names, admin/customer content | React escaping, DOMPurify at the one HTML render boundary, CSP, no dynamic evaluation | Sentry redaction and application request correlation |
| CSRF/CORS abuse | Browser calls to Edge Functions | Bearer authentication, origin allowlist, no wildcard Edge CORS, SameSite provider behavior | Edge request/origin logs and denied events |
| SSRF and unsafe redirects | AI image fetches, anchor webhook, OAuth, Lighthouse CI | HTTPS/host allowlists, private-address rejection, one-time OAuth state, bounded redirects/timeouts | Provider and Edge request IDs |
| Malicious uploads and parser exploits | PDFs, Office files, images, support/fleet/health documents | Private buckets, server-side authorization, magic-byte checks, 10 MiB bound, SHA-256, fail-closed external malware scanner, no direct client writes | Immutable `sensitive_file_scans` record and storage ledger event |
| Payment/webhook spoofing and replay | SADAD and SportHub callbacks | HMAC/checksum verification, timestamp and replay constraints, idempotent database operations | Provider event ID, request ID, checksum outcome, payment ledger |
| API abuse and denial of service | Public and authenticated Edge endpoints | Atomic rate limits, bounded bodies/responses, timeouts, small batch sizes | `api.rate_limit_blocked` and provider metrics |
| Supply-chain or CI compromise | npm, GitHub Actions, build tools, signing material | npm audit, CodeQL security-extended analysis, verified Gitleaks commit scans, static security gate, Dependabot, least-privilege jobs, separate publish jobs, full-SHA action pins, pinned CLI versions, temporary signing assets | GitHub audit log, workflow run, artifact digest, release provenance |
| Mobile backup/extraction or file-provider abuse | Android backup, broad shared storage, iOS/Android local data | Android backup disabled; FileProvider limited to app camera/cache paths; sensitive session material in OS keystore/keychain; raw health cache is session-only | Device/app logs where available |
| Obsolete or redirected mobile WebView | Known browser exploits, mixed content, hostile in-app navigation | Cleartext and mixed content disabled, no external WebView navigation, WebView 149 minimum with a local no-script upgrade page, ES2020-reviewed build | Native release/config audit and application version correlation |
| Insider or service-role misuse | Admin, deployment operator, database owner | AAL2, least privilege, append-only ledger, incident case custody log, off-site daily anchors | Admin actor ID, request ID, exported evidence hash, provider audit logs |
| Evidence deletion/tampering | Database owner or stolen service role | FORCE RLS, revoked table grants, immutable triggers, row seals, range anchors, independent HMAC receipt | Local chain verifier plus independently retained anchor payload |
| Data exfiltration through analytics/errors | Health/payment/identity payloads | Sentry and analytics redaction/allowlists, no secrets in client bundle, private signed URLs | Provider data-access logs and configuration review |

## Security invariants

- An admin operation is not authorized unless the verified JWT has `aal2`.
- A sensitive bucket is private and has no authenticated INSERT/UPDATE policy.
- A sensitive file is not stored unless its owner/scope is authorized and its
  signature, size, hash, and malware result are recorded server-side.
- Provider callbacks never trust a user-supplied identity or amount without a
  provider signature and an idempotent database transition.
- Security evidence is append-only through normal application/database roles.
- The latest completed-day ledger anchor is copied outside the Supabase trust
  boundary and the receipt is visible in the Admin Security Center.
- Client bundles never contain service-role, database, scanner, signing, or
  provider secret credentials.
- New commits are rejected when the verified Gitleaks scan or repository secret
  guard detects a credential; any historical credential is rotated before it is
  allowlisted or removed from Git history.
- Native WebViews never permit cleartext or arbitrary external navigation, and
  unsupported Android WebViews are blocked before application code executes.

## Evidence and attribution limits

The ledger captures UTC time, actor/user/role, action, resource, request and
correlation IDs, source IP, country, user agent, outcome, sanitized metadata,
and cryptographic hashes. These fields support correlation and investigation.
They do not independently prove the natural person behind an action. NAT, VPNs,
shared devices, stolen sessions, spoofable user agents, and provider proxies
must be considered. Preserve Supabase, CDN/WAF, identity-provider, payment,
email, GitHub, and mobile-provider logs so authorities can correlate them.

## Residual and operational risks

- A database owner/superuser can disable triggers; the independent daily anchor
  is therefore mandatory, not optional.
- Malware scanning requires an external engine and current signatures. Set
  `REQUIRE_MALWARE_SCAN=true`; monitor scanner failures and do not silently
  switch to `validated_only` in production.
- Rate limiting at the application layer does not replace CDN/WAF volumetric
  protection or provider quotas.
- Source dependency and action updates need review even when automated.
- Backups are useful only after a tested restore and documented recovery time.
- Runtime posture findings must be remediated after deployment; static code
  review cannot see manual dashboard changes or provider configuration drift.
- Keep database Auth Audit Log storage enabled so `auth.audit_log_entries`
  feeds the Nutrio ledger. Because provider/runtime failures may exist only in
  external Auth logs, retain those logs through an independent Supabase Log
  Drain or SIEM as well; do not route a full project drain back into the same
  project and create a recursive log loop.

## Primary standards and references

- [OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x00-header/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase migration to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Qatar National Information Assurance Standard](https://assurance.ncsa.gov.qa/sites/default/files/publications/policy/2023/NCSA_CSGA_%20National_Information_Assurance_Standard_En_V2.1.pdf)
- [Qatar Cybercrime Prevention Law No. 14 of 2014](https://www.almeezan.qa/EnglishLaws/142014.pdf)
- [GitHub Actions secure use](https://docs.github.com/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
