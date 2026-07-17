# Security Audit Findings - 2026-07-16

## Scope and method

This record contains no credential values. Gitleaks 8.30.1 was downloaded from
the official release, its archive checksum was verified, and all 561 reachable
Git commits were scanned with output redaction. The scan covered approximately
121.59 MB of historical content. The current working tree was also inspected by
the repository security guard and a separate Gitleaks directory scan.

## Results

The historical scan reported 50 candidate findings:

| Rule | Count | Assessment |
|---|---:|---|
| JWT | 36 | Includes public `anon` tokens, user tokens, and confirmed privileged legacy `service_role` tokens |
| Generic API key | 11 | Includes provider credentials and documented/placeholding values requiring individual review |
| Curl authorization header | 2 | Documentation examples; no credential value is reproduced here |
| Google Cloud API key | 1 | Firebase mobile client identifier; public by design but must be app/API restricted |

### Confirmed critical exposure

A legacy Supabase `service_role` JWT appeared in seven historical script
locations. It bypasses Row Level Security and must be treated as compromised.
The first confirmed privileged occurrence is dated 2026-02-19. Removing the
literal from current files did not revoke it and did not remove it from Git
history.

Historical `.env` revisions beginning 2026-02-18 also contained candidate
UltraMsg, OpenRouter, Resend, and Mapbox credentials. The `.env` file was removed
from the tracked tree on 2026-03-19. Each provider credential must be rotated;
validity must not be inferred from age or from the file's deletion.

### Current-tree assessment

- No current Edge Function directly reads a legacy service-role or anon key.
  The central resolver accepts named Supabase publishable/secret keys (plus the
  documented local single-key variables) and deliberately has no legacy
  `service_role` or `anon` fallback.
- High-confidence repository scanning currently passes. Ignored local env files
  are not versioned and must remain local.
- Public anon/publishable tokens inside web/mobile bundles are expected client
  identifiers; security depends on RLS and verified user authorization.
- The Firebase mobile API key is public client configuration, not a backend
  credential. It still requires package/bundle, signing-certificate, API, quota,
  and abuse restrictions in Google Cloud/Firebase.
- Placeholder strings in an old banking migration and authorization examples
  are scanner false positives. They are not permission to ignore future matches.

## Required containment and recovery

1. Create named Supabase publishable and secret API keys. Deploy this audit's
   compatibility changes to staging, then production.
2. Replace every server, Edge, CI, cron, webhook, and local operations key with
   a named secret key. Replace clients with the publishable key.
3. Confirm usage has moved, then deactivate the legacy `service_role` and `anon`
   keys. Migrate to asymmetric JWT signing keys and revoke the previously used
   signing key according to Supabase's current procedure.
4. Revoke and replace UltraMsg, OpenRouter, Resend, and Mapbox credentials.
   Restrict the replacement keys by host, API, application, quota, and scope
   wherever the provider supports it.
5. Revoke active sessions where the incident assessment indicates risk. Review
   Supabase, provider, GitHub, CDN/WAF, and application logs from 2026-02-18 UTC
   onward for unexplained admin, export, auth, storage, payment, and messaging
   activity.
6. Open a case in Admin > Security Center. Attach this finding record, rotation
   timestamps, provider request IDs, affected release/commit IDs, and exported
   evidence hashes. Do not place raw credentials in the case.
7. Only after rotation, coordinate a Git history rewrite if desired. Preserve an
   access-controlled evidentiary copy and notify every clone owner. History
   rewriting reduces accidental rediscovery but does not revoke a secret.

## Status

Code remediation and prevention gates are implemented locally. Credential
rotation, provider log review, GitHub security-feature enablement, controlled
database migration, and Edge deployment are operational actions and remain
release blockers until completed and recorded.

Current vendor procedures:

- [Migrate to Supabase publishable and secret keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Rotate and revoke Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)
